import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    PORT: z.coerce.number().int().positive().default(3000),

    CORS_ORIGIN: z.string().default("http://localhost:5173"),

    DATABASE_URL: z
        .string()
        .min(1)
        .refine(
            (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
            "DATABASE_URL must be a PostgreSQL connection string"
        ),

    DATABASE_URL_DIRECT: z.string().min(1).default(""),

    JWT_SECRET: z.string().min(1).default("dev-only-change-me"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment configuration:", z.treeifyError(parsed.error));
    process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
