import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { users } from "../db/schema.js";

// All database and password-hashing logic for authentication here.

export const findUserByEmail = async (email: string) => {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    return user ?? null;
};

export const createUser = async (email: string, password: string) => {
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id, email: users.email });

    return user;
};

export const verifyPassword = (password: string, passwordHash: string) => {
    bcrypt.compare(password, passwordHash);
};
