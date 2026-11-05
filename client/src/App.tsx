import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import { RequireGuest } from "./components/RequireGuest";
import { AuthProvider } from "./lib/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";

export const App = () => (
    <BrowserRouter>
        <AuthProvider>
            <main className="min-h-dvh bg-gray-50 text-gray-900">
                <Routes>
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
                                <Link to="/dashboard" className="text-sm text-blue-600">
                                    Go to dashboard
                                </Link>
                            </div>
                        }
                    />
                </Routes>
            </main>
        </AuthProvider>
    </BrowserRouter>
);
