import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { NotificationsBell } from "./notifications-bell";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Spinner } from "./ui/spinner";
import { Menu } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { supabaseUser, isLoading } = useSupabaseAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !supabaseUser && location !== "/login" && location !== "/register") {
      setLocation("/login");
    }
  }, [supabaseUser, isLoading, location, setLocation]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Spinner className="w-8 h-8 text-indigo-500" />
      </div>
    );
  }

  if (!supabaseUser && (location === "/login" || location === "/register")) {
    return <div className="min-h-[100dvh] bg-background text-foreground">{children}</div>;
  }

  if (!supabaseUser) return null;

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground" dir="rtl" style={{ overflowX: "hidden" }}>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-[100dvh] layout-main md:mr-64">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-white/5"
          style={{ background: "rgba(15,23,42,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/8 text-slate-300 hover:text-white transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.06)" }}
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <span className="text-base font-black text-white">Boost Iraq</span>
            <span>🚀</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 mr-auto md:mr-0">
            <NotificationsBell />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>

        <footer className="border-t border-white/5 py-4 px-4 text-center text-xs text-slate-600">
          © 2026 Boost Iraq — جميع الحقوق محفوظة
        </footer>
      </main>
    </div>
  );
}
