import { Router } from "express";

import { authRouter } from "./auth.routes.js";
import { documentsRouter } from "./document.routes.js";
import { usersRouter } from "./user.routes.js";

export const apiRouter = Router();

apiRouter.use("/v1/auth", authRouter);
apiRouter.use("/v1/documents", documentsRouter);
apiRouter.use("/v1/users", usersRouter);
