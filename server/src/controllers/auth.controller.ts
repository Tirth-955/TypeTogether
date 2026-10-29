import type { Request, Response } from "express";
import { z } from "zod";

import { AUTH_COOKIE_NAME, authCookieOptions } from "../config/cookies.js";
import * as authService from "../services/auth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { signAuthToken } from "../utils/jwt.js";

const signupSchema = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8).max(72),
});

const loginSchema = z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1).max(72),
});

// Plain async handlers, routes wrap them with asyncHandler.

export const signup = async (req: Request, res: Response) => {
    const { email, password } = signupSchema.parse(req.body);

    const existing = await authService.findUserByEmail(email);
    if (existing) {
        throw ApiError.conflict("An account with this email already exists");
    }

    const created = await authService.createUser(email, password);

    res.status(201)
        .cookie(AUTH_COOKIE_NAME, signAuthToken(created), authCookieOptions)
        .json({ status: "ok", user: created });
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await authService.findUserByEmail(email);

    const valid = user && (await authService.verifyPassword(password, user.passwordHash));

    if (user && valid) {
        res.cookie(AUTH_COOKIE_NAME, signAuthToken(user), authCookieOptions).json({
            status: "ok",
            user: { id: user.id, email: user.email },
        });
        return;
    }

    throw ApiError.unauthorized("Invalid email or password");
};

export const logout = async (_req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME, { path: "/" }).json({ status: "ok" });
};

export const me = async (req: Request, res: Response) => {
    res.json({ status: "ok", user: req.user });
};
