import type { Request, Response } from "express";

import { ApiError } from "../utils/ApiError.js";
import * as documentService from "../services/document.service.js";

export const myDocuments = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();

    const documents = await documentService.listDocumentsByCreator(user.id);

    res.json({
        status: "ok",
        documents: documents.map((document) => ({
            id: document.id,
            title: document.title,
            docType: document.docType,
            language: document.language,
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
        })),
    });
};
