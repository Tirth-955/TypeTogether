import http from "node:http";

import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";
import { initSocket } from "./realtime/socketServer.js";
import { startRetentionCheckpointLoop } from "./realtime/checkpoint.js";
import { startExpirySweepLoop } from "./realtime/expirySweep.js";

const PORT = env.PORT;

try {
    await pool.query("SELECT 1");
    console.log("Database connection OK");
} catch (error) {
    console.error("Could not reach the database:", error);
    process.exit(1);
}

// Socket.IO shares the Express HTTP server, one port for REST and real-time.
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

startRetentionCheckpointLoop();
startExpirySweepLoop(io);

httpServer.listen(PORT, () => {
    console.log(`TypeTogether server listening on http://localhost:${PORT} (${env.NODE_ENV})`);
});
