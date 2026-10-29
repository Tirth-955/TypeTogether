import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import "./setupEnv.js";
import { env } from "../src/config/env.js";

// Creates the test database if needed and applies Drizzle migrations, once per run.
// Vitest 5 requires globalSetup to provide a default-exported setup function.

const TEST_DB = "typetogether_test";

export default async function setup() {
    // Connect to the maintenance database on the same server to create the test database.
    const adminUrl = env.DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/postgres$1");

    const adminPool = new Pool({ connectionString: adminUrl });

    try {
        await adminPool.query(`CREATE DATABASE ${TEST_DB}`);
        console.log(`Created test database ${TEST_DB}`);
    } catch (error) {
        // 42P04 = duplicate_database: the database already exists, which is fine.
        if ((error as { code?: string }).code !== "42P04") {
            throw error;
        }
    } finally {
        await adminPool.end();
    }

    const db = drizzle(new Pool({ connectionString: env.DATABASE_URL }));

    try {
        await migrate(db, { migrationsFolder: "drizzle" });
    } finally {
        await db.$client.end();
    }
}
