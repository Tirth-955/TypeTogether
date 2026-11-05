import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";

export type CollabDocumentMeta = {
    id: string;
    title: string;
    docType: "text" | "markdown" | "code";
    language: string | null;
};

export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export type Collaborator = {
    clientId: number;
    name: string;
    color: string;
};

type JoinAck = {
    ok: boolean;
    document?: CollabDocumentMeta;
    user?: { id: string | null; displayName: string };
    code?: string;
    message?: string;
};

type SyncPayload = { docId: string; stateVector: Uint8Array };
type DiffPayload = { docId: string; diff: Uint8Array };
type UpdatePayload = { docId: string; update: Uint8Array };
type ErrorPayload = { code: string; message: string };

export type CollabProviderOptions = {
    onError?: (message: string) => void;
    onJoinError?: (code: string, message: string) => void;
    onConnectionChange?: (status: ConnectionStatus) => void;
};

const AWARENESS_COLORS = [
    "#e11d48",
    "#2563eb",
    "#0d9488",
    "#ca8a04",
    "#7c3aed",
    "#db2777",
    "#059669",
    "#ea580c",
] as const;

export const cursorColorFor = (clientId: number): string =>
    AWARENESS_COLORS[clientId % AWARENESS_COLORS.length];

export class CollabProvider {
    readonly ydoc = new Y.Doc();
    readonly awareness = new Awareness(this.ydoc);
    readonly text = this.ydoc.getText("content"); // same key as server CONTENT_TEXT_KEY

    private readonly docId: string;
    private readonly socket: Socket;
    private readonly onError: (message: string) => void;
    private readonly onJoinError: (code: string, message: string) => void;
    private readonly onConnectionChange: (status: ConnectionStatus) => void;
    private connectionStatus: ConnectionStatus = "connecting";
    private joined = false;

    constructor(docId: string, options: CollabProviderOptions = {}) {
        this.docId = docId;
        this.onError = options.onError ?? (() => undefined);
        this.onJoinError = options.onJoinError ?? (() => undefined);
        this.onConnectionChange = options.onConnectionChange ?? (() => undefined);

        this.socket = io({ withCredentials: true });

        const ydoc = this.ydoc;
        const awareness = this.awareness;

        const setConnection = (status: ConnectionStatus): void => {
            if (this.connectionStatus !== status) {
                this.connectionStatus = status;
                this.onConnectionChange(status);
            }
        };

        ydoc.on("update", (update: Uint8Array, origin: unknown) => {
            if (origin === "remote") {
                return;
            }
            this.socket.emit("document:update", { docId, update });
        });

        this.socket.on("document:update", (payload: UpdatePayload) => {
            if (payload.docId !== docId) {
                return;
            }
            Y.applyUpdate(ydoc, new Uint8Array(payload.update), "remote");
        });

        this.socket.on("document:sync_step2", (payload: DiffPayload) => {
            if (payload.docId !== docId) {
                return;
            }
            Y.applyUpdate(ydoc, new Uint8Array(payload.diff), "remote");
        });

        this.socket.on("document:sync_step1", (payload: SyncPayload) => {
            console.log("[tt] sync_step1 received"); // TEMP-DEBUG
            if (payload.docId !== docId) {
                return;
            }
            const diff = Y.encodeStateAsUpdate(ydoc, new Uint8Array(payload.stateVector));
            this.socket.emit("document:sync_step2", { docId, diff });
            this.socket.emit("document:sync_step1", {
                docId,
                stateVector: Y.encodeStateVector(ydoc),
            });
        });

        this.socket.on("awareness:update", (payload: UpdatePayload) => {
            if (payload.docId !== docId) {
                return;
            }
            applyAwarenessUpdate(awareness, new Uint8Array(payload.update), "remote");
        });

        awareness.on(
            "update",
            ({
                added,
                updated,
                removed,
            }: {
                added: number[];
                updated: number[];
                removed: number[];
            }) => {
                const changed: number[] = [...added, ...updated, ...removed];
                if (changed.length === 0) {
                    return;
                }

                if (!this.joined) {
                    return;
                }

                this.socket.emit("awareness:update", {
                    docId,
                    update: encodeAwarenessUpdate(awareness, changed),
                });
            }
        );

        this.socket.on("document:error", (payload: ErrorPayload) => {
            console.log("[tt] document:error", payload); // TEMP-DEBUG
            this.onError(payload.message);
        });

        const join = () => {
            console.log("[tt] connected, sending document:join", docId); // TEMP-DEBUG
            this.socket.emit(
                "document:join",
                { docId, clientId: ydoc.clientID },
                (ack: JoinAck) => {
                    console.log("[tt] join ack:", ack); // TEMP-DEBUG

                    if (!ack || !ack.ok) {
                        this.onJoinError(
                            ack?.code ?? "error",
                            ack?.message ?? "Failed to join the document"
                        );
                        return;
                    }

                    this.joined = true;

                    if (ack.user?.displayName) {
                        this.setLocalIdentity(ack.user.displayName);
                    }

                    this.socket.emit("awareness:update", {
                        docId,
                        update: encodeAwarenessUpdate(awareness, [ydoc.clientID]),
                    });
                }
            );
        };

        this.socket.on("connect", () => {
            this.joined = false; // must re-join before broadcasting again
            setConnection("connected");
            join();
        });

        this.socket.on("disconnect", () => {
            this.joined = false;
            setConnection("disconnected");
        });

        this.socket.io.on("reconnect_attempt", () => setConnection("reconnecting"));

        this.socket.on("connect_error", (error: Error) => {
            console.log("[tt] connect_error:", error.message); // TEMP-DEBUG
            setConnection("reconnecting");
            this.onError(`Real-time connection failed: ${error.message}`);
        });
    }

    get connection(): ConnectionStatus {
        return this.connectionStatus;
    }

    listCollaborators(): Collaborator[] {
        const collaborators: Collaborator[] = [];

        this.awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
            const user = state.user as { name?: unknown; color?: unknown } | undefined;

            if (user && typeof user.name === "string") {
                collaborators.push({
                    clientId,
                    name: user.name,
                    color: typeof user.color === "string" ? user.color : "#6b7280",
                });
            }
        });

        return collaborators;
    }

    setLocalIdentity(name: string): void {
        this.awareness.setLocalStateField("user", {
            name,
            color: cursorColorFor(this.ydoc.clientID),
        });
    }

    destroy(): void {
        this.socket.removeAllListeners();
        this.socket.io.removeAllListeners();
        this.socket.disconnect();
        this.awareness.destroy();
        this.ydoc.destroy();
    }
}
