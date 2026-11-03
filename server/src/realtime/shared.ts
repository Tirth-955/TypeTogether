import { env } from "../config/env.js";
import type { TypedSocket } from "./types.js";

export const documentRoom = (docId: string): string => `document:${docId}`;

export const logDebug = (message: string): void => {
    if (env.NODE_ENV !== "production") {
        console.log(message);
    }
};

export const emitDocumentError = (socket: TypedSocket, code: string, message: string): void => {
    socket.emit("document:error", { code, message });
};
