import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export const SignupPage = () => {
    const { signup } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        setSubmitting(true);
        setError(null);

        try {
            await signup(email, password);
            navigate("/dashboard");
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="mx-auto flex h-dvh max-w-sm flex-col justify-center gap-6 px-4">
            <h1 className="text-2xl font-semibold">Sign up</h1>
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
                    placeholder="Password (min. 8 characters)"
                    minLength={8}
                    required
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {submitting ? "Creating account…" : "Sign up"}
                </button>
            </form>
            <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link to="/login" className="text-blue-600">
                    Log in
                </Link>
            </p>
        </main>
    );
};
