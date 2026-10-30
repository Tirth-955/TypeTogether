import type { Request, Response } from "express";
import { z } from "zod";

import { DEFAULT_LANGUAGE, docTypeSchema, languageSchema } from "../constants/document.js";
import * as documentService from "../services/document.service.js";

const createDocumentSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        docType: docTypeSchema,
        language: languageSchema.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.docType !== "code" && data.language !== undefined) {
            ctx.addIssue({
                path: ["language"],
                code: "custom",
                message: "language is only allowed for code documents",
            });
        }
    });

export const createDocument = async (req: Request, res: Response) => {
    const { title, docType, language } = createDocumentSchema.parse(req.body);

    const document = await documentService.createDocument({
        title,
        docType,
        language: docType === "code" ? (language ?? DEFAULT_LANGUAGE) : null,
    });

    res.status(201).json({
        status: "ok",
        document: {
            id: document.id,
            title: document.title,
            docType: document.docType,
            language: document.language,
            shareUrl: `/d/${document.id}`,
        },
    });
};
