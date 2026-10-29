import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Only this folder holds tests.
        include: ["tests/**/*.test.ts"],
        // Creates typetogether_test and runs migrations once before all test files.
        globalSetup: ["tests/globalSetup.ts"],
        // Loads .env and repoints DATABASE_URL at the test database before env.ts is imported.
        setupFiles: ["tests/setupEnv.ts"],
    },
});
