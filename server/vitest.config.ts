import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],

        globalSetup: ["tests/globalSetup.ts"],

        setupFiles: ["tests/setupEnv.ts"],

        fileParallelism: false,

        testTimeout: 15_000,
        hookTimeout: 15_000,
    },
});
