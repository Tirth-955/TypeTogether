import { config } from "dotenv";

config({ quiet: true });

process.env.NODE_ENV = "test";

const devUrl = process.env.DATABASE_URL ?? "";

const match = devUrl.match(/^(postgres(?:ql)?:\/\/[^/?#]+)\/([^/?#]+)(\?.*)?$/);

if (!match) {
    console.error("tests/setupEnv.ts: DATABASE_URL is missing or not a PostgreSQL URL");
    process.exit(1);
}

// Same server and credentials as development, different database name.
process.env.DATABASE_URL = `${match[1]}/typetogether_test${match[3] ?? ""}`;
