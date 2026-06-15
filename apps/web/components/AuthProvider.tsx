"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, SESSION_EXPIRED_EVENT, api, resetSessionExpiryGuard } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const publicRoutes = ["/login", "/criar-conta", "/confirmar-email", "/verifique-email"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = async () => {
    const token = localStorage.getItem("pti_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const current = await api.me();
      setUser(current);
      localStorage.setItem("pti_user", JSON.stringify(current));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem("pti_user");
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch {}
    }
    void refreshUser();
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setLoading(false);
      router.replace("/login");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [router]);

  useEffect(() => {
    const isPublicRoute = publicRoutes.includes(pathname);
    if (!loading && !user && !isPublicRoute) router.replace("/login");
    if (!loading && user && isPublicRoute) router.replace("/dashboard");
  }, [loading, user, pathname, router]);

  const login = async (username: string, password: string) => {
    const result = await api.login(username, password);
    localStorage.setItem("pti_token", result.access_token);
    localStorage.setItem("pti_user", JSON.stringify(result.user));
    resetSessionExpiryGuard();
    setUser(result.user);
    router.replace("/dashboard");
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem("pti_token");
    localStorage.removeItem("pti_user");
    resetSessionExpiryGuard();
    setUser(null);
    router.replace("/login");
  };

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
