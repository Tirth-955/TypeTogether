import { Server as SocketServer } from "socket.io";
import type { Socket } from "socket.io";

import type { AuthUser } from "../types/auth.js";

export interface ClientToServerEvents {
    "document:join": (
        payload: { docId: string; clientId: number },
        ack: (response: DocumentJoinAck) => void
    ) => void;
    "document:sync_step1": (payload: { docId: string; stateVector: Uint8Array }) => void;
    "document:sync_step2": (payload: { docId: string; diff: Uint8Array }) => void;
    "document:update": (payload: { docId: string; update: Uint8Array }) => void;
    "awareness:update": (payload: { docId: string; update: Uint8Array }) => void;
    "document:rename": (
        payload: { docId: string; title: string },
        ack?: (response: { ok: boolean; title?: string; message?: string }) => void
    ) => void;
}

export interface ServerToClientEvents {
    "session:init": (payload: { authenticated: boolean }) => void;
    "document:sync_step1": (payload: { docId: string; stateVector: Uint8Array }) => void;
    "document:sync_step2": (payload: { docId: string; diff: Uint8Array }) => void;
    "document:update": (payload: { docId: string; update: Uint8Array }) => void;
    "awareness:update": (payload: { docId: string; update: Uint8Array }) => void;
    "document:error": (payload: { code: string; message: string }) => void;
    "document:rename": (payload: { docId: string; title: string }) => void;
}

export type JoinedDocumentMeta = {
    id: string;
    title: string;
};

export type JoinedUserMeta = {
    id: string | null;
    displayName: string;
};

export type DocumentJoinAck =
    | { ok: true; document: JoinedDocumentMeta; user: JoinedUserMeta }
    | { ok: false; code: string; message: string };

declare module "socket.io" {
    interface SocketData {
        user: AuthUser | null;
        docId: string | null;
        clientId: number | null;
    }
}

export type TypedServer = SocketServer<ClientToServerEvents, ServerToClientEvents>;

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
