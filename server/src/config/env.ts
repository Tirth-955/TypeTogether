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

    LINK_RETENTION_HOURS: z.coerce.number().int().positive().max(168).default(24),
});

const loadEnv = () => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        console.error("Invalid environment configuration:", z.treeifyError(error as z.ZodError));
        process.exit(1);
    }
};

export const env = loadEnv();

if (env.NODE_ENV === "production" && env.JWT_SECRET === "dev-only-change-me") {
    console.error("JWT_SECRET must be changed from its development default in production");
    process.exit(1);
}

export type Env = typeof env;
