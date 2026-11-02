import type { Request, Response } from "express";
import { z } from "zod";

import { DEFAULT_LANGUAGE, docTypeSchema, languageSchema } from "../constants/document.js";
import { ApiError } from "../utils/ApiError.js";
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

const saveDocumentSchema = z.object({
    content: z.string().max(200_000),
    title: z.string().trim().min(1).max(120).optional(),
});

export const saveDocument = async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
        throw ApiError.unauthorized();
    }

    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : req.params.id;

    const { content, title } = saveDocumentSchema.parse(req.body);

    const document = await documentService.saveDocument({ id, content, title, userId: user.id });

    if (!document) {
        throw ApiError.notFound("Document not found");
    }
    
    res.json({
        status: "ok",
        document: {
            id: document.id,
            title: document.title,
            docType: document.docType,
            language: document.language,
            saved: document.expiresAt === null,
            shareUrl: `/d/${document.id}`,
            updatedAt: document.updatedAt.toISOString(),
        },
    });
};

export const getDocument = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : req.params.id;

    const document = await documentService.getDocumentById(id);

    if (!document) {
        throw ApiError.notFound("Document not found");
    }

    res.json({
        status: "ok",
        document: {
            id: document.id,
            title: document.title,
            docType: document.docType,
            language: document.language,
            content: document.content,
            saved: document.expiresAt === null,
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
        },
    });
};
