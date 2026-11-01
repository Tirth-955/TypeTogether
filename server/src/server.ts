import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";

const PORT = env.PORT;

try {
    await pool.query("SELECT 1");
    console.log("Database connection OK");
} catch (error) {
    console.error("Could not reach the database:", error);
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(`TypeTogether server listening on http://localhost:${PORT} (${env.NODE_ENV})`);
});
