import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import { eq, sql } from "drizzle-orm";

import app from "../src/app.js";
import { db } from "../src/db/client.js";
import { agent, request } from "./helpers.js";

const truncateDocuments = async () => {
    await db.execute(sql`TRUNCATE TABLE documents CASCADE`);
};

const createDoc = async (body: Record<string, unknown>) => {
    const res = await request.post("/api/v1/documents").send(body);

    if (res.status !== 201) {
        throw new Error(`createDoc failed: ${res.status} ${JSON.stringify(res.body)}`);
    }

    return res.body.document;
};

describe("POST /api/v1/documents", () => {
    afterEach(truncateDocuments);

    it("creates an unsaved markdown document without auth and returns a share link", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "Notes", docType: "markdown" });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("ok");
        expect(res.body.document.title).toBe("Notes");
        expect(res.body.document.docType).toBe("markdown");
        expect(res.body.document.language).toBeNull();

        // Unguessable nanoid id, and the share URL derived from it.
        expect(res.body.document.id).toMatch(/^[A-Za-z0-9_-]{21}$/);
        expect(res.body.document.shareUrl).toBe(`/d/${res.body.document.id}`);
    });

    it("defaults the language to javascript for a code document", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "script", docType: "code" });

        expect(res.status).toBe(201);
        expect(res.body.document.language).toBe("javascript");
    });

    it("keeps the requested language for a code document", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "script", docType: "code", language: "python" });

        expect(res.status).toBe(201);
        expect(res.body.document.language).toBe("python");
    });

    it("rejects a language on a non-code document with 400", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "Notes", docType: "markdown", language: "python" });

        expect(res.status).toBe(400);
        expect(res.body.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: "language" })])
        );
    });

    it("rejects an unknown doc type with 400", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "Notes", docType: "docx" });

        expect(res.status).toBe(400);
        expect(res.body.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: "docType" })])
        );
    });

    it("rejects an empty title with 400", async () => {
        const res = await request.post("/api/v1/documents").send({ title: "   ", docType: "text" });

        expect(res.status).toBe(400);
        expect(res.body.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: "title" })])
        );
    });

    it("rejects a title longer than 120 characters with 400", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "x".repeat(121), docType: "text" });

        expect(res.status).toBe(400);
    });

    it("rejects an unknown language with 400", async () => {
        const res = await request
            .post("/api/v1/documents")
            .send({ title: "script", docType: "code", language: "klingon" });

        expect(res.status).toBe(400);
    });
});

describe("GET /api/v1/documents/:id", () => {
    afterEach(truncateDocuments);

    it("publicly fetches a document by its ID without auth", async () => {
        const created = await createDoc({ title: "Notes", docType: "markdown" });

        const res = await request.get(`/api/v1/documents/${created.id}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.document.id).toBe(created.id);
        expect(res.body.document.title).toBe("Notes");
        expect(res.body.document.docType).toBe("markdown");
        expect(res.body.document.content).toBe("");
        expect(res.body.document.saved).toBe(false);
        expect(res.body.document.createdAt).toEqual(expect.any(String));
        expect(res.body.document.updatedAt).toEqual(expect.any(String));
    });

    it("returns 404 for an unknown document ID", async () => {
        const res = await request.get("/api/v1/documents/C9B7rxAc21niwDZY3kTt2");

        expect(res.status).toBe(404);
        expect(res.body.status).toBe("error");
        expect(res.body.message).toBe("Document not found");
    });

    it("returns 404 AFTER the retention deadline has passed, even unsaved", async () => {
        // Simulate a document whose 24-hour window passed directly in the DB.
        const expiredId = "C9B7rxAc21niwDZY3kTt2";
        const { documents } = await import("../src/db/schema.js");
        await db.insert(documents).values({
            id: expiredId,
            title: "Expired",
            docType: "text",
            expiresAt: new Date(Date.now() - 1_000),
        });

        const res = await request.get(`/api/v1/documents/${expiredId}`);
        expect(res.status).toBe(404);
    });
});

describe("PUT /api/v1/documents/:id", () => {
    const EMAIL = "saver@example.com";
    const PASSWORD = "supersecret123";
    let saverId = "";

    beforeAll(async () => {
        const signup = await agent.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });

        const userRes =
            signup.status === 409
                ? await agent.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD })
                : signup;

        // The agent keeps the HTTP-only cookie for later PUT calls.
        saverId = userRes.body.user.id;
    });

    afterEach(truncateDocuments);

    it("rejects an anonymous save with 401", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });

        const res = await request.put(`/api/v1/documents/${created.id}`).send({ content: "hello" });

        expect(res.status).toBe(401);
        expect(res.body.status).toBe("error");
    });

    it("saves content and title, stamps the saver as creator, and makes the document permanent", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });

        const res = await agent
            .put(`/api/v1/documents/${created.id}`)
            .send({ content: "# Hello", title: "Saved notes" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.document.title).toBe("Saved notes");
        expect(res.body.document.saved).toBe(true);

        const { documents } = await import("../src/db/schema.js");
        const [row] = await db.select().from(documents).where(eq(documents.id, created.id));

        expect(row.content).toBe("# Hello");
        expect(row.expiresAt).toBeNull();
        expect(row.creatorId).toBe(saverId);
    });

    it("keeps a previously saved document permanent on a later save", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });

        await agent.put(`/api/v1/documents/${created.id}`).send({ content: "first" });
        const res = await agent.put(`/api/v1/documents/${created.id}`).send({ content: "second" });

        expect(res.status).toBe(200);

        const { documents } = await import("../src/db/schema.js");
        const [row] = await db.select().from(documents).where(eq(documents.id, created.id));

        expect(row.content).toBe("second");
        expect(row.expiresAt).toBeNull();
        // First save wins the creator stamp even on later saves.
        expect(row.creatorId).toBe(saverId);
    });

    it("returns 404 for an unknown document ID", async () => {
        const res = await agent
            .put("/api/v1/documents/C9B7rxAc21niwDZY3kTt2")
            .send({ content: "x" });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Document not found");
    });

    it("rejects a title longer than 120 characters with 400", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });

        const res = await agent
            .put(`/api/v1/documents/${created.id}`)
            .send({ content: "x", title: "x".repeat(121) });

        expect(res.status).toBe(400);
        expect(res.body.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: "title" })])
        );
    });
});

describe("GET /api/v1/users/me/documents", () => {
    const EMAIL = "saver@example.com";
    const PASSWORD = "supersecret123";

    beforeAll(async () => {
        const signup = await agent.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });

        if (signup.status === 409) {
            await agent.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD });
        }
    });

    afterEach(truncateDocuments);

    it("rejects an anonymous request with 401", async () => {
        const res = await request.get("/api/v1/users/me/documents");

        expect(res.status).toBe(401);
        expect(res.body.status).toBe("error");
    });

    it("lists the user's saved documents newest first", async () => {
        const first = await createDoc({ title: "First", docType: "text" });
        const second = await createDoc({ title: "Second", docType: "markdown" });

        await agent.put(`/api/v1/documents/${first.id}`).send({ content: "" });
        // Guarantee unambiguous updatedAt ordering at millisecond precision.
        await new Promise((resolve) => setTimeout(resolve, 5));
        await agent.put(`/api/v1/documents/${second.id}`).send({ content: "" });

        const res = await agent.get("/api/v1/users/me/documents");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");

        expect(res.body.documents).toHaveLength(2);
        expect(res.body.documents[0].id).toBe(second.id);
        expect(res.body.documents[1].id).toBe(first.id);
        expect(res.body.documents[0]).toMatchObject({ title: "Second", docType: "markdown" });
        // List projection stays lean — no document content.
        expect(res.body.documents[0]).not.toHaveProperty("content");
    });

    it("does not list documents that were never saved", async () => {
        const saved = await createDoc({ title: "Saved", docType: "text" });
        await createDoc({ title: "Unsaved", docType: "text" });

        await agent.put(`/api/v1/documents/${saved.id}`).send({ content: "" });

        const res = await agent.get("/api/v1/users/me/documents");

        expect(res.status).toBe(200);
        expect(res.body.documents).toHaveLength(1);
        expect(res.body.documents[0].id).toBe(saved.id);
    });
});

describe("DELETE /api/v1/documents/:id", () => {
    const EMAIL = "saver@example.com";
    const PASSWORD = "supersecret123";

    beforeAll(async () => {
        const signup = await agent.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });

        if (signup.status === 409) {
            await agent.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD });
        }
    });

    afterEach(truncateDocuments);

    it("rejects an anonymous delete with 401", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });

        const res = await request.delete(`/api/v1/documents/${created.id}`);

        expect(res.status).toBe(401);
        expect(res.body.status).toBe("error");
    });

    it("rejects deletion of an unsaved (creator-less) document with 403", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });

        const res = await agent.delete(`/api/v1/documents/${created.id}`);

        expect(res.status).toBe(403);
        expect(res.body.status).toBe("error");
    });

    it("rejects deletion by a logged-in user who is not the creator with 403", async () => {
        const ownerAgent = supertest.agent(app);
        const ownerSignup = await ownerAgent
            .post("/api/v1/auth/signup")
            .send({ email: "owner@example.com", password: PASSWORD });

        if (ownerSignup.status === 409) {
            await ownerAgent.post("/api/v1/auth/login").send({ email: "owner@example.com", password: PASSWORD });
        }

        const created = await createDoc({ title: "Notes", docType: "text" });
        await ownerAgent.put(`/api/v1/documents/${created.id}`).send({ content: "" });

        const res = await agent.delete(`/api/v1/documents/${created.id}`);

        expect(res.status).toBe(403);
    });

    it("deletes the creator's own document", async () => {
        const created = await createDoc({ title: "Notes", docType: "text" });
        await agent.put(`/api/v1/documents/${created.id}`).send({ content: "" });

        const res = await agent.delete(`/api/v1/documents/${created.id}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");

        const fetched = await request.get(`/api/v1/documents/${created.id}`);
        expect(fetched.status).toBe(404);
    });
});

afterAll(async () => {
    await db.$client.end();
});
