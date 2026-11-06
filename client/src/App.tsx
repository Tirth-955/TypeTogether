import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { RequireGuest } from "./components/RequireGuest";
import { AuthProvider } from "./lib/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";

export const App = () => (
    <BrowserRouter>
        <AuthProvider>
            <main className="min-h-dvh bg-bg text-text">
                <Routes>
                    <Route path="/" element={<HomePage />} />

                    <Route element={<RequireGuest />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                    </Route>

                    <Route path="/d/:docId" element={<EditorPage />} />

                    <Route path="/dashboard" element={<DashboardPage />} />

                    <Route
                        path="*"
                        element={
                            <div className="mx-auto max-w-2xl px-4 py-12">
                                <h1 className="text-2xl font-semibold">Not found</h1>
                                <Link to="/" className="text-sm text-primary">
                                    Go to homepage
                                </Link>
                            </div>
                        }
                    />
                </Routes>
            </main>

            <Toaster
                position="top-center"
                toastOptions={{
                    style: {
                        background: "var(--color-surface)",
                        color: "var(--color-text)",
                        border: "1px solid var(--color-border)",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                        fontSize: "14px",
                    },
                }}
            />
        </AuthProvider>
    </BrowserRouter>
);
