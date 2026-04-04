import { Layout } from "@/components/layout";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useUserOrders } from "@/hooks/useOrdersData";
import { usePlatforms, useServices } from "@/hooks/useServicesData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Wallet, Clock, CheckCircle, ShoppingCart, Loader2, Zap, Shield, Headphones, Star, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import {
  FaInstagram, FaTiktok, FaTelegram, FaFacebook,
  FaYoutube, FaXTwitter, FaSnapchat, FaTwitch,
  FaSpotify, FaSoundcloud
} from "react-icons/fa6";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

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

const LIVE_ACTIVITY = [
  { icon: "🔥", text: "شخص من بغداد اشترى 1000 متابع انستغرام", time: "قبل دقيقتين" },
  { icon: "⭐", text: "طلب جديد: 500 لايك تيك توك — تم بنجاح!", time: "قبل 5 دقائق" },
  { icon: "🔥", text: "شخص من البصرة اشترى 5000 مشاهدة يوتيوب", time: "قبل 7 دقائق" },
  { icon: "⭐", text: "طلب متابعين انستغرام 2000 — تسليم فوري ✅", time: "قبل 10 دقائق" },
  { icon: "🔥", text: "شخص من الموصل اشترى متابعين تيك توك", time: "قبل 12 دقيقة" },
  { icon: "⭐", text: "طلب جديد: 10,000 مشاهدة يوتيوب — نجح!", time: "قبل 15 دقيقة" },
  { icon: "🔥", text: "شخص من أربيل اشترى لايكات انستغرام", time: "قبل 18 دقيقة" },
];

function LiveActivityBanner() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % LIVE_ACTIVITY.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const item = LIVE_ACTIVITY[current];
  return (
    <div
      className={`flex items-center gap-3 bg-gradient-to-l from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl px-4 py-3 transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
    >
      <span className="text-xl shrink-0">{item.icon}</span>
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{item.text}</p>
        <p className="text-orange-400/70 text-xs">{item.time}</p>
      </div>
      <span className="shrink-0 text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">مباشر</span>
    </div>
  );
}

export function Dashboard() {
  const { supabaseUser } = useSupabaseAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: orders, isLoading: ordersLoading } = useUserOrders();
  const { data: platforms, isLoading: platformsLoading } = usePlatforms();
  const { data: allServices, isLoading: servicesLoading } = useServices();

  const balance = Number(profile?.balance || 0);
  const displayName = profile?.name || supabaseUser?.email?.split("@")[0] || "مستخدم";

  const processingOrders = orders?.filter(o => o.status === "processing").length || 0;
  const completedOrders = orders?.filter(o => o.status === "completed").length || 0;
  const pendingOrders = orders?.filter(o => o.status === "pending").length || 0;
  const totalOrders = orders?.length || 0;

  const popularServices = allServices?.slice(0, 5) || [];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Live activity ticker */}
        <LiveActivityBanner />

        {/* Hero CTA */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/30 via-blue-600/20 to-indigo-600/30 border border-white/10 p-6 md:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">مرحباً {displayName} 👋</h1>
              <p className="text-gray-400 text-sm">{supabaseUser?.email}</p>
              <p className="text-gray-500 text-xs mt-1">الرصيد الحالي: <span className="text-purple-300 font-mono font-bold">IQD {balance.toLocaleString()}</span></p>
            </div>
            <Link href="/services"
              className="shrink-0 inline-flex items-center gap-2.5 bg-gradient-to-l from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3.5 rounded-2xl text-base font-bold shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50">
              <Zap className="w-5 h-5" />
              🚀 ابدأ زيادة متابعينك الآن
            </Link>
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">أكثر من 10,000 طلب ناجح</p>
              <p className="text-green-400/60 text-xs">عملاء راضون في العراق والخليج</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3">
            <Zap className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">تسليم سريع خلال دقائق</p>
              <p className="text-blue-400/60 text-xs">بدء فوري بعد تأكيد الطلب</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3">
            <Headphones className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">دعم 24/7</p>
              <p className="text-purple-400/60 text-xs">فريق دعم عربي متاح دائماً</p>
            </div>
          </div>
        </div>

        {/* Guarantee badge */}
        <div className="flex items-center justify-center gap-3 bg-gradient-to-l from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
          <span className="text-2xl">💯</span>
          <p className="text-emerald-300 font-bold text-sm">بدون باسورد — آمن 100% على حسابك</p>
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-white/10 col-span-2 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">الرصيد المتاح</CardTitle>
              <Wallet className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                {profileLoading ? (
                  <Skeleton className="h-10 w-32 bg-white/10" />
                ) : (
                  <div className="text-3xl font-bold text-white font-mono">IQD {balance.toLocaleString()}</div>
                )}
                <Link href="/wallet"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4" /> شحن
                </Link>
              </div>
            </CardContent>
          </Card>

          {[
            { label: "إجمالي الطلبات", value: totalOrders, color: "text-white", icon: <ShoppingCart className="h-4 w-4 text-gray-400" /> },
            { label: "مكتملة", value: completedOrders, color: "text-green-400", icon: <CheckCircle className="h-4 w-4 text-green-400" /> },
          ].map(item => (
            <Card key={item.label} className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">{item.label}</CardTitle>
                {item.icon}
              </CardHeader>
              <CardContent>
                {ordersLoading ? <Skeleton className="h-8 w-16 bg-white/10" /> : (
                  <div className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Popular services */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <h2 className="text-xl font-bold text-white">الأكثر طلباً</h2>
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-medium">
                الأعلى مبيعاً
              </span>
            </div>
            <Link href="/services"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl transition-colors">
              <TrendingUp className="w-3.5 h-3.5" />
              عرض الكل
            </Link>
          </div>

          {servicesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl bg-white/5" />)}
            </div>
          ) : !popularServices.length ? (
            <div className="text-center py-8 text-gray-500 bg-white/5 border border-white/10 rounded-2xl">
              <p>لا توجد خدمات متاحة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {popularServices.map((service, idx) => (
                <Link key={service.id} href={`/order?service=${service.id}`}>
                  <div className="group flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-2xl px-4 py-3.5 transition-all cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-purple-300 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{service.name}</p>
                        <p className="text-gray-500 text-xs">
                          {service.service_type === "Followers" ? "متابعين" :
                           service.service_type === "Likes" ? "لايكات" :
                           service.service_type === "Views" ? "مشاهدات" :
                           service.service_type === "Comments" ? "تعليقات" : service.service_type || "خدمة"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left">
                        <p className="text-purple-300 font-mono text-sm font-bold">
                          IQD {(Number(service.price || 0)).toLocaleString()}
                        </p>
                        <p className="text-gray-500 text-xs">لكل 1000</p>
                      </div>
                      <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
                        <Star className="w-3 h-3 text-orange-400 fill-orange-400" />
                        <span className="text-orange-400 text-xs font-bold">مميز</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Platforms */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">المنصات المدعومة</h2>
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
              <p>لا توجد منصات مفعّلة بعد.</p>
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
