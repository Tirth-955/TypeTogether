import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";

import { env } from "../config/env.js";
import { AUTH_COOKIE_NAME } from "../config/cookies.js";
import { verifyAuthToken } from "../utils/jwt.js";
import type { AuthUser } from "../types/auth.js";
import { logDebug } from "./shared.js";
import { registerDocumentEvents } from "./documentEvents.js";
import { clearClientPresence, registerAwarenessEvents } from "./awarenessEvents.js";
import * as registry from "./registry.js";
import type { TypedServer, TypedSocket } from "./types.js";

export type {
    ClientToServerEvents,
    ServerToClientEvents,
    DocumentJoinAck,
    JoinedDocumentMeta,
    JoinedUserMeta,
    TypedServer,
    TypedSocket,
} from "./types.js";

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

const authenticateHandshake = (socket: TypedSocket): void => {
    const token = readCookieValue(socket.handshake.headers.cookie, AUTH_COOKIE_NAME);

    socket.data.user = token && token.length > 0 ? verifyAuthToken(token) : null;
};

export const initSocket = (httpServer: HttpServer): TypedServer => {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: env.CORS_ORIGIN,
            credentials: true,
        },
        serveClient: false,
    });

    io.use((socket, next) => {
        authenticateHandshake(socket);

        next();
    });

    io.on("connection", (socket) => {
        const user: AuthUser | null = socket.data.user;

        socket.data.docId = null;
        socket.data.clientId = null;

        logDebug(`socket ${socket.id} connected (${user ? user.email : "guest"})`);

        socket.emit("session:init", { authenticated: user !== null });

        registerDocumentEvents(socket);
        registerAwarenessEvents(socket);

        socket.on("disconnect", (reason) => {
            const docId = socket.data.docId;

            if (!docId) {
                logDebug(`socket ${socket.id} disconnected (${reason})`);
                return;
            }

            const session = registry.getJoinedSession(docId, socket.id);
            const clientId = socket.data.clientId;

            if (session && clientId !== null) {
                clearClientPresence(socket, docId, session, clientId);
            }

            registry.removeSocket(docId, socket.id);

            logDebug(`socket ${socket.id} disconnected (${reason})`);
        });
    });

    return io;
};
