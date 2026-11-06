/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Backend origin for REST calls. Empty in dev (Vite proxy); Render URL on Vercel. */
    readonly VITE_API_URL?: string;
    /** Backend origin for Socket.IO. Empty in dev; Render URL on Vercel. */
    readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
