import { Router } from "express";

import * as documentController from "../controllers/document.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const documentsRouter = Router();

documentsRouter.post("/", asyncHandler(documentController.createDocument));
documentsRouter.get("/:id", asyncHandler(documentController.getDocument));
