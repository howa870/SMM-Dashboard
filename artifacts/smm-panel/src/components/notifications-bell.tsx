import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, Package, Clock, CheckCircle2, XCircle, CreditCard, ShoppingCart } from "lucide-react";
import { useNotifications, useMarkNotificationsRead, useUnreadCount } from "@/hooks/useNotificationsData";
import { format } from "date-fns";
import type { Notification } from "@/lib/supabase-db";

// Map notification type → icon + accent color
function NotifIcon({ type }: { type?: string | null }) {
  const cls = "w-4 h-4 flex-shrink-0";
  if (!type) return <Bell className={`${cls} text-blue-400`} />;
  if (type === "order_new")        return <ShoppingCart className={`${cls} text-indigo-400`} />;
  if (type === "order_processing") return <Clock        className={`${cls} text-amber-400`} />;
  if (type === "order_completed")  return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  if (type === "order_failed")     return <XCircle      className={`${cls} text-red-400`} />;
  if (type === "payment_approved") return <CreditCard   className={`${cls} text-emerald-400`} />;
  if (type === "payment_rejected") return <CreditCard   className={`${cls} text-red-400`} />;
  return <Package className={`${cls} text-blue-400`} />;
}

function typeAccent(type?: string | null): string {
  if (type === "order_completed" || type === "payment_approved") return "border-r-emerald-400";
  if (type === "order_failed"    || type === "payment_rejected") return "border-r-red-400";
  if (type === "order_processing")                               return "border-r-amber-400";
  return "border-r-indigo-400";
}

function NotifRow({ n }: { n: Notification }) {
  return (
    <div
      className={`
        px-4 py-3 border-b border-black/5 dark:border-white/5
        hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors
        ${!n.is_read
          ? `bg-indigo-50/60 dark:bg-indigo-500/[0.07] border-r-[3px] ${typeAccent(n.type)}`
          : ""}
      `}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">
          <NotifIcon type={n.type} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-snug">{n.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 font-mono" dir="ltr">
            {format(new Date(n.created_at), "MM/dd · HH:mm")}
          </p>
        </div>
        {!n.is_read && (
          <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const { mutate: markRead } = useMarkNotificationsRead();
  const unreadCount = useUnreadCount();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unreadCount > 0) markRead();
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label="الإشعارات"
        className="
          relative w-9 h-9 rounded-xl flex items-center justify-center transition-all
          bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10
          border border-gray-200 dark:border-white/10
        "
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span
            className="
              absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
              bg-indigo-600 dark:bg-indigo-500 rounded-full
              text-white text-[10px] font-bold flex items-center justify-center
            "
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="
            absolute top-11 left-0 w-80 z-50
            bg-white dark:bg-[#111122]
            border border-gray-200 dark:border-white/10
            rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/50
            overflow-hidden
            animate-in fade-in slide-in-from-top-2 duration-200
          "
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800 dark:text-white">الإشعارات</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-[11px] text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-400/10 px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} جديد
                </span>
              )}
              {(notifications?.length ?? 0) > 0 && unreadCount > 0 && (
                <button
                  onClick={() => markRead()}
                  title="تحديد الكل كمقروء"
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
            {!notifications?.length ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map(n => <NotifRow key={n.id} n={n} />)
            )}
          </div>

          {/* Footer */}
          {(notifications?.length ?? 0) > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/10">
              <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center">
                آخر {notifications?.length} إشعار
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
