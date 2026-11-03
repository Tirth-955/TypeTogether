import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { io as ioClient } from "socket.io-client";

import app from "../src/app.js";
import { db } from "../src/db/client.js";
import { initSocket, type TypedServer } from "../src/realtime/socketServer.js";
import { agent, request, truncateAll } from "./helpers.js";

const EMAIL = "socket@example.com";
const PASSWORD = "supersecret123";

let httpServer: Server;
let socketIo: TypedServer;
let url = "";

// Connect a client and await the handshake acknowledgment event.
const awaitSessionInit = (extraHeaders?: Record<string, string>) =>
    new Promise<{ authenticated: boolean }>((resolve, reject) => {
        const socket = ioClient(url, { extraHeaders });
        socket.on("session:init", (payload) => {
            socket.disconnect();
            resolve(payload);
        });
        socket.on("connect_error", (error) => {
            socket.disconnect();
            reject(error);
        });
    });

// The signup response sets the HTTP-only cookie; pull out "tt_auth=<token>".
const authCookieHeader = (res: { headers: { [k: string]: unknown } }): string => {
    const cookie = (res.headers["set-cookie"] as string[]).find((entry) =>
        entry.startsWith("tt_auth=")
    );

    if (!cookie) throw new Error("auth cookie missing from signup response");
    return cookie.split(";")[0];
};

beforeAll(async () => {
    httpServer = createServer(app);
    socketIo = initSocket(httpServer);

    await new Promise<void>((resolve) => {
        httpServer.listen(0, () => resolve());
    });

    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

// Guest connections are live-collaboration users with no session; JWT-backed
// sessions identify themselves for presence later.
describe("socket handshake identity", () => {
    afterEach(truncateAll);

    it("welcomes an anonymous guest with authenticated: false", async () => {
        const payload = await awaitSessionInit();

        expect(payload.authenticated).toBe(false);
    });

    it("identifies a logged-in user from the tt_auth cookie", async () => {
        await agent.post("/api/v1/auth/signup").send({ email: EMAIL, password: PASSWORD });
        const cookie = authCookieHeader(
            await request.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD })
        );

        const payload = await awaitSessionInit({ cookie });

        expect(payload.authenticated).toBe(true);
    });

    it("treats a tampered cookie as a guest, not an error", async () => {
        const payload = await awaitSessionInit({ cookie: "tt_auth=bogus.token.value" });

        expect(payload.authenticated).toBe(false);
    });
});

afterAll(async () => {
    socketIo.close();
    httpServer.close();
    await db.$client.end();
});
