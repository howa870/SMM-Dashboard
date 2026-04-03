import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { 
  LayoutDashboard, List, ShoppingCart, History, 
  Wallet, LogOut, ShieldAlert, Users, CreditCard,
  Activity, ArrowLeftRight, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/services", label: "الخدمات", icon: List },
    { href: "/order", label: "طلب جديد", icon: ShoppingCart },
    { href: "/orders", label: "طلباتي", icon: History },
    { href: "/wallet", label: "المحفظة", icon: Wallet },
    { href: "/transactions", label: "سجل العمليات", icon: ArrowLeftRight },
  ];

  const adminItems = [
    { href: "/admin", label: "نظرة عامة", icon: Activity },
    { href: "/admin/orders", label: "إدارة الطلبات", icon: History },
    { href: "/admin/payments", label: "المدفوعات", icon: CreditCard },
    { href: "/admin/services", label: "الخدمات", icon: Settings },
    { href: "/admin/users", label: "المستخدمين", icon: Users },
    { href: "/admin/settings", label: "إعدادات الدفع", icon: ShieldAlert },
  ];

  const displayName = profile?.name || user?.name || "مستخدم";
  const displayEmail = profile?.email || user?.email || "";
  const displayInitial = displayName[0]?.toUpperCase() || "U";

  return (
    <div className="w-64 h-full flex flex-col bg-white/5 backdrop-blur-xl border-l border-white/10">
      <div className="p-6 overflow-y-auto flex-1">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-8">
          Perfect Follow
        </h1>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-white/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <div className="mt-8">
            <h2 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              لوحة الإدارة
            </h2>
            <nav className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-white border border-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">
            {displayInitial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{displayEmail}</p>
          </div>
        </div>
        <Button variant="ghost"
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl"
          onClick={handleLogout}>
          <LogOut className="w-5 h-5 ml-3" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
