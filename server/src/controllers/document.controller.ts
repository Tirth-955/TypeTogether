import type { Request, Response } from "express";
import { z } from "zod";

import { ApiError } from "../utils/ApiError.js";
import * as documentService from "../services/document.service.js";

const createDocumentSchema = z.object({
    title: z.string().trim().min(1).max(120),
});

export const createDocument = async (req: Request, res: Response) => {
    const { title } = createDocumentSchema.parse(req.body);

    const document = await documentService.createDocument({ title });

    res.status(201).json({
        status: "ok",
        document: {
            id: document.id,
            title: document.title,
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
            saved: document.expiresAt === null,
            shareUrl: `/d/${document.id}`,
            updatedAt: document.updatedAt.toISOString(),
        },
    });
};

export const deleteDocument = async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
        throw ApiError.unauthorized();
    }

    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : req.params.id;

    const result = await documentService.deleteDocument({ id, userId: user.id });

    if (result === "notFound") {
        throw ApiError.notFound("Document not found");
    }

    if (result === "forbidden") {
        throw ApiError.forbidden();
    }
    
    res.json({ status: "ok" });
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
            content: document.content,
            saved: document.expiresAt === null,
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
        },
    });
};
