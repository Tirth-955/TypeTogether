import { env } from "./src/config/env.js";
import { defineConfig } from "drizzle-kit";

/**
 * Migrations prefer Neon's direct endpoint (DATABASE_URL_DIRECT). The pooled
 * endpoint sits behind PgBouncer and is reserved for the running app.
 */
const url = env.DATABASE_URL_DIRECT || env.DATABASE_URL;

if (!url) {
  throw new Error(
    "drizzle-kit: set DATABASE_URL_DIRECT (preferred) or DATABASE_URL in server/.env before running migrations",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
