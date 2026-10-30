import { afterAll, afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { db } from "../src/db/client.js";
import { request } from "./helpers.js";

const truncateDocuments = async () => {
    await db.execute(sql`TRUNCATE TABLE documents CASCADE`);
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

afterAll(async () => {
    await db.$client.end();
});
