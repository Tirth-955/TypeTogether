import { Router } from "express";

import { authRouter } from "./auth.routes.js";

export const apiRouter = Router();

apiRouter.use("/v1/auth", authRouter);
