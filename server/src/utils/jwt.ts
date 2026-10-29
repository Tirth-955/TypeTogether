import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import type { AuthUser } from "../types/auth.js";

// Session lifetime: 7 days.
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
export const TOKEN_TTL_MS = TOKEN_TTL_SECONDS * 1000;

// HTTP-only cookie holding the JWT sent to / received by Socket.IO
export const AUTH_COOKIE_NAME = "tt_auth";

export const signAuthToken = (user: { id: string; email: string }): string =>
    jwt.sign({ email: user.email }, env.JWT_SECRET, {
        subject: user.id,
        expiresIn: TOKEN_TTL_SECONDS,
    });

export const verifyAuthToken = (token: string): AuthUser | null => {
    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as {
            sub?: string;
            email?: string;
        };

        if (!payload.sub || !payload.email) {
            return null;
        }

        return {
            id: payload.sub,
            email: payload.email,
        };
    } catch {
        return null;
    }
};
