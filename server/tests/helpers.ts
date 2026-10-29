import supertest from "supertest";
import { sql } from "drizzle-orm";

import app from "../src/app.js";
import { db } from "../src/db/client.js";

export const request = supertest(app);

export const agent = supertest.agent(app);

export const truncateAll = async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
};
