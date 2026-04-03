import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      retry: false,
    },
  });

  const [localUser, setLocalUser] = useState<User | null>(null);

  useEffect(() => {
    if (user !== undefined) {
      setLocalUser(user);
    }
  }, [user]);

  const logout = () => {
    setLocalUser(null);
  };

  return (
    <AuthContext.Provider value={{ user: localUser, isLoading: isUserLoading, logout }}>
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
