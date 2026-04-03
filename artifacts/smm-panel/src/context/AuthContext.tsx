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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSupabaseUser(s?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSupabaseUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncWithBackend = async (email: string, password: string, name?: string) => {
    try {
      const endpoint = name ? "/api/auth/register" : "/api/auth/login";
      const body = name ? { name, email, password } : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.token) storeToken(json.token);
    } catch {
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await syncWithBackend(email, password);
  };

  const register = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    await syncWithBackend(email, password, name);
  };

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
  const context = useContext(AuthContext);
  if (!context) throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return context;
}
