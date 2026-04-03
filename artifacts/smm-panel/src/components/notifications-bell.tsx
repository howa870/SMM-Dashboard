import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications, useMarkNotificationsRead, useUnreadCount } from "@/hooks/useNotificationsData";
import { format } from "date-fns";

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
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-12 left-0 w-80 bg-[#111122] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white">الإشعارات</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">{unreadCount} جديد</span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {!notifications?.length ? (
              <div className="py-10 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.is_read ? "bg-purple-500/5 border-r-2 border-r-purple-500" : ""}`}>
                  <p className="font-medium text-white text-sm">{n.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-600 mt-1 font-mono" dir="ltr">
                    {format(new Date(n.created_at), "MM/dd HH:mm")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
