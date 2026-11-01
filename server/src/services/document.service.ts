import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

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

    return withRetry(async () => {
        const [inserted] = await db
            .insert(documents)
            .values({ id, title, docType, language, content: "" })
            .onConflictDoNothing()
            .returning();

        if (inserted) return inserted;

        const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
        return existing;
    });
};

export const getDocumentById = async (id: string) =>
    withRetry(async () => {
        const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);

        if (!document) return null;
        if (document.expiresAt && document.expiresAt.getTime() <= Date.now()) return null;

        return document;
    });
