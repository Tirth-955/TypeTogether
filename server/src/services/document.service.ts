import { nanoid } from "nanoid";

import { db } from "../db/client.js";
import { documents } from "../db/schema.js";
import type { DocType, LanguageId } from "../constants/document.js";

export type CreateDocumentInput = {
    title: string;
    docType: DocType;
    language: LanguageId | null;
};

export const createDocument = async ({ title, docType, language }: CreateDocumentInput) => {
    const [document] = await db
        .insert(documents)
        .values({
            id: nanoid(21),
            title,
            docType,
            language,
            content: "",
        })
        .returning();

    return document;
};
