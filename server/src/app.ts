import os from "node:os";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        message: "TypeTogether API is running",
        instance: os.hostname(),
    });
});

app.use(errorHandler);

export default app;
