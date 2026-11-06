import { Link } from "react-router-dom";

import { useAuth } from "../lib/auth";

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

    return (
        <div className="flex min-h-dvh flex-col">
            <header className="flex items-center justify-between border-b border-border px-6 py-4">
                <span className="text-lg font-bold tracking-tight">
                    Type<span className="text-primary">Together</span>
                </span>
                <nav className="flex items-center gap-4 text-sm">
                    {user ? (
                        <Link to="/dashboard" className="text-muted hover:text-text">
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link to="/login" className="text-muted hover:text-text">
                                Log in
                            </Link>
                            <Link
                                to="/signup"
                                className="rounded-md bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover"
                            >
                                Sign up
                            </Link>
                        </>
                    )}
                </nav>
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                    Write together,
                    <span className="text-primary"> in real time.</span>
                </h1>
                <p className="mt-4 max-w-xl text-muted">
                    TypeTogether is a real-time collaborative markdown editor. Create a document,
                    share the link, and start typing together — straight in your browser.
                </p>

                <div className="mt-8 flex items-center gap-4">
                    <Link
                        to={user ? "/dashboard" : "/signup"}
                        className="rounded-md bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover"
                    >
                        {user ? "Open dashboard" : "Get started"}
                    </Link>
                    {!user && (
                        <Link
                            to="/login"
                            className="rounded-md border border-border px-5 py-2.5 text-muted hover:text-text"
                        >
                            Log in
                        </Link>
                    )}
                </div>

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
                TypeTogether — real-time collaborative markdown editor
            </footer>
        </div>
    );
};
