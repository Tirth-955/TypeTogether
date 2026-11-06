import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createDocumentAndOpen } from "../lib/documentCreate";
import { useAuth } from "../lib/auth";

export const Header = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [creating, setCreating] = useState(false);

    const handleNewDocument = async () => {
        if (creating) {
            return;
        }

        setCreating(true);

        try {
            await createDocumentAndOpen(navigate);
        } finally {
            setCreating(false);
        }
    };

    return (
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <Link to="/" className="text-lg font-bold tracking-tight">
                Type<span className="text-primary">Together</span>
            </Link>

            <nav className="flex items-center gap-4 text-sm">
                <button
                    type="button"
                    onClick={() => void handleNewDocument()}
                    disabled={creating}
                    className="rounded-md bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                >
                    {creating ? "Creating…" : "New document"}
                </button>

                {user ? (
                    <>
                        <Link to="/dashboard" className="text-muted hover:text-text">
                            Dashboard
                        </Link>
                        <button
                            type="button"
                            onClick={() => void logout()}
                            className="text-muted hover:text-text"
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="text-muted hover:text-text">
                            Log in
                        </Link>
                        <Link
                            to="/signup"
                            className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-surface-hover"
                        >
                            Sign up
                        </Link>
                    </>
                )}
            </nav>
        </header>
    );
};
