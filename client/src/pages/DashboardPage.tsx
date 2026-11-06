import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";

import { Header } from "../components/Header";
import { api, getApiErrorMessage, type DocumentListItem } from "../lib/api";
import { useAuth } from "../lib/auth";

export const DashboardPage = () => {
    const { user, loading } = useAuth();
    const [documents, setDocuments] = useState<DocumentListItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            return;
        }

        let cancelled = false;

        api.myDocuments()
            .then((list) => {
                if (!cancelled) {
                    setDocuments(list);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleDeleteDoc = async (id: string, title: string) => {
        if (deletingId) {
            return;
        }

        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) {
            return;
        }

        setDeletingId(id);

        try {
            await api.deleteDocument(id);

            setDocuments((current) => current?.filter((doc) => doc.id !== id) ?? null);

            toast.success(`Deleted "${title}"`);
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setDeletingId(null);
        }
    };

    // Guests work from the homepage.
    if (loading) {
        return (
            <div className="flex min-h-dvh flex-col">
                <Header />
                <main className="mx-auto max-w-2xl px-4 py-12">
                    <p className="text-sm text-muted">Loading…</p>
                </main>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="flex min-h-dvh flex-col">
            <Header />

            <main className="mx-auto w-full max-w-2xl px-4 py-12">
                <h1 className="text-2xl font-semibold">Your documents</h1>
                <p className="mt-1 text-sm text-muted">{user.email}</p>

                {error && <p className="mt-4 text-sm text-danger">{error}</p>}

                {documents === null ? (
                    <p className="mt-4 text-sm text-muted">Loading documents…</p>
                ) : documents.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No saved documents yet.</p>
                ) : (
                    <ul className="mt-4 flex flex-col gap-2">
                        {documents.map((document) => (
                            <li
                                key={document.id}
                                className="flex items-center justify-between rounded-lg border border-border bg-surface"
                            >
                                <Link
                                    to={`/d/${document.id}`}
                                    className="flex-1 rounded-l-lg px-4 py-3 hover:bg-primary/5"
                                >
                                    <span className="font-medium text-text">{document.title}</span>
                                    <span className="mt-0.5 block text-sm text-muted">
                                        {"updated "}
                                        {new Date(document.updatedAt).toLocaleString()}
                                    </span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleDeleteDoc(document.id, document.title)
                                    }
                                    disabled={deletingId === document.id}
                                    className="mr-3 rounded px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                                    title="Delete document"
                                >
                                    {deletingId === document.id ? "Deleting…" : "Delete"}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
};
