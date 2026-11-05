import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
            },
            // Socket.IO (websockets) shares the Express port on the server.
            "/socket.io": {
                target: "http://localhost:3000",
                changeOrigin: true,
                ws: true,
            },
        },
    },
});
