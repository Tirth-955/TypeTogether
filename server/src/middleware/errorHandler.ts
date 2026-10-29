import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export const errorHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (err instanceof z.ZodError) {
        res.status(400).json({
            status: "error",
            message: "Invalid request body",
            issues: err.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
        return;
    }

    if (err instanceof ApiError) {
        res.status(err.status).json({
            status: "error",
            message: err.message,
            ...(err.details !== undefined && env.NODE_ENV !== "production"
                ? { details: err.details }
                : {}),
        });
        return;
    }

    // Errors from express.json() and friends carry an HTTP status themselves.
    const status =
        typeof err === "object" && err !== null && "status" in err
            ? (err as { status?: unknown }).status
            : null;
    if (typeof status === "number" && status >= 400 && status < 500) {
        res.status(status).json({ status: "error", message: "Invalid request" });
        return;
    }

    console.error("Unhandled error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
};
