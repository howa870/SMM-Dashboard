import { Link, useLocation } from "wouter";
import { LayoutDashboard, List, History, Wallet } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",         label: "الرئيسية",  icon: LayoutDashboard },
  { href: "/services", label: "الخدمات",   icon: List },
  { href: "/orders",   label: "طلباتي",    icon: History },
  { href: "/wallet",   label: "المحفظة",   icon: Wallet },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="mob-nav md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
      dir="rtl"
      aria-label="التنقل الرئيسي"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = location === href;
        return (
          <Link
            key={href}
            href={href}
            className="mob-nav-item flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-all duration-200 active:scale-95"
          >
            <div className={`mob-nav-icon-wrap ${isActive ? "mob-nav-icon-wrap--active" : ""}`}>
              <Icon
                className={`w-5 h-5 transition-all ${isActive ? "mob-nav-icon--active" : "mob-nav-icon--idle"}`}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
            </div>
            <span className={`text-[10px] font-medium leading-none transition-colors ${isActive ? "mob-nav-label--active" : "mob-nav-label--idle"}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
