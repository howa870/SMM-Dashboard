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

  // ── JWT sync: exchange Supabase JWT for backend session cookie ──────────────
  const jwtSync = async (accessToken: string) => {
    try {
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/auth/jwt-sync`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jwt: accessToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.token) storeToken(json.token);
      if (res.ok) console.log("[AuthContext] jwt-sync OK");
    } catch (err) {
      console.warn("[AuthContext] jwt-sync failed:", err instanceof Error ? err.message : err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setSupabaseUser(s?.user ?? null);
        setIsLoading(false);
        // Restore backend session from Supabase JWT on page load
        if (s?.access_token) jwtSync(s.access_token);
      })
      .catch((err) => {
        console.error("[AuthContext] getSession failed:", err?.message ?? err);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setSupabaseUser(s?.user ?? null);
      // Also sync on sign-in events (e.g. token refresh)
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && s?.access_token) {
        jwtSync(s.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Sync session token with Express backend (best-effort, never blocks auth) ──
  const syncWithBackend = async (email: string, password: string, name?: string) => {
    try {
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const doFetch = async (endpoint: string, body: object) =>
        fetch(endpoint, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

      if (name) {
        // Registration: try register, ignore "already exists" error
        const res = await doFetch(`${apiBase}/api/auth/register`, { name, email, password });
        const json = await res.json().catch(() => ({}));
        if (json.token) storeToken(json.token);
        if (res.ok) { console.log("[AuthContext] backend register OK"); return; }
        // If already registered in backend, fall through to login
      }

      // Login (or fallback after failed register)
      const loginRes = await doFetch(`${apiBase}/api/auth/login`, { email, password });
      const loginJson = await loginRes.json().catch(() => ({}));
      if (loginJson.token) storeToken(loginJson.token);
      if (loginRes.ok) { console.log("[AuthContext] backend login OK"); return; }

      // User not in Drizzle DB yet (Supabase-only user) → auto-create
      if (loginRes.status === 401) {
        const supabaseName = name || email.split("@")[0];
        const regRes = await doFetch(`${apiBase}/api/auth/register`, { name: supabaseName, email, password });
        const regJson = await regRes.json().catch(() => ({}));
        if (regJson.token) storeToken(regJson.token);
        if (regRes.ok) console.log("[AuthContext] backend auto-register OK");
      }
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
