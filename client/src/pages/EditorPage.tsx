import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";

import { api, getApiErrorMessage, getApiErrorStatus, type DocumentDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CollabProvider, type Collaborator, type ConnectionStatus } from "../lib/collabProvider";
import { editorExtensions } from "../lib/codemirrorSetup";
import { Header } from "../components/Header";
import { SaveLoginModal } from "../components/SaveLoginModal";

const connectionView: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
    connected: { label: "Live", dot: "bg-emerald-500", text: "text-emerald-400" },
    connecting: { label: "Connecting…", dot: "bg-muted", text: "text-muted" },
    reconnecting: { label: "Reconnecting…", dot: "bg-amber-500", text: "text-amber-400" },
    disconnected: { label: "Offline", dot: "bg-danger", text: "text-danger" },
};

export const EditorPage = () => {
    const { docId } = useParams<{ docId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const editorHost = useRef<HTMLDivElement | null>(null);
    const providerRef = useRef<CollabProvider | null>(null);

    const [document, setDocument] = useState<DocumentDetail | null>(null);
    const [titleInput, setTitleInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [connection, setConnection] = useState<ConnectionStatus>("connecting");
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [localClientId, setLocalClientId] = useState(0);
    const [dirty, setDirty] = useState(false);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showSaveLogin, setShowSaveLogin] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (document) {
            setTitleInput(document.title);
        }
    }, [document?.title]);

    const handleRename = async (): Promise<void> => {
        const trimmed = titleInput.trim();

        if (!trimmed || !docId) {
            if (document) {
                setTitleInput(document.title);
            }
            return;
        }

        if (document && trimmed === document.title) {
            return;
        }

        try {
            await api.updateTitle(docId, trimmed);
            providerRef.current?.renameDocument(trimmed);
            setDocument((current) => (current ? { ...current, title: trimmed } : current));
        } catch (err) {
            setError(getApiErrorMessage(err));
            if (document) {
                setTitleInput(document.title);
            }
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!docId || deleting) {
            return;
        }

        if (
            !window.confirm("Are you sure you want to delete this document? This cannot be undone.")
        ) {
            return;
        }

        setDeleting(true);

        try {
            await api.deleteDocument(docId);
            navigate("/dashboard");
        } catch (err) {
            setError(getApiErrorMessage(err));
            setDeleting(false);
        }
    };

    const performSave = async (): Promise<void> => {
        if (!document || saving) {
            return;
        }

        const provider = providerRef.current;
        const payload = {
            content: provider ? provider.text.toString() : document.content,
            title: titleInput.trim() || document.title,
        };

        setSaving(true);
        setSaveError(null);

        try {
            const result = await api.saveDocument(docId!, payload);

            setDocument((current) =>
                current
                    ? {
                          ...current,
                          title: payload.title,
                          content: payload.content,
                          saved: result.saved,
                          updatedAt: result.updatedAt,
                      }
                    : current
            );
            setDirty(false);
            setShowSaveLogin(false);
        } catch (err) {
            if (getApiErrorStatus(err) === 401) {
                setShowSaveLogin(true);
            } else {
                setSaveError(getApiErrorMessage(err));
                setShowSaveLogin(false);
            }
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!docId) {
            return;
        }

        setDocument(null);
        setError(null);

        let cancelled = false;

        api.getDocument(docId)
            .then((detail) => {
                if (!cancelled) {
                    setDocument(detail);
                    setTitleInput(detail.title);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(getApiErrorMessage(err));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [docId]);

    useEffect(() => {
        if (!docId || !document || !editorHost.current) {
            return;
        }

        let cancelled = false;
        let view: EditorView | null = null;
        let provider: CollabProvider | null = null;

        try {
            provider = new CollabProvider(docId, {
                onError: (message) => {
                    if (!cancelled) {
                        setError(message);
                    }
                },
                onJoinError: (code, message) => {
                    if (!cancelled) {
                        setError(message);
                        void code;
                    }
                },
                onConnectionChange: (status) => {
                    if (!cancelled) {
                        setConnection(status);
                    }
                },
                onTitleChange: (newTitle) => {
                    if (!cancelled) {
                        setTitleInput(newTitle);
                        setDocument((current) =>
                            current ? { ...current, title: newTitle } : current
                        );
                    }
                },
            });
            providerRef.current = provider;
            setLocalClientId(provider.ydoc.clientID);
            setDirty(false);
            setConnection(provider.connection);
            provider.setLocalIdentity(
                user ? user.email : `Guest ${provider.ydoc.clientID % 10_000}`
            );

            const sharedText = provider.text;

            view = new EditorView({
                state: EditorState.create({
                    doc: sharedText.toString(),
                    extensions: [
                        ...editorExtensions(),
                        yCollab(sharedText, provider.awareness, {
                            undoManager: new Y.UndoManager(sharedText),
                        }),
                    ],
                }),
                parent: editorHost.current,
            });

            const refreshPresence = () => {
                if (!cancelled) {
                    setCollaborators(provider.listCollaborators());
                }
            };
            provider.awareness.on("update", refreshPresence);
            refreshPresence();

            provider.ydoc.on("update", (_update: Uint8Array, origin: unknown) => {
                if (origin !== "remote" && !cancelled) {
                    setDirty(true);
                }
            });
        } catch (err) {
            if (!cancelled) {
                setError(getApiErrorMessage(err));
            }
        }

        return () => {
            cancelled = true;
            view?.destroy();
            provider?.destroy();

            if (providerRef.current === provider) {
                providerRef.current = null;
            }
        };
    }, [docId, document?.id, user]);

    if (error && !document) {
        return (
            <div className="flex h-dvh flex-col">
                <Header />
                <main className="mx-auto max-w-2xl px-4 py-12">
                    <h1 className="mt-4 text-2xl font-semibold">Document unavailable</h1>
                    <p className="mt-2 text-sm text-danger">{error}</p>
                    <p className="mt-4 text-sm text-muted">
                        The link may be unknown, or it may have been deleted or expired without
                        being saved.
                    </p>
                </main>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="flex h-dvh flex-col">
                <Header />
                <main className="mx-auto max-w-2xl px-4 py-12">
                    <p className="text-sm text-muted">Loading document…</p>
                </main>
            </div>
        );
    }

    const status = connectionView[connection];

    return (
        <div className="flex h-dvh flex-col">
            <Header />

            <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-4 py-4">
                <header className="flex items-center justify-between gap-3 pb-3">
                    <span className="flex min-w-0 items-center gap-3">
                        <input
                            type="text"
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            onBlur={() => void handleRename()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                }
                            }}
                            maxLength={120}
                            placeholder="Untitled document"
                            className="w-44 sm:w-64 md:w-80 truncate rounded border border-transparent bg-transparent px-1.5 py-0.5 text-lg font-semibold text-text transition-colors hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                            title="Click to rename"
                        />
                    </span>

                    <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => void performSave()}
                            disabled={saving}
                            className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
                        >
                            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
                        </button>

                        {user && (
                            <button
                                type="button"
                                onClick={() => void handleDelete()}
                                disabled={deleting}
                                className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
                                title="Delete this document"
                            >
                                {deleting ? "Deleting…" : "Delete"}
                            </button>
                        )}

                        {dirty || !document.saved ? (
                            <span
                                className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${
                                    dirty
                                        ? "bg-amber-500/15 text-amber-300"
                                        : "bg-surface-hover text-muted"
                                }`}
                            >
                                {dirty ? "Unsaved changes" : "Unsaved"}
                            </span>
                        ) : null}

                        <span className="flex items-center">
                            {collaborators.map((collaborator) => (
                                <span
                                    key={collaborator.clientId}
                                    title={
                                        collaborator.clientId === localClientId
                                            ? `${collaborator.name} (you)`
                                            : collaborator.name
                                    }
                                    style={{ backgroundColor: collaborator.color }}
                                    className="-ml-1.5 inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-bg text-[11px] font-bold text-white first:ml-0"
                                >
                                    {collaborator.name.trim().charAt(0).toUpperCase() || "?"}
                                </span>
                            ))}
                        </span>

                        <span className="hidden items-center gap-1.5 text-xs sm:flex">
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            <span className={status.text}>{status.label}</span>
                        </span>
                    </span>
                </header>

                {(error ?? saveError) && (
                    <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                        {error ?? saveError}
                    </p>
                )}

                {showSaveLogin && (
                    <SaveLoginModal
                        onLoggedIn={() => void performSave()}
                        onClose={() => setShowSaveLogin(false)}
                    />
                )}

                <div className="min-h-0 flex-1">
                    <div
                        ref={editorHost}
                        className="h-full min-w-0 overflow-hidden rounded-lg border border-border bg-surface"
                    />
                </div>
            </main>
        </div>
    );
};
