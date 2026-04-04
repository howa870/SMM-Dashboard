import { Link, useLocation } from "wouter";
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
    <div className="w-64 h-full flex flex-col border-l border-white/[0.07]"
      style={{ background: "rgba(13,20,35,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>

      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">🚀</span>
            <span className="text-lg font-black text-white">Boost Iraq</span>
          </div>
          <p className="text-[11px] text-slate-500">أفضل خدمات السوشيال في العراق</p>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose}
            className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all"
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
          border: "1px solid rgba(99,102,241,0.22)"
        }}>
        <div className="w-9 h-9 rounded-[12px] bg-white/10 flex items-center justify-center text-lg shrink-0">💰</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">رصيدي</p>
          <p className="text-sm font-black text-white font-mono leading-tight">
            {balance.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">IQD</span>
          </p>
        </div>
        <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" />
      </Link>

      {/* ── Nav items ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={handleNavClick}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] transition-all duration-200 group relative overflow-hidden ${
                isActive
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white font-medium"
              }`}
              style={isActive ? {
                background: "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.12))",
                border: "1px solid rgba(99,102,241,0.28)",
                boxShadow: "0 4px 15px rgba(99,102,241,0.12)",
              } : {}}>

              {!isActive && (
                <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(255,255,255,0.04)" }} />
              )}
              <div className={`relative w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all ${
                isActive
                  ? "text-white shadow-md shadow-indigo-500/30"
                  : "text-slate-400 group-hover:text-white"
              }`}
                style={isActive ? { background: "linear-gradient(135deg, #6366F1, #8B5CF6)" } : { background: "rgba(255,255,255,0.06)" }}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="relative text-sm">{item.label}</span>
            </Link>
          );
        })}

        {/* ── Admin section ── */}
        {isAdmin && (
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <p className="px-3.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" />
              لوحة الإدارة
            </p>
            <div className="space-y-0.5">
              {adminItems.map(item => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href} onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] transition-all duration-200 group ${
                      isActive ? "text-white" : "text-slate-400 hover:text-white"
                    }`}
                    style={isActive ? {
                      background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.1))",
                      border: "1px solid rgba(99,102,241,0.25)",
                    } : {}}>
                    <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}
                      style={isActive ? { background: "linear-gradient(135deg, #6366F1, #8B5CF6)" } : { background: "rgba(255,255,255,0.05)" }}>
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
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 p-3 rounded-2xl mb-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md shadow-indigo-500/20"
            style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
            {displayInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-red-400 hover:text-red-300 transition-all duration-200 text-sm font-medium group"
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
      {/* ─── Desktop sidebar: always visible, on the left ─── */}
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
