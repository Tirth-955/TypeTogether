import type { NextFunction, Request, Response } from "express";

import { AUTH_COOKIE_NAME } from "../config/cookies.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAuthToken } from "../utils/jwt.js";

// Verifies the HTTP-only auth cookie and attaches the user's identity.

export const authGuard = (req: Request, _res: Response, next: NextFunction): void => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    
    if (typeof token !== "string" || token.length === 0) {
        next(ApiError.unauthorized());
        return;
    }

    const user = verifyAuthToken(token);

    if (!user) {
        next(ApiError.unauthorized("Invalid or expired session"));
        return;
    }

    req.user = user;

    next();
};
