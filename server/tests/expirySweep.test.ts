import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";

import app from "../src/app.js";
import { db } from "../src/db/client.js";
import { documents } from "../src/db/schema.js";
import { initSocket, type TypedServer } from "../src/realtime/socketServer.js";
import { agent, request } from "./helpers.js";
import { discardSession, getOrCreateSession, getSession } from "../src/realtime/registry.js";
import {
    runExpirySweep,
    startExpirySweepLoop,
    stopExpirySweepLoop,
} from "../src/realtime/expirySweep.js";

const EMAIL = "sweep_tester@example.com";
const PASSWORD = "password123";

let httpServer: Server;
let socketIo: TypedServer;
let serverUrl = "";
const trackedDocIds: string[] = [];

const createDoc = async (
    body: Record<string, unknown> = { title: "Draft" }
) => {
    const res = await request.post("/api/v1/documents").send(body);

    if (res.status !== 201) {
        throw new Error(`createDoc failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const doc = res.body.document;
    trackedDocIds.push(doc.id);
    return doc;
};

beforeAll(async () => {
    httpServer = createServer(app);
    socketIo = initSocket(httpServer);

    await new Promise<void>((resolve) => {
        httpServer.listen(0, () => resolve());
    });

    serverUrl = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

    const signup = await agent
        .post("/api/v1/auth/signup")
        .send({ email: EMAIL, password: PASSWORD });

    if (signup.status === 409) {
        await agent.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD });
    }
});

afterEach(async () => {
    stopExpirySweepLoop();
    for (const id of trackedDocIds) {
        discardSession(id);
    }
    trackedDocIds.length = 0;
    await db.execute(sql`TRUNCATE TABLE documents CASCADE`);
});

afterAll(async () => {
    stopExpirySweepLoop();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe("Phase 3.7 — Expiry sweep", () => {
    it("deletes unsaved documents whose expires_at has passed", async () => {
        const doc = await createDoc({ title: "Expired Doc" });

        // Manually age the expires_at timestamp to 10 minutes in the past
        const past = new Date(Date.now() - 10 * 60_000);
        await db.update(documents).set({ expiresAt: past }).where(eq(documents.id, doc.id));

        const deleted = await runExpirySweep();
        expect(deleted).toContain(doc.id);

        // Verify row is gone from PostgreSQL
        const rows = await db.select().from(documents).where(eq(documents.id, doc.id));
        expect(rows.length).toBe(0);
    });

    it("preserves unsaved documents whose expires_at is still in the future", async () => {
        const doc = await createDoc({ title: "Active Doc" });

        // expires_at is default 24 hours in the future
        const deleted = await runExpirySweep();
        expect(deleted).not.toContain(doc.id);

        // Verify row is still in PostgreSQL
        const [row] = await db.select().from(documents).where(eq(documents.id, doc.id));
        expect(row).toBeDefined();
        expect(row.title).toBe("Active Doc");
    });

    it("never touches saved documents (expires_at IS NULL) even if simulated time is far in the future", async () => {
        const doc = await createDoc({ title: "Permanent Doc" });

        // Logged-in user saves document, setting expires_at = NULL
        const saveRes = await agent
            .put(`/api/v1/documents/${doc.id}`)
            .send({ content: "Permanent safe content" });

        expect(saveRes.status).toBe(200);
        expect(saveRes.body.document.saved).toBe(true);

        // Sweep with a date 100 days into the future
        const farFuture = new Date(Date.now() + 100 * 24 * 3_600_000);
        const deleted = await runExpirySweep(farFuture);
        expect(deleted).not.toContain(doc.id);

        // Verify row is completely intact
        const [row] = await db.select().from(documents).where(eq(documents.id, doc.id));
        expect(row).toBeDefined();
        expect(row.expiresAt).toBeNull();
        expect(row.content).toBe("Permanent safe content");
    });

    it("discards in-memory session and destroys Y.Doc when an expired document is swept", async () => {
        const doc = await createDoc({ title: "In-Memory Expired" });

        // Load into memory registry
        const session = await getOrCreateSession(doc.id);
        expect(session).not.toBeNull();
        expect(getSession(doc.id)).toBe(session);

        // Age expires_at to the past
        const past = new Date(Date.now() - 60_000);
        await db.update(documents).set({ expiresAt: past }).where(eq(documents.id, doc.id));

        const deleted = await runExpirySweep();
        expect(deleted).toContain(doc.id);

        // In-memory session must be completely removed from registry
        expect(getSession(doc.id)).toBeUndefined();
    });

    it("notifies connected sockets with an error and disconnects them when a document expires", async () => {
        const doc = await createDoc({ title: "Live Socket Expired" });
        await getOrCreateSession(doc.id);

        const client: ClientSocket = ioClient(serverUrl);

        try {
            // Join the document room
            await new Promise<void>((resolve, reject) => {
                client.emit(
                    "document:join",
                    { docId: doc.id, clientId: 12345 },
                    (ack: { ok: boolean }) => {
                        if (ack.ok) resolve();
                        else reject(new Error("Join failed"));
                    }
                );
            });

            // Age expires_at
            const past = new Date(Date.now() - 60_000);
            await db.update(documents).set({ expiresAt: past }).where(eq(documents.id, doc.id));

            // Set up expectations for error and disconnect
            const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
                client.on("document:error", (err) => resolve(err));
            });

            const disconnectPromise = new Promise<void>((resolve) => {
                client.on("disconnect", () => resolve());
            });

            // Execute sweep with active SocketServer passed
            const deleted = await runExpirySweep(new Date(), socketIo);
            expect(deleted).toContain(doc.id);

            const err = await errorPromise;
            expect(err.code).toBe("expired");

            await disconnectPromise;
            expect(client.connected).toBe(false);
        } finally {
            client.disconnect();
        }
    });

    it("starts and stops periodic sweep loop cleanly", () => {
        expect(() => {
            startExpirySweepLoop(socketIo);
            stopExpirySweepLoop();
        }).not.toThrow();
    });
});
