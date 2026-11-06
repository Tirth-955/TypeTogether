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
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <Link to="/" className="text-base font-bold tracking-tight sm:text-lg">
                Type<span className="text-primary">Together</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:gap-x-4">
                <button
                    type="button"
                    onClick={() => void handleNewDocument()}
                    disabled={creating}
                    className="rounded-md bg-primary px-2.5 py-1.5 font-medium text-white hover:bg-primary-hover disabled:opacity-60 sm:px-3"
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
                            className="rounded-md border border-border px-2.5 py-1.5 font-medium hover:bg-surface-hover sm:px-3"
                        >
                            Sign up
                        </Link>
                    </>
                )}
            </nav>
        </header>
    );
};
