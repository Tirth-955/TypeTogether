import { env } from "../config/env.js";
import * as documentService from "../services/document.service.js";
import { discardSession } from "./registry.js";
import { documentRoom } from "./shared.js";
import type { TypedServer } from "./types.js";

export const runExpirySweep = async (
    now: Date = new Date(),
    io?: TypedServer
): Promise<string[]> => {
    try {
        const deletedIds = await documentService.sweepExpiredDocuments(now);

        for (const docId of deletedIds) {
            if (io) {
                const room = documentRoom(docId);
                io.to(room).emit("document:error", {
                    code: "expired",
                    message: "Document has expired and been deleted",
                });
                io.in(room).disconnectSockets(true);
            }

            discardSession(docId);
        }

        return deletedIds;
    } catch (error) {
        console.error("Failed to run expiry sweep:", error);
        return [];
    }
};

let sweepTimer: NodeJS.Timeout | null = null;
let isSweeping = false;
let isLoopRunning = false;

export const startExpirySweepLoop = (io?: TypedServer): void => {
    if (isLoopRunning) {
        return;
    }

    isLoopRunning = true;

    const intervalMs = Math.max(100, env.EXPIRY_SWEEP_SECONDS * 1000);

    const scheduleTick = () => {
        if (!isLoopRunning) {
            return;
        }

        sweepTimer = setTimeout(async () => {
            if (!isLoopRunning) {
                return;
            }

            if (!isSweeping) {
                isSweeping = true;
                try {
                    await runExpirySweep(new Date(), io);
                } catch (err) {
                    console.error("Error during periodic expiry sweep:", err);
                } finally {
                    isSweeping = false;
                }
            }

            scheduleTick();
        }, intervalMs);

        sweepTimer.unref();
    };

    scheduleTick();
};

export const stopExpirySweepLoop = (): void => {
    isLoopRunning = false;

    if (sweepTimer) {
        clearTimeout(sweepTimer);
        sweepTimer = null;
    }
    
    isSweeping = false;
};
