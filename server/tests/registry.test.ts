import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

import { db } from "../src/db/client.js";
import { agent, request } from "./helpers.js";
import {
    CONTENT_TEXT_KEY,
    GC_GRACE_MS,
    addSocket,
    discardSession,
    getOrCreateSession,
    getSession,
    removeSocket,
} from "../src/realtime/registry.js";

const EMAIL = "editor@example.com";
const PASSWORD = "supersecret123";

let trackedDocId = "";

const createDoc = async (body: Record<string, unknown>) => {
    const res = await request.post("/api/v1/documents").send(body);

    if (res.status !== 201) {
        throw new Error(`createDoc failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    trackedDocId = res.body.document.id;
    return res.body.document;
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
    discardSession(trackedDocId); // registry must not leak state between tests
    trackedDocId = "";
    await db.execute(sql`TRUNCATE TABLE documents CASCADE`);
});

describe("document registry", () => {
    it("seeds a fresh Y.Doc from the saved document content", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });
        await agent.put(`/api/v1/documents/${created.id}`).send({ content: "Hello registry" });

        const session = await getOrCreateSession(created.id);

        expect(session).not.toBeNull();
        expect(session!.ydoc.getText(CONTENT_TEXT_KEY).toString()).toBe("Hello registry");
        expect(session!.awareness.doc).toBe(session!.ydoc);
    });

    it("returns null for an unknown document id", async () => {
        expect(await getOrCreateSession("C9B7rxAc21niwDZY3kTt2")).toBeNull();
    });

    it("reuses one session object for repeated lookups", async () => {
        const created = await createDoc({ title: "Notes", docType: "markdown" });

        const first = await getOrCreateSession(created.id);
        const second = await getOrCreateSession(created.id);

        expect(second).toBe(first);
        expect(getSession(created.id)).toBe(first);
    });

    it("tracks sockets and cancels the GC timer when someone rejoins", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });
        const session = (await getOrCreateSession(created.id))!;

        addSocket(created.id, "socket-1");
        addSocket(created.id, "socket-2");
        expect(session.sockets.size).toBe(2);

        expect(removeSocket(created.id, "socket-1")).toBe(1);
        expect(session.gcTimer).toBeNull(); // someone is still here

        expect(removeSocket(created.id, "socket-2")).toBe(0);
        expect(session.gcTimer).not.toBeNull(); // last one left: grace timer armed

        addSocket(created.id, "socket-3");
        expect(session.gcTimer).toBeNull(); // quick rejoin kept the warm state
    });

    it("discards the session after the GC grace period and rebuilds it from the DB", async () => {
        await vi.useFakeTimers();

        try {
            const created = await createDoc({ title: "Notes", docType: "text" });
            await agent.put(`/api/v1/documents/${created.id}`).send({ content: "To survive a GC" });
            await getOrCreateSession(created.id);

            addSocket(created.id, "socket-1");
            removeSocket(created.id, "socket-1");
            expect(getSession(created.id)).toBeDefined();

            await vi.advanceTimersByTimeAsync(GC_GRACE_MS);

            expect(getSession(created.id)).toBeUndefined();

            // A later join reconstructs the session from the PostgreSQL row.
            const revived = await getOrCreateSession(created.id);
            expect(revived).not.toBeNull();
            expect(revived!.ydoc.getText(CONTENT_TEXT_KEY).toString()).toBe("To survive a GC");
        } finally {
            await vi.useRealTimers();
        }
    });
});

afterAll(async () => {
    await db.$client.end();
});
