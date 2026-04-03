import { Sidebar } from "./sidebar";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Spinner } from "./ui/spinner";

export function Layout({ children }: { children: React.ReactNode }) {
  const { supabaseUser, isLoading } = useSupabaseAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !supabaseUser && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
  }, [supabaseUser, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Spinner className="w-8 h-8 text-purple-500" />
      </div>
    );
  }

  if (!supabaseUser && (location === "/login" || location === "/register")) {
    return <div className="min-h-[100dvh] bg-background text-foreground">{children}</div>;
  }

  if (!supabaseUser) return null;

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-[100dvh] overflow-auto">
        <div className="p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
