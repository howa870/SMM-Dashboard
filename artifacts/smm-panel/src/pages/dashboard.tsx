import { Layout } from "@/components/layout";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useUserOrders } from "@/hooks/useOrdersData";
import { usePlatforms } from "@/hooks/useServicesData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Clock, CheckCircle, ShoppingCart, Loader2 } from "lucide-react";
import { Link } from "wouter";
import {
  FaInstagram, FaTiktok, FaTelegram, FaFacebook,
  FaYoutube, FaXTwitter, FaSnapchat, FaTwitch,
  FaSpotify, FaSoundcloud
} from "react-icons/fa6";
import { Skeleton } from "@/components/ui/skeleton";

function getPlatformIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("instagram")) return <FaInstagram className="text-pink-500 w-8 h-8" />;
  if (n.includes("tiktok")) return <FaTiktok className="text-gray-300 w-8 h-8" />;
  if (n.includes("telegram")) return <FaTelegram className="text-blue-400 w-8 h-8" />;
  if (n.includes("facebook")) return <FaFacebook className="text-blue-600 w-8 h-8" />;
  if (n.includes("youtube")) return <FaYoutube className="text-red-500 w-8 h-8" />;
  if (n.includes("twitter") || n.includes(" x")) return <FaXTwitter className="text-gray-300 w-8 h-8" />;
  if (n.includes("snapchat")) return <FaSnapchat className="text-yellow-400 w-8 h-8" />;
  if (n.includes("twitch")) return <FaTwitch className="text-purple-500 w-8 h-8" />;
  if (n.includes("spotify")) return <FaSpotify className="text-green-500 w-8 h-8" />;
  if (n.includes("soundcloud")) return <FaSoundcloud className="text-orange-500 w-8 h-8" />;
  return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">{name[0]}</div>;
}

export function Dashboard() {
  const { supabaseUser } = useSupabaseAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: orders, isLoading: ordersLoading } = useUserOrders();
  const { data: platforms, isLoading: platformsLoading } = usePlatforms();

  const balance = Number(profile?.balance || 0);
  const displayName = profile?.name || supabaseUser?.email?.split("@")[0] || "مستخدم";

  const processingOrders = orders?.filter(o => o.status === "processing").length || 0;
  const completedOrders = orders?.filter(o => o.status === "completed").length || 0;
  const pendingOrders = orders?.filter(o => o.status === "pending").length || 0;
  const totalOrders = orders?.length || 0;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-1">مرحباً {displayName} 👋</h1>
          <p className="text-gray-400 text-sm">{supabaseUser?.email}</p>
          <p className="text-gray-500 text-xs mt-1">إليك نظرة عامة على حسابك اليوم</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-white/10 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">الرصيد المتاح</CardTitle>
              <Wallet className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                {profileLoading ? (
                  <Skeleton className="h-10 w-32 bg-white/10" />
                ) : (
                  <div className="text-4xl font-bold text-white font-mono">IQD {balance.toLocaleString()}</div>
                )}
                <Link href="/wallet"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4" /> شحن
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">قيد المعالجة</CardTitle>
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            </CardHeader>
            <CardContent>
              {ordersLoading ? <Skeleton className="h-8 w-16 bg-white/10" /> : (
                <div className="text-2xl font-bold text-white">{processingOrders}</div>
              )}
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">مكتملة</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              {ordersLoading ? <Skeleton className="h-8 w-16 bg-white/10" /> : (
                <div className="text-2xl font-bold text-white">{completedOrders}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الطلبات", value: totalOrders, color: "text-white" },
            { label: "قيد الانتظار", value: pendingOrders, color: "text-yellow-400" },
            { label: "جاري التنفيذ", value: processingOrders, color: "text-blue-400" },
            { label: "مكتملة", value: completedOrders, color: "text-green-400" },
          ].map(item => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-1">{item.label}</p>
              <p className={`text-2xl font-bold font-mono ${item.color}`}>
                {ordersLoading ? "..." : item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Platforms */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">المنصات المدعومة</h2>
            <Link href="/services"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl">
              <ShoppingCart className="w-4 h-4" />
              تصفح الخدمات
            </Link>
          </div>
          {platformsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}
            </div>
          ) : !platforms?.length ? (
            <div className="text-center py-12 text-gray-500">
              <p>لا توجد منصات مفعّلة بعد. يرجى تشغيل إعداد Supabase.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {platforms.map(platform => (
                <Link key={platform.id} href={`/services?platform=${platform.id}`}>
                  <Card className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer group rounded-2xl relative overflow-hidden h-full">
                    <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
                      <div className="transform group-hover:scale-110 transition-transform duration-300">
                        {getPlatformIcon(platform.name)}
                      </div>
                      <h3 className="font-semibold text-white">{platform.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        {!!orders?.length && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">آخر الطلبات</h2>
              <Link href="/orders" className="text-sm text-purple-400 hover:text-purple-300">عرض الكل</Link>
            </div>
            <div className="space-y-3">
              {orders.slice(0, 3).map(order => (
                <div key={order.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-medium">{order.services?.name || `طلب #${order.id}`}</p>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-[180px]" dir="ltr">{order.link}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-purple-400 text-sm">IQD {Number(order.total_price).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === "completed" ? "bg-green-500/20 text-green-400" :
                      order.status === "processing" ? "bg-blue-500/20 text-blue-400" :
                      "bg-yellow-500/20 text-yellow-400"}`}>
                      {order.status === "completed" ? "مكتمل" : order.status === "processing" ? "جاري" : "انتظار"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
