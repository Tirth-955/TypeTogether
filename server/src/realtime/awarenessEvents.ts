import {
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness";

import type { Awareness } from "y-protocols/awareness";

import type { TypedSocket } from "./types.js";
import { documentRoom, emitDocumentError } from "./shared.js";
import * as registry from "./registry.js";
import { awarenessUpdatePayloadSchema } from "./schemas.js";

export const registerAwarenessEvents = (socket: TypedSocket): void => {
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
};

export const encodeAwarenessSnapshot = (awareness: Awareness): Uint8Array | null => {
    const clientIds = Array.from(awareness.getStates().keys());

    return clientIds.length > 0 ? encodeAwarenessUpdate(awareness, clientIds) : null;
};

export const clearClientPresence = (
    socket: TypedSocket,
    docId: string,
    session: registry.DocumentSession,
    clientId: number
): void => {
    removeAwarenessStates(session.awareness, [clientId], "socket disconnect");

    socket
        .to(documentRoom(docId))
        .emit("awareness:update", {
            docId,
            update: encodeAwarenessUpdate(session.awareness, [clientId]),
        });
};
