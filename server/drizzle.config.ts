import { env } from "./src/config/env.js";
import { defineConfig } from "drizzle-kit";

const url = env.DATABASE_URL_DIRECT || env.DATABASE_URL;

if (!url) {
    throw new Error(
        "drizzle-kit: set DATABASE_URL_DIRECT or DATABASE_URL in server/.env before running migrations"
    );
}

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url },
});
