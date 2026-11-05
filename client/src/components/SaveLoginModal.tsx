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
                className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="text-lg font-semibold">Log in to save this document</h2>
                <p className="mt-2 text-sm text-gray-500">
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
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        required
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {submitting ? "Logging in…" : "Log in and save"}
                    </button>
                </form>

                <p className="mt-4 text-sm text-gray-500">
                    No account yet?{" "}
                    <Link to="/signup" className="text-blue-600">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
};
