import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";

import { env } from "../config/env.js";
import { db, withRetry } from "../db/client.js";
import { documents } from "../db/schema.js";
import type { DocType, LanguageId } from "../constants/document.js";

export type CreateDocumentInput = {
    title: string;
    docType: DocType;
    language: LanguageId | null;
};

export const createDocument = async ({ title, docType, language }: CreateDocumentInput) => {
    const id = nanoid(21);

    const expiresAt = new Date(Date.now() + env.LINK_RETENTION_HOURS * 3_600_000);

    return withRetry(async () => {
        const [inserted] = await db
            .insert(documents)
            .values({ id, title, docType, language, content: "", expiresAt })
            .onConflictDoNothing()
            .returning();

        if (inserted) return inserted;

        const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
        return existing;
    });
};

export type SaveDocumentInput = {
    id: string;
    content: string;
    title: string | undefined;
    userId: string;
};

export const saveDocument = async ({ id, content, title, userId }: SaveDocumentInput) =>
    withRetry(async () => {
        const [updated] = await db
            .update(documents)
            .set({
                ...(title !== undefined ? { title } : {}),
                content,
                creatorId: sql`COALESCE(${documents.creatorId}, ${userId}::uuid)`,
                expiresAt: null,
                updatedAt: new Date(),
            })
            .where(eq(documents.id, id))
            .returning();

        return updated ?? null;
    });

export const getDocumentById = async (id: string) =>
    withRetry(async () => {
        const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);

        if (!document) return null;
        if (document.expiresAt && document.expiresAt.getTime() <= Date.now()) return null;

        return document;
    });
