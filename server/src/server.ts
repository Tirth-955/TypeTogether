import app from "./app.js";
import { env } from "./config/env.js";

const PORT = env.PORT;

app.listen(PORT, () => {
    console.log(`TypeTogether server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
