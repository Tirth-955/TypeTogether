import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../lib/auth";

export const RequireGuest = () => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <p className="text-sm text-gray-500">Loading…</p>;
    }

    if (user) {
        return <Navigate to="/dashboard" state={{ from: location.pathname }} replace />;
    }

    return <Outlet />;
};
