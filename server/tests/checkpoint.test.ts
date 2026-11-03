import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

import { db } from "../src/db/client.js";
import { documents } from "../src/db/schema.js";
import { env } from "../src/config/env.js";
import * as documentService from "../src/services/document.service.js";
import { agent, request } from "./helpers.js";
import {
    CONTENT_TEXT_KEY,
    addSocket,
    discardSession,
    getOrCreateSession,
    removeSocket,
} from "../src/realtime/registry.js";
import {
    checkpointSession,
    flushDirtySessions,
    startRetentionCheckpointLoop,
    stopRetentionCheckpointLoop,
} from "../src/realtime/checkpoint.js";

const EMAIL = "checkpoint_tester@example.com";
const PASSWORD = "password123";

const trackedDocIds: string[] = [];

const createDoc = async (body: Record<string, unknown> = { title: "Draft", docType: "markdown" }) => {
    const res = await request.post("/api/v1/documents").send(body);

    if (res.status !== 201) {
        throw new Error(`createDoc failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const doc = res.body.document;
    trackedDocIds.push(doc.id);
    return doc;
};

beforeAll(async () => {
    const signup = await agent
        .post("/api/v1/auth/signup")
        .send({ email: EMAIL, password: PASSWORD });

    if (signup.status === 409) {
        await agent.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD });
    }
});

afterEach(async () => {
    stopRetentionCheckpointLoop();
    for (const id of trackedDocIds) {
        discardSession(id);
    }
    trackedDocIds.length = 0;
    await db.execute(sql`TRUNCATE TABLE documents CASCADE`);
});

afterAll(async () => {
    stopRetentionCheckpointLoop();
});

describe("Phase 3.6 — 24-hour retention checkpointing", () => {
    it("never marks session dirty on initial load/seeding", async () => {
        const doc = await createDoc({ title: "Seed Test", docType: "text" });

        const session = await getOrCreateSession(doc.id);
        expect(session).not.toBeNull();
        expect(session!.dirty).toBe(false);
    });

    it("marks session dirty upon Y.Doc text edit", async () => {
        const doc = await createDoc();
        const session = (await getOrCreateSession(doc.id))!;

        expect(session.dirty).toBe(false);

        session.ydoc.getText(CONTENT_TEXT_KEY).insert(0, "Live collaborative edits");
        expect(session.dirty).toBe(true);
    });

    it("checkpoints dirty unsaved doc into PostgreSQL and extends expires_at to 24h from last edit", async () => {
        const doc = await createDoc();
        const session = (await getOrCreateSession(doc.id))!;

        const [initialRow] = await db.select().from(documents).where(eq(documents.id, doc.id)).limit(1);
        const initialExpiresAt = initialRow.expiresAt!.getTime();

        // Advance simulated time by 2 hours
        const twoHoursLater = Date.now() + 2 * 3_600_000;
        const dateSpy = vi.spyOn(Date, "now").mockReturnValue(twoHoursLater);

        try {
            session.ydoc.getText(CONTENT_TEXT_KEY).insert(0, "Updated content after 2 hours");
            expect(session.dirty).toBe(true);

            const checkpointed = await checkpointSession(session);
            expect(checkpointed).toBe(true);
            expect(session.dirty).toBe(false);

            // Verify in PostgreSQL
            const [row] = await db.select().from(documents).where(eq(documents.id, doc.id)).limit(1);
            expect(row).toBeDefined();
            expect(row.content).toBe("Updated content after 2 hours");
            expect(row.expiresAt).not.toBeNull();

            // Expected deadline: twoHoursLater + LINK_RETENTION_HOURS (24h)
            const expectedDeadline = twoHoursLater + env.LINK_RETENTION_HOURS * 3_600_000;
            const actualDeadline = row.expiresAt!.getTime();

            expect(Math.abs(actualDeadline - expectedDeadline)).toBeLessThan(5_000);
            expect(actualDeadline).toBeGreaterThan(initialExpiresAt);
        } finally {
            dateSpy.mockRestore();
        }
    });

    it("skips clean sessions during checkpointing (zero DB writes)", async () => {
        const doc = await createDoc();
        const session = (await getOrCreateSession(doc.id))!;

        expect(session.dirty).toBe(false);
        const result = await checkpointSession(session);
        expect(result).toBe(false);
    });

    it("flushes only dirty sessions in flushDirtySessions()", async () => {
        const doc1 = await createDoc({ title: "Doc 1", docType: "text" });
        const doc2 = await createDoc({ title: "Doc 2", docType: "text" });

        const session1 = (await getOrCreateSession(doc1.id))!;
        const session2 = (await getOrCreateSession(doc2.id))!;

        session1.ydoc.getText(CONTENT_TEXT_KEY).insert(0, "Content for Doc 1");
        expect(session1.dirty).toBe(true);
        expect(session2.dirty).toBe(false);

        const flushedCount = await flushDirtySessions();
        expect(flushedCount).toBe(1);
        expect(session1.dirty).toBe(false);
        expect(session2.dirty).toBe(false);

        // Verify DB
        const [row1] = await db.select().from(documents).where(eq(documents.id, doc1.id));
        const [row2] = await db.select().from(documents).where(eq(documents.id, doc2.id));

        expect(row1.content).toBe("Content for Doc 1");
        expect(row2.content).toBe("");
    });

    it("saved-doc race guard: never re-arms permanent documents or overwrites permanent status", async () => {
        const doc = await createDoc();
        const session = (await getOrCreateSession(doc.id))!;

        // User edits doc in memory
        session.ydoc.getText(CONTENT_TEXT_KEY).insert(0, "Unsaved live draft");
        expect(session.dirty).toBe(true);

        // Concurrently, a logged-in user saves the document via REST
        const saveRes = await agent
            .put(`/api/v1/documents/${doc.id}`)
            .send({ content: "Saved permanent version", title: "Permanent Doc" });

        expect(saveRes.status).toBe(200);
        expect(saveRes.body.document.saved).toBe(true);

        // Now retention checkpoint runs on the dirty session
        const checkpointed = await checkpointSession(session);

        // Should return false because 0 rows matched (expires_at IS NOT NULL was false)
        expect(checkpointed).toBe(false);
        // Dirty flag cleared to stop retrying forever
        expect(session.dirty).toBe(false);

        // In DB, permanent status is preserved with expires_at still NULL
        const [row] = await db.select().from(documents).where(eq(documents.id, doc.id)).limit(1);
        expect(row.expiresAt).toBeNull();
        expect(row.content).toBe("Saved permanent version");
    });

    it("retains dirty = true on DB error so the next tick retries", async () => {
        const doc = await createDoc();
        const session = (await getOrCreateSession(doc.id))!;

        session.ydoc.getText(CONTENT_TEXT_KEY).insert(0, "Should retry on DB error");
        expect(session.dirty).toBe(true);

        // Mock documentService.checkpointDocument to throw an outage error
        const checkpointSpy = vi
            .spyOn(documentService, "checkpointDocument")
            .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));

        try {
            const result = await checkpointSession(session);
            expect(result).toBe(false);
            // Must keep dirty = true so it retries!
            expect(session.dirty).toBe(true);
        } finally {
            checkpointSpy.mockRestore();
        }

        // Subsequent retry succeeds
        const retryResult = await checkpointSession(session);
        expect(retryResult).toBe(true);
        expect(session.dirty).toBe(false);
    });

    it("immediately flushes dirty unsaved document when the last socket leaves", async () => {
        const doc = await createDoc();
        const session = (await getOrCreateSession(doc.id))!;

        startRetentionCheckpointLoop();

        addSocket(doc.id, "socket-1");
        addSocket(doc.id, "socket-2");

        session.ydoc.getText(CONTENT_TEXT_KEY).insert(0, "Text before leaving");
        expect(session.dirty).toBe(true);

        // First socket leaves: session still has 1 socket, no departure flush
        const remaining1 = removeSocket(doc.id, "socket-1");
        expect(remaining1).toBe(1);
        expect(session.dirty).toBe(true);

        // Second socket leaves: remaining === 0, triggers immediate flush
        const remaining2 = removeSocket(doc.id, "socket-2");
        expect(remaining2).toBe(0);

        // Wait for async DB checkpoint to complete
        await vi.waitFor(
            () => {
                expect(session.dirty).toBe(false);
            },
            { timeout: 3000, interval: 50 }
        );

        const [row] = await db.select().from(documents).where(eq(documents.id, doc.id)).limit(1);
        expect(row.content).toBe("Text before leaving");
    });
});
