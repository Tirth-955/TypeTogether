import { Router } from "express";

import * as authController from "../controllers/auth.controller.js";
import { authGuard } from "../middleware/authGuard.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();

authRouter.post("/signup", asyncHandler(authController.signup));
authRouter.post("/login", asyncHandler(authController.login));
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authGuard, authController.me);
