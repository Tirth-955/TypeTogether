import { env } from "../config/env.js";
import * as documentService from "../services/document.service.js";
import {
    CONTENT_TEXT_KEY,
    getAllSessions,
    setOnLastSocketLeave,
    type DocumentSession,
} from "./registry.js";

export const checkpointSession = async (session: DocumentSession): Promise<boolean> => {
    if (!session.dirty) {
        return false;
    }

    if (session.document.expiresAt === null) {
        session.dirty = false;
        return false;
    }

    const content = session.ydoc.getText(CONTENT_TEXT_KEY).toString();
    const newExpiresAt = new Date(Date.now() + env.LINK_RETENTION_HOURS * 3_600_000);

    try {
        const updated = await documentService.checkpointDocument(
            session.docId,
            content,
            newExpiresAt
        );

        session.dirty = false;

        if (updated) {
            session.document.content = content;
            session.document.expiresAt = newExpiresAt;
            return true;
        }

        session.document.expiresAt = null;
        return false;
    } catch (error) {
        console.error(`Failed to checkpoint document session ${session.docId}:`, error);
        return false;
    }
};

export const handleLastSocketLeave = async (session: DocumentSession): Promise<boolean> => {
    if (session.dirty) {
        try {
            return await checkpointSession(session);
        } catch (err) {
            console.error(
                `Failed to checkpoint on last socket disconnect for ${session.docId}:`,
                err
            );
            return false;
        }
    }
    return false;
};

setOnLastSocketLeave((session) => {
    void handleLastSocketLeave(session);
});

export const flushDirtySessions = async (): Promise<number> => {
    const dirtySessions: DocumentSession[] = [];

    for (const session of getAllSessions()) {
        if (session.dirty) {
            dirtySessions.push(session);
        }
    }

    if (dirtySessions.length === 0) {
        return 0;
    }

    const results = await Promise.allSettled(dirtySessions.map((s) => checkpointSession(s)));

    let savedCount = 0;
    for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
            savedCount += 1;
        }
    }

    return savedCount;
};

let loopTimer: NodeJS.Timeout | null = null;
let isFlushing = false;
let isLoopRunning = false;

export const startRetentionCheckpointLoop = (): void => {
    if (isLoopRunning) {
        return;
    }

    isLoopRunning = true;

    // Ensure hook is active
    setOnLastSocketLeave((session) => {
        void handleLastSocketLeave(session);
    });

    const intervalMs = Math.max(100, env.RETENTION_CHECKPOINT_SECONDS * 1000);

    const scheduleTick = () => {
        if (!isLoopRunning) {
            return;
        }

        loopTimer = setTimeout(async () => {
            if (!isLoopRunning) {
                return;
            }

            if (!isFlushing) {
                isFlushing = true;
                try {
                    await flushDirtySessions();
                } catch (err) {
                    console.error("Error during periodic retention checkpoint:", err);
                } finally {
                    isFlushing = false;
                }
            }

            scheduleTick();
        }, intervalMs);

        loopTimer.unref();
    };

    scheduleTick();
};

export const stopRetentionCheckpointLoop = (): void => {
    isLoopRunning = false;
    if (loopTimer) {
        clearTimeout(loopTimer);
        loopTimer = null;
    }
    isFlushing = false;
};
