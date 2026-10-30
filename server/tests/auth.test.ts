import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { pool } from "../src/db/client.js";
import { agent, request, truncateAll } from "./helpers.js";

const EMAIL = "alice@example.com";
const PASSWORD = "supersecret123";

const findAuthCookie = (res: { headers: { [k: string]: unknown } }): string | undefined =>
    (res.headers["set-cookie"] as string[] | undefined)?.find((cookie) =>
        cookie.startsWith("tt_auth=")
    );

describe("POST /api/v1/auth/signup", () => {
    it("creates an account and sets an httpOnly auth cookie", async () => {
        const res = await request
            .post("/api/v1/auth/signup")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe("ok");
        expect(res.body.user.email).toBe(EMAIL);
        expect(typeof res.body.user.id).toBe("string");
        expect(res.body.user).not.toHaveProperty("passwordHash");

        const cookie = findAuthCookie(res);
        expect(cookie).toBeDefined();
        expect(cookie).toContain("HttpOnly");
    });

    it("rejects a duplicate email with 409", async () => {
        await request.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });

        const res = await request
            .post("/api/v1/auth/signup")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(409);
        expect(res.body.status).toBe("error");
        expect(res.body.message).toContain("already exists");
    });

    it("rejects a duplicate email regardless of case", async () => {
        await request.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });

        const res = await request
            .post("/api/v1/auth/signup")
            .send({ email: "ALICE@EXAMPLE.COM", password: PASSWORD });

        expect(res.status).toBe(409);
    });

    it("returns 400 with field issues for an invalid email", async () => {
        const res = await request
            .post("/api/v1/auth/signup")
            .send({ email: "not-an-email", password: PASSWORD });

        expect(res.status).toBe(400);
        expect(res.body.status).toBe("error");
        expect(res.body.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: "email" })])
        );
    });

    it("returns 400 for a password shorter than 8 characters", async () => {
        const res = await request
            .post("/api/v1/auth/signup")
            .send({ email: EMAIL, password: "short" });

        expect(res.status).toBe(400);
        expect(res.body.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ path: "password" })])
        );
    });

    it("returns 400 when the body is missing", async () => {
        const res = await request.post("/api/v1/auth/signup").send();

        expect(res.status).toBe(400);
        expect(res.body.status).toBe("error");
    });
});

describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
        await truncateAll();
        await request.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });
    });

    it("logs in with valid credentials and sets the auth cookie", async () => {
        const res = await request
            .post("/api/v1/auth/login")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.user.email).toBe(EMAIL);
        expect(findAuthCookie(res)).toBeDefined();
    });

    it("rejects a wrong password with 401", async () => {
        const res = await request
            .post("/api/v1/auth/login")
            .send({ email: EMAIL, password: "wrongpassword" });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Invalid email or password");
    });

    it("rejects an unknown email with 401 and does not leak account existence", async () => {
        const res = await request
            .post("/api/v1/auth/login")
            .send({ email: "nobody@example.com", password: PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Invalid email or password");
    });

    it("accepts the email in a different case", async () => {
        const res = await request
            .post("/api/v1/auth/login")
            .send({ email: "ALICE@EXAMPLE.COM", password: PASSWORD });

        expect(res.status).toBe(200);
    });
});

describe("GET /api/v1/auth/me", () => {
    it("rejects an unauthenticated request with 401", async () => {
        const res = await request.get("/api/v1/auth/me");

        expect(res.status).toBe(401);
        expect(res.body.status).toBe("error");
    });

    it("rejects a tampered cookie with 401", async () => {
        const res = await request.get("/api/v1/auth/me").set("Cookie", "tt_auth=not.a.valid.jwt");

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Invalid or expired session");
    });

    it("returns the current user for a valid session", async () => {
        const signup = await agent
            .post("/api/v1/auth/signup")
            .send({ email: EMAIL, password: PASSWORD });

        const res = await agent.get("/api/v1/auth/me");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.user.id).toBe(signup.body.user.id);
        expect(res.body.user.email).toBe(EMAIL);
    });
});

describe("POST /api/v1/auth/logout", () => {
    it("clears the session so /me becomes unauthorized", async () => {
        await agent.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });

        const logout = await agent.post("/api/v1/auth/logout");
        expect(logout.status).toBe(200);

        const res = await agent.get("/api/v1/auth/me");
        expect(res.status).toBe(401);
    });
});

afterEach(async () => {
    await truncateAll();
});

afterAll(async () => {
    await pool.end();
});
