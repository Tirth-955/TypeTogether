import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage, type CreatedDocument, type DocumentListItem } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CreateDocumentModal } from "../components/CreateDocumentModal";

export const DashboardPage = () => {
    const { user, loading, logout } = useAuth();
    const [documents, setDocuments] = useState<DocumentListItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

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
                    setError(getApiErrorMessage(err));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleCreated = (created: CreatedDocument) => {
        setDocuments((current) =>
            current
                ? [
                      {
                          id: created.id,
                          title: created.title,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                      },
                      ...current,
                  ]
                : current
        );
    };

    if (loading) {
        return (
            <main className="mx-auto max-w-2xl px-4 py-12">
                <p className="text-sm text-gray-500">Loading…</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-2xl px-4 py-12">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{user ? "Your documents" : "Dashboard"}</h1>
                <span className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                    >
                        New document
                    </button>
                    {user ? (
                        <>
                            <span className="text-sm text-gray-500">{user.email}</span>
                            <button
                                type="button"
                                onClick={() => void logout()}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
                            >
                                Log out
                            </button>
                        </>
                    ) : (
                        <span className="text-sm text-gray-500">
                            <Link to="/login" className="text-blue-600">
                                Log in
                            </Link>
                            {" · "}
                            <Link to="/signup" className="text-blue-600">
                                Sign up
                            </Link>
                        </span>
                    )}
                </span>
            </header>

            {!user && (
                <p className="mt-4 text-sm text-gray-500">
                    Create documents without an account — the share link is the only thing anyone
                    needs. Log in to keep a list of your saved documents and to make links permanent
                    by saving.
                </p>
            )}

            {user && (
                <>
                    {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                    {documents === null ? (
                        <p className="mt-4 text-sm text-gray-500">Loading documents…</p>
                    ) : documents.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-500">No saved documents yet.</p>
                    ) : (
                        <ul className="mt-4 flex flex-col gap-2">
                            {documents.map((document) => (
                                <li
                                    key={document.id}
                                    className="rounded-lg border border-gray-200 bg-white"
                                >
                                    <Link
                                        to={`/d/${document.id}`}
                                        className="block rounded-lg px-4 py-3 hover:bg-blue-50"
                                    >
                                        <span className="font-medium">{document.title}</span>
                                        <span className="mt-0.5 block text-sm text-gray-500">
                                            {"updated "}
                                            {new Date(document.updatedAt).toLocaleString()}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {creating && (
                <CreateDocumentModal onClose={() => setCreating(false)} onCreated={handleCreated} />
            )}
        </main>
    );
};
