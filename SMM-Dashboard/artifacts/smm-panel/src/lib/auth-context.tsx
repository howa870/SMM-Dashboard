import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/context/AuthContext";
import { getStoredToken } from "@/lib/token";

export { getStoredToken, storeToken, clearToken } from "@/lib/token";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { supabaseUser, isLoading: supabaseLoading, logout: supabaseLogout } = useSupabaseAuth();
  const [localUser, setLocalUser] = useState<User | null>(null);
  const hasToken = !!supabaseUser && !!getStoredToken();

  const { data: user, isLoading: meLoading } = useGetMe({
    query: {
      retry: false,
      enabled: hasToken,
    },
  });

  useEffect(() => {
    if (!supabaseUser) {
      setLocalUser(null);
    }
  }, [supabaseUser]);

  useEffect(() => {
    if (user !== undefined) {
      setLocalUser(user);
    }
  }, [user]);

  const login = (token: string, backendUser: User) => {
    storeToken(token);
    setLocalUser(backendUser);
  };

  const logout = () => {
    supabaseLogout();
    setLocalUser(null);
    queryClient.clear();
  };

  const isLoading = supabaseLoading || (hasToken ? meLoading : false);

  return (
    <AuthContext.Provider value={{ user: localUser, isLoading, setUser: setLocalUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
