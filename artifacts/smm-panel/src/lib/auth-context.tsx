import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "pf_session_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Register getter so every request includes Bearer token
setAuthTokenGetter(getStoredToken);

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
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(() => !!getStoredToken());

  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
      enabled: hasToken,
    },
  });

  useEffect(() => {
    if (user !== undefined) {
      setLocalUser(user);
    }
  }, [user]);

  const login = (token: string, user: User) => {
    storeToken(token);
    setHasToken(true);
    setLocalUser(user);
  };

  const logout = () => {
    clearToken();
    setHasToken(false);
    setLocalUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user: localUser, isLoading: hasToken ? isLoading : false, setUser: setLocalUser, login, logout }}>
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
