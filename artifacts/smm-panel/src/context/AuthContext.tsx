import { createContext, useContext, useEffect, useState } from "react";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { storeToken, clearToken } from "@/lib/token";

export type AuthContextType = {
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession]           = useState<Session | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setSupabaseUser(s?.user ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("[AuthContext] getSession failed:", err?.message ?? err);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSupabaseUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Sync session token with Express backend (best-effort, never blocks auth) ──
  const syncWithBackend = async (email: string, password: string, name?: string) => {
    try {
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      if (!apiBase) return;
      const endpoint = name ? `${apiBase}/api/auth/register` : `${apiBase}/api/auth/login`;
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(name ? { name, email, password } : { email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.token) storeToken(json.token);
    } catch (err) {
      console.warn("[AuthContext] syncWithBackend failed (non-blocking):", err instanceof Error ? err.message : err);
    }
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[AuthContext] login error:", error.message);
      throw error;
    }
    console.log("[AuthContext] login success:", data.user?.email);
    await syncWithBackend(email, password);
  };

  // ── REGISTER ───────────────────────────────────────────────────────────────
  const register = async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      console.error("[AuthContext] register error:", error.message);
      throw error;
    }
    console.log("[AuthContext] register success:", data.user?.email);
    await syncWithBackend(email, password, name);
  };

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut();
    clearToken();
  };

  return (
    <AuthContext.Provider value={{ supabaseUser, session, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return ctx;
}
