import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";

import { env } from "../config/env.js";
import { AUTH_COOKIE_NAME } from "../config/cookies.js";
import { verifyAuthToken } from "../utils/jwt.js";
import type { AuthUser } from "../types/auth.js";

export interface ClientToServerEvents {}

export interface ServerToClientEvents {
    "session:init": (payload: { authenticated: boolean }) => void;
}

declare module "socket.io" {
    interface SocketData {
        user: AuthUser | null;
    }
}

export type TypedServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

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

        if (env.NODE_ENV !== "production") {
            console.log(`socket ${socket.id} connected (${user ? user.email : "guest"})`);
        }

        socket.emit("session:init", { authenticated: user !== null });

        socket.on("disconnect", (reason) => {
            if (env.NODE_ENV !== "production") {
                console.log(`socket ${socket.id} disconnected (${reason})`);
            }
        });
    });

    return io;
};
