import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export const LoginPage = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

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
            navigate(from, { replace: true });
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="mx-auto flex h-dvh max-w-sm flex-col justify-center gap-6 px-4">
            <h1 className="text-2xl font-semibold">Log in</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    {submitting ? "Logging in…" : "Log in"}
                </button>
            </form>
            <p className="text-sm text-gray-500">
                No account yet?{" "}
                <Link to="/signup" className="text-blue-600">
                    Sign up
                </Link>
            </p>
        </main>
    );
};
