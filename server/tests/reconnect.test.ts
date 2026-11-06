import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import * as Y from "yjs";

import app from "../src/app.js";
import { db } from "../src/db/client.js";
import { documents } from "../src/db/schema.js";
import { initSocket } from "../src/realtime/socketServer.js";
import { agent, request } from "./helpers.js";
import {
    CONTENT_TEXT_KEY,
    discardAllSessions,
    getSession,
} from "../src/realtime/registry.js";
import { checkpointSession } from "../src/realtime/checkpoint.js";

let httpServer: Server;
let serverUrl = "";
const trackedDocIds: string[] = [];

const createDoc = async (body: Record<string, unknown> = { title: "Draft" }) => {
    const res = await request.post("/api/v1/documents").send(body);

    if (res.status !== 201) {
        throw new Error(`createDoc failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const doc = res.body.document;
    trackedDocIds.push(doc.id);
    return doc;
};

// Helper: establish socket client and perform initial Yjs sync step 1 / step 2
const setupSyncClient = async (
    docId: string,
    clientId: number
): Promise<{ client: ClientSocket; ydoc: Y.Doc; text: Y.Text }> => {
    const client: ClientSocket = ioClient(serverUrl);
    const ydoc = new Y.Doc();
    const text = ydoc.getText(CONTENT_TEXT_KEY);

    // Track local changes and send update
    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin !== "remote") {
            client.emit("document:update", { docId, update });
        }
    });

    // Receive server updates
    client.on("document:update", (payload: { docId: string; update: Uint8Array }) => {
        if (payload.docId === docId) {
            Y.applyUpdate(ydoc, new Uint8Array(payload.update), "remote");
        }
    });

    // Handle sync step 1
    client.on("document:sync_step1", (payload: { docId: string; stateVector: Uint8Array }) => {
        if (payload.docId === docId) {
            const diff = Y.encodeStateAsUpdate(ydoc, new Uint8Array(payload.stateVector));
            client.emit("document:sync_step2", { docId, diff });

            // Also send our state vector to server
            client.emit("document:sync_step1", {
                docId,
                stateVector: Y.encodeStateVector(ydoc),
            });
        }
    });

    // Handle sync step 2
    client.on("document:sync_step2", (payload: { docId: string; diff: Uint8Array }) => {
        if (payload.docId === docId) {
            Y.applyUpdate(ydoc, new Uint8Array(payload.diff), "remote");
        }
    });

    await new Promise<void>((resolve, reject) => {
        client.emit(
            "document:join",
            { docId, clientId },
            (ack: { ok: boolean; message?: string }) => {
                if (ack.ok) resolve();
                else reject(new Error(ack.message || "Join failed"));
            }
        );
    });

    return { client, ydoc, text };
};

beforeAll(async () => {
    httpServer = createServer(app);
    initSocket(httpServer);

    await new Promise<void>((resolve) => {
        httpServer.listen(0, () => resolve());
    });

    serverUrl = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
    discardAllSessions();
    trackedDocIds.length = 0;
    await db.execute(sql`TRUNCATE TABLE documents CASCADE`);
});

afterAll(async () => {
    discardAllSessions();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe("Phase 3.8 — Reconnect & Recovery", () => {
    it("rebuilds the session from the checkpointed PostgreSQL row after a simulated server restart", async () => {
        const doc = await createDoc({ title: "Restart Test" });

        // Client 1 connects and types content
        const client1 = await setupSyncClient(doc.id, 101);
        client1.text.insert(0, "Content saved before server restart");

        // Allow socket message propagation
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Trigger checkpoint to PostgreSQL
        const sessionBefore = getSession(doc.id)!;
        expect(sessionBefore).toBeDefined();
        await checkpointSession(sessionBefore);

        // Verify DB row was checkpointed
        const [dbRow] = await db.select().from(documents).where(eq(documents.id, doc.id));
        expect(dbRow.content).toBe("Content saved before server restart");

        client1.client.disconnect();

        // Simulate server restart: completely discard all in-memory sessions
        discardAllSessions();
        expect(getSession(doc.id)).toBeUndefined();

        // Client 2 connects to the share link after the restart
        const client2 = await setupSyncClient(doc.id, 202);

        // Allow sync protocol to finish
        await new Promise((resolve) => setTimeout(resolve, 80));

        // Client 2 should catch up and have the exact checkpointed content
        expect(client2.text.toString()).toBe("Content saved before server restart");

        client2.client.disconnect();
    });

    it("rejects rejoin with 404/notFound if the document expired during server downtime", async () => {
        const doc = await createDoc({ title: "Expired Offline" });

        // Age expires_at past deadline
        const past = new Date(Date.now() - 60_000);
        await db.update(documents).set({ expiresAt: past }).where(eq(documents.id, doc.id));

        // Simulate server restart
        discardAllSessions();

        const client: ClientSocket = ioClient(serverUrl);

        try {
            const joinResult = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
                client.emit("document:join", { docId: doc.id, clientId: 303 }, (ack: { ok: boolean; code?: string }) => {
                    resolve(ack);
                });
            });

            expect(joinResult.ok).toBe(false);
            expect(joinResult.code).toBe("notFound");

            // REST fetch also returns 404
            const res = await request.get(`/api/v1/documents/${doc.id}`);
            expect(res.status).toBe(404);
        } finally {
            client.disconnect();
        }
    });

    it("allows idempotent rejoin on the same socket for the same document", async () => {
        const doc = await createDoc({ title: "Idempotent Rejoin" });
        const { client } = await setupSyncClient(doc.id, 404);

        try {
            // Re-emit document:join with same docId
            const rejoinResult = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
                client.emit("document:join", { docId: doc.id, clientId: 404 }, (ack: { ok: boolean; code?: string }) => {
                    resolve(ack);
                });
            });

            expect(rejoinResult.ok).toBe(true);
        } finally {
            client.disconnect();
        }
    });

    it("supports concurrent editing between two clients without losing edits", async () => {
        const doc = await createDoc({ title: "Concurrent Edit" });

        const clientA = await setupSyncClient(doc.id, 1001);
        const clientB = await setupSyncClient(doc.id, 1002);

        try {
            // Both clients type concurrently
            clientA.text.insert(0, "A");
            clientB.text.insert(0, "B");

            // Allow updates to cross-propagate over Socket.IO
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Both clients should converge to the exact same text
            const textA = clientA.text.toString();
            const textB = clientB.text.toString();

            expect(textA).toBe(textB);
            expect(textA.length).toBe(2);
            expect(textA).toContain("A");
            expect(textA).toContain("B");

            // Server in-memory session also matches
            const serverSession = getSession(doc.id)!;
            expect(serverSession.ydoc.getText(CONTENT_TEXT_KEY).toString()).toBe(textA);
        } finally {
            clientA.client.disconnect();
            clientB.client.disconnect();
        }
    });

    it("broadcasts document:rename to other clients in the room and updates the DB", async () => {
        const doc = await createDoc({ title: "Original Name" });

        const clientA = await setupSyncClient(doc.id, 2001);
        const clientB = await setupSyncClient(doc.id, 2002);

        try {
            const renamePromise = new Promise<{ docId: string; title: string }>((resolve) => {
                clientB.client.on("document:rename", (payload: { docId: string; title: string }) => {
                    resolve(payload);
                });
            });

            // Client A renames the document
            const ack = await new Promise<{ ok: boolean; title?: string }>((resolve) => {
                clientA.client.emit(
                    "document:rename",
                    { docId: doc.id, title: "Collaboratively Renamed" },
                    (res: { ok: boolean; title?: string }) => resolve(res)
                );
            });

            expect(ack.ok).toBe(true);

            // Client B receives the rename event
            const received = await renamePromise;
            expect(received.docId).toBe(doc.id);
            expect(received.title).toBe("Collaboratively Renamed");

            // Server in-memory session has updated title
            const session = getSession(doc.id)!;
            expect(session.document.title).toBe("Collaboratively Renamed");

            // PostgreSQL has updated title
            const [row] = await db.select().from(documents).where(eq(documents.id, doc.id));
            expect(row.title).toBe("Collaboratively Renamed");
        } finally {
            clientA.client.disconnect();
            clientB.client.disconnect();
        }
    });
});
