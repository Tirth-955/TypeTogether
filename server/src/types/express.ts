// Extends Express' Request type with the authenticated user that
// middleware/authGuard attaches after verifying the cookie.
// Keep this shape in sync with types/auth.ts (AuthUser).
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
            };
        }
    }
}

export {};
