/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

if (!url) {
    throw new Error(
        "drizzle-kit: set DATABASE_URL_DIRECT (preferred) or DATABASE_URL in server/.env before running migrations"
    );
}

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url },
});
