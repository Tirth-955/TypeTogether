import { Router } from "express";

import * as userController from "../controllers/user.controller.js";
import { authGuard } from "../middleware/authGuard.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usersRouter = Router();

usersRouter.get("/me/documents", authGuard, asyncHandler(userController.myDocuments));
