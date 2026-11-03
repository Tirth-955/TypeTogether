import { Server as SocketServer } from "socket.io";
import type { Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import * as Y from "yjs";
import {
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness";

import { env } from "../config/env.js";
import { AUTH_COOKIE_NAME } from "../config/cookies.js";
import { verifyAuthToken } from "../utils/jwt.js";
import { getDisplayName } from "../utils/displayName.js";
import type { AuthUser } from "../types/auth.js";
import * as registry from "./registry.js";
import {
    awarenessUpdatePayloadSchema,
    documentJoinPayloadSchema,
    documentUpdatePayloadSchema,
    syncStep1PayloadSchema,
    syncStep2PayloadSchema,
} from "./schemas.js";

export interface ClientToServerEvents {
    "document:join": (
        payload: { docId: string; clientId: number },
        ack: (response: DocumentJoinAck) => void
    ) => void;
    "document:sync_step1": (payload: { docId: string; stateVector: Uint8Array }) => void;
    "document:sync_step2": (payload: { docId: string; diff: Uint8Array }) => void;
    "document:update": (payload: { docId: string; update: Uint8Array }) => void;
    "awareness:update": (payload: { docId: string; update: Uint8Array }) => void;
}

export interface ServerToClientEvents {
    "session:init": (payload: { authenticated: boolean }) => void;
    "document:sync_step1": (payload: { docId: string; stateVector: Uint8Array }) => void;
    "document:sync_step2": (payload: { docId: string; diff: Uint8Array }) => void;
    "document:update": (payload: { docId: string; update: Uint8Array }) => void;
    "awareness:update": (payload: { docId: string; update: Uint8Array }) => void;
    "document:error": (payload: { code: string; message: string }) => void;
}

export type JoinedDocumentMeta = {
    id: string;
    title: string;
    docType: string;
    language: string | null;
};

export type JoinedUserMeta = {
    id: string | null;
    displayName: string;
};

export type DocumentJoinAck =
    | { ok: true; document: JoinedDocumentMeta; user: JoinedUserMeta }
    | { ok: false; code: string; message: string };

declare module "socket.io" {
    interface SocketData {
        user: AuthUser | null;
        docId: string | null;
        /** clientID of the client's local Awareness (part of join payload). */
        clientId: number | null;
    }
}

export type TypedServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

const documentRoom = (docId: string): string => `document:${docId}`;

const logDebug = (message: string): void => {
    if (env.NODE_ENV !== "production") {
        console.log(message);
    }
};

const emitDocumentError = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    code: string,
    message: string
): void => {
    socket.emit("document:error", { code, message });
};

const readCookieValue = (cookieHeader: string | undefined, name: string): string | undefined => {
    if (!cookieHeader) {
        return undefined;
    }

    for (const pair of cookieHeader.split(";")) {
        const separator = pair.indexOf("=");
        if (separator > -1 && pair.slice(0, separator).trim() === name) {
            return pair.slice(separator + 1);
        }
    }

    return undefined;
};

export const initSocket = (httpServer: HttpServer): TypedServer => {
    const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: env.CORS_ORIGIN,
            credentials: true,
        },
        serveClient: false,
    });

    io.use((socket, next) => {
        const token = readCookieValue(socket.handshake.headers.cookie, AUTH_COOKIE_NAME);

        socket.data.user = token && token.length > 0 ? verifyAuthToken(token) : null;

        next();
    });

    io.on("connection", (socket) => {
        const user = socket.data.user;

        socket.data.docId = null;
        socket.data.clientId = null;

        logDebug(`socket ${socket.id} connected (${user ? user.email : "guest"})`);

        socket.emit("session:init", { authenticated: user !== null });

        socket.on("document:join", async (payload, ack) => {
            const parsed = documentJoinPayloadSchema.safeParse(payload);

            if (!parsed.success) {
                ack({ ok: false, code: "badRequest", message: "Malformed join payload" });
                return;
            }

            if (socket.data.docId) {
                ack({ ok: false, code: "conflict", message: "Socket already joined a document" });
                return;
            }

            const { docId, clientId } = parsed.data;

            let session: registry.DocumentSession | null = null;

            try {
                session = await registry.getOrCreateSession(docId);
            } catch (error) {
                console.error(`Failed to load document session ${docId}:`, error);
                ack({ ok: false, code: "internal", message: "Failed to load document" });
                return;
            }

            if (!session) {
                ack({ ok: false, code: "notFound", message: "Document not found or expired" });
                return;
            }

            await socket.join(documentRoom(docId));

            registry.addSocket(docId, socket.id);

            socket.data.docId = docId;
            socket.data.clientId = clientId;

            const document = session.document;

            ack({
                ok: true,
                document: {
                    id: document.id,
                    title: document.title,
                    docType: document.docType,
                    language: document.language,
                },
                user: {
                    id: user ? user.id : null,
                    displayName: getDisplayName(user),
                },
            });

            logDebug(`socket ${socket.id} joined document ${docId}`);

            socket.emit("document:sync_step1", {
                docId,
                stateVector: Y.encodeStateVector(session.ydoc),
            });

            const awarenessStates = session.awareness.getStates();

            if (awarenessStates.size > 0) {
                socket.emit("awareness:update", {
                    docId,
                    update: encodeAwarenessUpdate(
                        session.awareness,
                        Array.from(awarenessStates.keys())
                    ),
                });
            }
        });

        socket.on("document:sync_step1", (payload) => {
            const parsed = syncStep1PayloadSchema.safeParse(payload);

            if (!parsed.success) {
                emitDocumentError(socket, "badRequest", "Malformed sync payload");
                return;
            }

            const { docId, stateVector } = parsed.data;

            const session = registry.getJoinedSession(docId, socket.id);

            if (!session) {
                emitDocumentError(socket, "notJoined", "Socket has not joined this document");
                return;
            }

            try {
                socket.emit("document:sync_step2", {
                    docId,
                    diff: Y.encodeStateAsUpdate(session.ydoc, stateVector),
                });
            } catch (error) {
                console.warn(
                    `socket ${socket.id} sent an invalid state vector for ${docId}:`,
                    error
                );
                emitDocumentError(socket, "malformedStateVector", "Invalid state vector");
            }
        });

        socket.on("document:sync_step2", (payload) => {
            const parsed = syncStep2PayloadSchema.safeParse(payload);

            if (!parsed.success) {
                emitDocumentError(socket, "badRequest", "Malformed sync payload");
                return;
            }

            const { docId, diff } = parsed.data;

            const session = registry.getJoinedSession(docId, socket.id);

            if (!session) {
                emitDocumentError(socket, "notJoined", "Socket has not joined this document");
                return;
            }

            try {
                Y.applyUpdate(session.ydoc, diff);
            } catch (error) {
                console.warn(`socket ${socket.id} sent an invalid update for ${docId}:`, error);
                emitDocumentError(socket, "malformedUpdate", "Invalid update payload");
                return;
            }

            socket.to(documentRoom(docId)).emit("document:sync_step2", { docId, diff });
        });

        socket.on("document:update", (payload) => {
            const parsed = documentUpdatePayloadSchema.safeParse(payload);

            if (!parsed.success) {
                emitDocumentError(socket, "badRequest", "Malformed update payload");
                return;
            }

            const { docId, update } = parsed.data;

            const session = registry.getJoinedSession(docId, socket.id);

            if (!session) {
                emitDocumentError(socket, "notJoined", "Socket has not joined this document");
                return;
            }

            try {
                Y.applyUpdate(session.ydoc, update);
            } catch (error) {
                console.warn(`socket ${socket.id} sent an invalid update for ${docId}:`, error);
                emitDocumentError(socket, "malformedUpdate", "Invalid update payload");
                return;
            }

            socket.to(documentRoom(docId)).emit("document:update", { docId, update });
        });

        socket.on("awareness:update", (payload) => {
            const parsed = awarenessUpdatePayloadSchema.safeParse(payload);

            if (!parsed.success) {
                emitDocumentError(socket, "badRequest", "Malformed awareness payload");
                return;
            }

            const { docId, update } = parsed.data;

            const session = registry.getJoinedSession(docId, socket.id);

            if (!session) {
                emitDocumentError(socket, "notJoined", "Socket has not joined this document");
                return;
            }

            try {
                applyAwarenessUpdate(session.awareness, update, socket.id);
            } catch (error) {
                console.warn(
                    `socket ${socket.id} sent an invalid awareness update for ${docId}:`,
                    error
                );
                emitDocumentError(socket, "malformedAwareness", "Invalid awareness payload");
                return;
            }

            socket.to(documentRoom(docId)).emit("awareness:update", { docId, update });
        });

        socket.on("disconnect", (reason) => {
            const docId = socket.data.docId;

            if (!docId) {
                logDebug(`socket ${socket.id} disconnected (${reason})`);
                return;
            }

            const session = registry.getJoinedSession(docId, socket.id);
            const clientId = socket.data.clientId;

            if (session && clientId !== null) {
                removeAwarenessStates(session.awareness, [clientId], "socket disconnect");

                socket.to(documentRoom(docId)).emit("awareness:update", {
                    docId,
                    update: encodeAwarenessUpdate(session.awareness, [clientId]),
                });
            }

            registry.removeSocket(docId, socket.id);

            logDebug(`socket ${socket.id} disconnected (${reason})`);
        });
    });

    return io;
};
