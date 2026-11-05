import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { api, type User } from "./api";

type AuthState = {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setUser(await api.me());
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const login = useCallback(async (email: string, password: string) => {
        setUser(await api.login(email, password));
    }, []);

    const signup = useCallback(async (email: string, password: string) => {
        setUser(await api.signup(email, password));
    }, []);

    const logout = useCallback(async () => {
        await api.logout();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthState => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside <AuthProvider>");
    }

    return context;
};
