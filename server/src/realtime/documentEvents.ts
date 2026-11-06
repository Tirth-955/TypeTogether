import * as Y from "yjs";

import { getDisplayName } from "../utils/displayName.js";
import type { TypedSocket } from "./types.js";
import { documentRoom, emitDocumentError, logDebug } from "./shared.js";
import { encodeAwarenessSnapshot } from "./awarenessEvents.js";
import * as registry from "./registry.js";
import * as documentService from "../services/document.service.js";
import {
    documentJoinPayloadSchema,
    documentRenamePayloadSchema,
    documentUpdatePayloadSchema,
    syncStep1PayloadSchema,
    syncStep2PayloadSchema,
} from "./schemas.js";

export const registerDocumentEvents = (socket: TypedSocket): void => {
    socket.on("document:join", async (payload, ack) => {
        const parsed = documentJoinPayloadSchema.safeParse(payload);

        if (!parsed.success) {
            ack({ ok: false, code: "badRequest", message: "Malformed join payload" });
            return;
        }

        const { docId, clientId } = parsed.data;

        // Prevent joining two different documents simultaneously on one socket
        if (socket.data.docId && socket.data.docId !== docId) {
            ack({
                ok: false,
                code: "conflict",
                message: "Socket already joined a different document",
            });
            return;
        }

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
            },
            user: {
                id: socket.data.user ? socket.data.user.id : null,
                displayName: getDisplayName(socket.data.user),
            },
        });

        logDebug(`socket ${socket.id} joined document ${docId}`);

        socket.emit("document:sync_step1", {
            docId,
            stateVector: Y.encodeStateVector(session.ydoc),
        });

        const awarenessSnapshot = encodeAwarenessSnapshot(session.awareness);

        if (awarenessSnapshot) {
            socket.emit("awareness:update", {
                docId,
                update: awarenessSnapshot,
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
            console.warn(`socket ${socket.id} sent an invalid state vector for ${docId}:`, error);
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

    socket.on("document:rename", async (payload, ack) => {
        const parsed = documentRenamePayloadSchema.safeParse(payload);

        if (!parsed.success) {
            ack?.({ ok: false, message: "Invalid title" });
            emitDocumentError(socket, "badRequest", "Malformed rename payload");
            return;
        }

        const { docId, title } = parsed.data;

        if (socket.data.docId !== docId) {
            ack?.({ ok: false, message: "Socket has not joined this document" });
            emitDocumentError(socket, "notJoined", "Socket has not joined this document");
            return;
        }

        const session = registry.getJoinedSession(docId, socket.id);

        if (!session) {
            ack?.({ ok: false, message: "Document session not found" });
            return;
        }

        try {
            const updated = await documentService.updateDocumentTitle(docId, title);

            if (!updated) {
                ack?.({ ok: false, message: "Document not found or expired" });
                return;
            }

            session.document.title = title;

            socket.to(documentRoom(docId)).emit("document:rename", { docId, title });

            ack?.({ ok: true, title });
        } catch (error) {
            console.error(`Failed to rename document ${docId}:`, error);
            ack?.({ ok: false, message: "Internal error renaming document" });
        }
    });
};
