import { env } from "./env.js";
import { TOKEN_TTL_MS } from "../utils/jwt.js";

// HTTP-only cookie carrying the JWT. SameSite=lax works for localhost dev (same site, different ports).
export const AUTH_COOKIE_NAME = "tt_auth";

export const authCookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_MS,
} as const;
