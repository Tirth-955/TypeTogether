import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { Header } from "../components/Header";
import { useAuth } from "../lib/auth";
import { createDocumentAndOpen } from "../lib/documentCreate";

const features = [
    {
        title: "Real-time editing",
        body: "Multiple people typing in the same document at once, with changes synced live over WebSockets.",
    },
    {
        title: "No login required",
        body: "Start working immediately without creating an account or signing in. Login is optional.",
    },
    {
        title: "Shareable links",
        body: "Every document gets a shareable link. Share it and collaborators can join instantly.",
    },
];

export const HomePage = () => {
    const { user } = useAuth();
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
        <div className="flex min-h-dvh flex-col">
            <Header />

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                    Write together,
                    <span className="text-primary"> in real time.</span>
                </h1>
                <p className="mt-4 max-w-xl text-muted">
                    {user
                        ? "You are logged in. Create a new document or open your saved documents from the dashboard."
                        : "Create documents without an account — the share link is the only thing anyone needs. Log in to keep a list of your saved documents and to make links permanent by saving."}
                </p>

                <ul className="mt-16 grid gap-x-8 gap-y-6 sm:grid-cols-3">
                    {features.map((f) => (
                        <li
                            key={f.title}
                            className="rounded-lg border border-border bg-surface p-5"
                        >
                            <h2 className="font-semibold">{f.title}</h2>
                            <p className="mt-2 text-sm text-muted">{f.body}</p>
                        </li>
                    ))}
                </ul>
            </main>

            <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted">
                TypeTogether — Real-Time Collaborative Editor
            </footer>
        </div>
    );
};
