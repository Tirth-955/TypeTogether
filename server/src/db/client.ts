import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
});

export const db = drizzle(pool, { schema });

const TRANSIENT_CONNECTION_ERROR =
    /Connection terminated|Connection terminated unexpectedly|ECONNRESET|EPIPE|ETIMEDOUT/i;

const isTransient = (error: unknown): boolean =>
    [error, (error as { cause?: unknown }).cause].some(
        (e) => e instanceof Error && TRANSIENT_CONNECTION_ERROR.test(e.message)
    );

export const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
        return await fn();
    } catch (error) {
        if (!isTransient(error)) throw error;
        return fn();
    }
};
