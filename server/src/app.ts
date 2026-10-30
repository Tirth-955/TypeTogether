import os from "node:os";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { pool } from "./db/client.js";
import { apiRouter } from "./routes/index.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api", apiRouter);

app.get("/health", async (_req, res) => {
    let database: "connected" | "unavailable" = "connected";

    try {
        await pool.query("SELECT 1");
    } catch {
        database = "unavailable";
    }

    res.status(database === "connected" ? 200 : 503).json({
        status: database === "connected" ? "ok" : "degraded",
        database,
        instance: os.hostname(),
    });
});

app.use((req, res) => {
    res.status(404).json({
        status: "error",
        message: "Route not found",
        path: req.path,
    });
});

app.use(errorHandler);

export default app;
