import { env } from "./env.js";
import { TOKEN_TTL_MS } from "../utils/jwt.js";

export const AUTH_COOKIE_NAME = "tt_auth";

export const authCookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: TOKEN_TTL_MS,
} as const;

export const authCookieClearOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/",
} as const;
