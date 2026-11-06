import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export const SaveLoginModal = ({
    onLoggedIn,
    onClose,
}: {
    onLoggedIn: () => void;
    onClose: () => void;
}) => {
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        setSubmitting(true);
        setError(null);

        try {
            await login(email, password);
            onLoggedIn();
        } catch (err) {
            setError(getApiErrorMessage(err));
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="text-lg font-semibold text-text">Log in to save this document</h2>
                <p className="mt-2 text-sm text-muted">
                    Saving requires an account. Anonymous visitors can keep editing via the shared
                    link, but the link expires 24 hours after the last edit unless someone saves it.
                </p>

                <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Email"
                        required
                        autoFocus
                        className="rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        required
                        className="rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover disabled:opacity-60"
                    >
                        {submitting ? "Logging in…" : "Log in and save"}
                    </button>
                </form>

                <p className="mt-4 text-sm text-muted">
                    No account yet?{" "}
                    <Link to="/signup" className="text-primary hover:underline">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
};
