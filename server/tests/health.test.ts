import { afterAll, describe, expect, it } from "vitest";

import { pool } from "../src/db/client.js";
import { request } from "./helpers.js";

describe("GET /health", () => {
    it("reports ok including the database connection", async () => {
        const res = await request.get("/health");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.database).toBe("connected");
        expect(typeof res.body.instance).toBe("string");
    });
});

describe("unknown routes", () => {
    it("returns a consistent JSON 404", async () => {
        const res = await request.get("/api/v1/does-not-exist");

        expect(res.status).toBe(404);
        expect(res.body.status).toBe("error");
        expect(res.body.message).toBe("Route not found");
        expect(res.body.path).toBe("/api/v1/does-not-exist");
    });
});

afterAll(async () => {
    await pool.end();
});
