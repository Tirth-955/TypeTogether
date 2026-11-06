import type { Request, Response } from "express";
import { z } from "zod";

import { ApiError } from "../utils/ApiError.js";
import * as documentService from "../services/document.service.js";
import * as registry from "../realtime/registry.js";
import { documentRoom } from "../realtime/shared.js";
import type { TypedServer } from "../realtime/types.js";

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

    const session = registry.getSession(id);
    if (session) {
        session.document.content = document.content;
        session.document.expiresAt = null;
        if (title !== undefined) {
            session.document.title = document.title;
        }
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

const updateTitleSchema = z.object({
    title: z.string().trim().min(1).max(120),
});

export const updateTitle = async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : req.params.id;
    const { title } = updateTitleSchema.parse(req.body);

    const updated = await documentService.updateDocumentTitle(id, title);

    if (!updated) {
        throw ApiError.notFound("Document not found or expired");
    }

    const session = registry.getSession(id);
    if (session) {
        session.document.title = title;
    }

    const io = req.app.get("io") as TypedServer | undefined;
    if (io) {
        io.to(documentRoom(id)).emit("document:rename", { docId: id, title });
    }

    res.json({
        status: "ok",
        document: {
            id: updated.id,
            title: updated.title,
            updatedAt: updated.updatedAt.toISOString(),
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

    const io = req.app.get("io") as TypedServer | undefined;
    
    if (io) {
        const room = documentRoom(id);
        io.to(room).emit("document:error", {
            code: "deleted",
            message: "Document was deleted by creator",
        });
        io.in(room).disconnectSockets(true);
    }

    registry.discardSession(id);

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
