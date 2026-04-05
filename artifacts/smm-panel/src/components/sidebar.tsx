import { Link, useLocation } from "wouter";
import { BrandLogo } from "./brand-logo";
import { useAuth } from "@/lib/auth-context";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  LayoutDashboard, List, ShoppingCart, History,
  Wallet, LogOut, ShieldAlert, Users, CreditCard,
  Activity, ArrowLeftRight, Settings, ChevronLeft, X
} from "lucide-react";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { logout } = useSupabaseAuth();
  const { data: profile } = useProfile();

  const isAdmin = profile?.role === "admin" || user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    onClose?.();
    setLocation("/login");
  };

  const handleNavClick = () => {
    onClose?.();
  };

  const navItems = [
    { href: "/",             label: "لوحة التحكم",  icon: LayoutDashboard },
    { href: "/services",     label: "الخدمات",       icon: List },
    { href: "/order",        label: "طلب جديد",      icon: ShoppingCart },
    { href: "/orders",       label: "طلباتي",         icon: History },
    { href: "/wallet",       label: "المحفظة",        icon: Wallet },
    { href: "/transactions", label: "سجل العمليات",  icon: ArrowLeftRight },
  ];

  const adminItems = [
    { href: "/admin",          label: "نظرة عامة",    icon: Activity },
    { href: "/admin/orders",   label: "إدارة الطلبات", icon: History },
    { href: "/admin/payments", label: "المدفوعات",     icon: CreditCard },
    { href: "/admin/services", label: "الخدمات",       icon: Settings },
    { href: "/admin/users",    label: "المستخدمين",    icon: Users },
    { href: "/admin/settings", label: "إعدادات الدفع", icon: ShieldAlert },
  ];

  const displayName    = profile?.name  || user?.name  || "مستخدم";
  const displayEmail   = profile?.email || user?.email || "";
  const displayInitial = displayName[0]?.toUpperCase() || "U";
  const balance        = Number(profile?.balance || 0);

  const sidebarContent = (
    <div
      className="w-64 h-full flex flex-col"
      style={{
        background: "var(--theme-card)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderLeft: "1px solid var(--theme-border)",
      }}
    >

      {/* ── Logo ── */}
      <div
        className="px-5 pt-6 pb-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--theme-border)" }}
      >
        <div>
          <div className="flex items-center mb-0.5">
            <BrandLogo className="text-lg" />
          </div>
          <p className="text-[11px]" style={{ color: "rgba(100,116,139,0.8)" }}>أفضل خدمات السوشيال في العراق</p>
        </div>
        {onClose && (
          <button onClick={onClose}
            className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ color: "var(--theme-text)", opacity: 0.5 }}
            aria-label="إغلاق القائمة">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Balance Pill ── */}
      <Link href="/wallet" onClick={handleNavClick}
        className="mx-4 mt-4 rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))",
          border: "1px solid rgba(99,102,241,0.25)",
        }}>
        <div className="w-9 h-9 rounded-[12px] flex items-center justify-center text-lg shrink-0"
          style={{ background: "rgba(99,102,241,0.15)" }}>💰</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs" style={{ color: "rgba(100,116,139,0.8)" }}>رصيدي</p>
          <p className="text-sm font-black font-mono leading-tight" style={{ color: "var(--theme-text)" }}>
            {balance.toLocaleString()} <span className="text-[11px] font-normal" style={{ color: "rgba(100,116,139,0.7)" }}>IQD</span>
          </p>
        </div>
        <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "rgba(100,116,139,0.6)" }} />
      </Link>

      {/* ── Nav items ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={handleNavClick}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] transition-all duration-200 group relative overflow-hidden"
              style={{
                color: isActive ? "#6366f1" : "var(--theme-text)",
                fontWeight: isActive ? 600 : 500,
                opacity: isActive ? 1 : 0.7,
                ...(isActive ? {
                  background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))",
                  border: "1px solid rgba(99,102,241,0.28)",
                  boxShadow: "0 4px 15px rgba(99,102,241,0.1)",
                } : {}),
              }}>
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all"
                style={isActive
                  ? { background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "white" }
                  : { background: "var(--theme-border)", color: "var(--theme-text)" }
                }>
                <Icon className="w-4 h-4" />
              </div>
              <span className="relative text-sm">{item.label}</span>
            </Link>
          );
        })}

        {/* ── Admin section ── */}
        {isAdmin && (
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--theme-border)" }}>
            <p className="px-3.5 text-[10px] font-black uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
              style={{ color: "rgba(100,116,139,0.7)" }}>
              <ShieldAlert className="w-3 h-3" />
              لوحة الإدارة
            </p>
            <div className="space-y-0.5">
              {adminItems.map(item => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href} onClick={handleNavClick}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] transition-all duration-200"
                    style={{
                      color: isActive ? "#6366f1" : "var(--theme-text)",
                      fontWeight: isActive ? 600 : 500,
                      opacity: isActive ? 1 : 0.7,
                      ...(isActive ? {
                        background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))",
                        border: "1px solid rgba(99,102,241,0.25)",
                      } : {}),
                    }}>
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                      style={isActive
                        ? { background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "white" }
                        : { background: "var(--theme-border)", color: "var(--theme-text)" }
                      }>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* ── User card + Logout ── */}
      <div className="p-3" style={{ borderTop: "1px solid var(--theme-border)" }}>
        <div className="flex items-center gap-3 p-3 rounded-2xl mb-2"
          style={{ background: "var(--theme-border)", border: "1px solid var(--theme-border)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md shadow-indigo-500/20"
            style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
            {displayInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--theme-text)" }}>{displayName}</p>
            <p className="text-[11px] truncate" style={{ color: "rgba(100,116,139,0.7)" }}>{displayEmail}</p>
          </div>
        </div>

        {/* Support button */}
        <a href="https://t.me/astakor9" target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] transition-all duration-200 text-sm font-medium mb-1"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)", color: "#3b82f6" }}>
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm shrink-0"
            style={{ background: "rgba(59,130,246,0.15)" }}>
            💬
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs">الدعم الفني</p>
            <p className="text-[10px] opacity-60">@astakor9</p>
          </div>
        </a>

        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-red-500 hover:text-red-600 transition-all duration-200 text-sm font-medium"
          style={{ background: "transparent" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Desktop sidebar: always visible, fixed on right (RTL) ─── */}
      <div className="hidden md:block fixed top-0 right-0 bottom-0 w-64 z-20">
        {sidebarContent}
      </div>

      {/* ─── Mobile sidebar: slide from right as drawer ─── */}
      <div
        className={`md:hidden fixed top-0 right-0 bottom-0 w-72 z-50 sidebar-mobile ${
          open ? "sidebar-mobile-open" : "sidebar-mobile-closed"
        }`}
        aria-modal="true"
        role="dialog"
        aria-label="القائمة الرئيسية"
      >
        {sidebarContent}
      </div>
    </>
  );
}
