import type { AuthUser } from "../types/auth.js";

export const getDisplayName = (user: AuthUser | null): string => {
    if (!user) {
        return "Guest";
    }

    return user.email.split("@")[0] || user.email;
};
