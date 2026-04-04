import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  LayoutDashboard, List, ShoppingCart, History,
  Wallet, LogOut, ShieldAlert, Users, CreditCard,
  Activity, ArrowLeftRight, Settings, ChevronLeft
} from "lucide-react";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { logout } = useSupabaseAuth();
  const { data: profile } = useProfile();

  const isAdmin = profile?.role === "admin" || user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const navItems = [
    { href: "/",            label: "لوحة التحكم",  icon: LayoutDashboard },
    { href: "/services",    label: "الخدمات",       icon: List },
    { href: "/order",       label: "طلب جديد",      icon: ShoppingCart },
    { href: "/orders",      label: "طلباتي",         icon: History },
    { href: "/wallet",      label: "المحفظة",        icon: Wallet },
    { href: "/transactions",label: "سجل العمليات",  icon: ArrowLeftRight },
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

  return (
    <div className="w-64 h-full flex flex-col border-l border-white/8"
      style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>

      {/* ── Logo ── */}
      <div className="px-6 pt-7 pb-5 border-b border-white/6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🚀</span>
          <span className="text-xl font-black text-boost-gradient">Boost Iraq</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">أفضل خدمات السوشيال ميديا في العراق والخليج</p>
      </div>

      {/* ── Balance Pill ── */}
      <Link href="/wallet" className="mx-4 mt-4 rounded-[16px] p-3 flex items-center gap-3 transition-all hover:brightness-110"
        style={{ background: "linear-gradient(135deg, rgba(108,92,231,0.18), rgba(0,184,148,0.12))", border: "1px solid rgba(108,92,231,0.22)" }}>
        <div className="w-9 h-9 rounded-[12px] bg-white/10 flex items-center justify-center text-lg shrink-0">💰</div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400">رصيدي</p>
          <p className="text-sm font-black text-white font-mono leading-tight">
            {balance.toLocaleString()} <span className="text-xs font-normal text-slate-400">IQD</span>
          </p>
        </div>
        <ChevronLeft className="w-4 h-4 text-slate-500 mr-auto shrink-0" />
      </Link>

      {/* ── Nav ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-[14px] transition-all duration-200 group relative overflow-hidden ${
                isActive
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-white font-medium"
              }`}
              style={isActive ? {
                background: "linear-gradient(135deg, rgba(108,92,231,0.25), rgba(0,184,148,0.12))",
                border: "1px solid rgba(108,92,231,0.3)",
                boxShadow: "0 4px 15px rgba(108,92,231,0.15)",
              } : {}}>
              {isActive && (
                <div className="absolute inset-0 rounded-[14px]"
                  style={{ background: "linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,184,148,0.04))" }} />
              )}
              {!isActive && (
                <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(255,255,255,0.04)" }} />
              )}
              <div className={`relative w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all ${
                isActive ? "bg-boost-gradient shadow-lg shadow-purple-500/30" : "bg-white/6 group-hover:bg-white/10"
              }`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className="relative text-sm">{item.label}</span>
            </Link>
          );
        })}

        {/* ── Admin section ── */}
        {isAdmin && (
          <div className="mt-5 pt-4 border-t border-white/6">
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              الإدارة
            </p>
            <div className="space-y-0.5">
              {adminItems.map(item => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-[14px] transition-all duration-200 group ${
                      isActive ? "text-white" : "text-slate-400 hover:text-white"
                    }`}
                    style={isActive ? {
                      background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(0,184,148,0.1))",
                      border: "1px solid rgba(108,92,231,0.25)",
                    } : {}}>
                    <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${
                      isActive ? "bg-boost-gradient" : "bg-white/6 group-hover:bg-white/10"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── User card + Logout ── */}
      <div className="p-4 border-t border-white/6">
        <div className="flex items-center gap-3 p-3 rounded-[14px] mb-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="w-9 h-9 rounded-full bg-boost-gradient flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-purple-500/30">
            {displayInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{displayEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] text-red-400 hover:text-red-300 hover:bg-red-400/8 transition-all duration-200 text-sm font-medium">
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
