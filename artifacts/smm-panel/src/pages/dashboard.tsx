import { Layout } from "@/components/layout";
import { translateServiceName } from "@/lib/translate-service";
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
  if (n.includes("tiktok")) return <FaTiktok className="db-icon-tiktok w-8 h-8" />;
  if (n.includes("telegram")) return <FaTelegram className="text-blue-400 w-8 h-8" />;
  if (n.includes("facebook")) return <FaFacebook className="text-blue-600 w-8 h-8" />;
  if (n.includes("youtube")) return <FaYoutube className="text-red-500 w-8 h-8" />;
  if (n.includes("twitter") || n.includes(" x")) return <FaXTwitter className="db-icon-x w-8 h-8" />;
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
      className={`db-activity-banner flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
    >
      <span className="text-xl shrink-0">{item.icon}</span>
      <div className="min-w-0">
        <p className="db-text text-sm font-medium truncate">{item.text}</p>
        <p className="db-muted-orange text-xs">{item.time}</p>
      </div>
      <span className="shrink-0 text-xs db-live-badge px-2 py-0.5 rounded-full">مباشر</span>
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
      <div className="db-page space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Live activity ticker */}
        <LiveActivityBanner />

        {/* Hero CTA */}
        <div className="db-hero relative overflow-hidden rounded-3xl p-6 md:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <h1 className="db-hero-title text-2xl md:text-3xl font-bold mb-1">مرحباً {displayName} 👋</h1>
              <p className="db-muted text-sm">{supabaseUser?.email}</p>
              <p className="db-faint text-xs mt-1">الرصيد الحالي: <span className="db-accent font-mono font-bold">IQD {balance.toLocaleString()}</span></p>
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
          <div className="db-badge-green flex items-center gap-3 rounded-2xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="db-text text-sm font-semibold">أكثر من 10,000 طلب ناجح</p>
              <p className="db-muted-green text-xs">عملاء راضون في العراق والخليج</p>
            </div>
          </div>
          <div className="db-badge-blue flex items-center gap-3 rounded-2xl px-4 py-3">
            <Zap className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="db-text text-sm font-semibold">تسليم سريع خلال دقائق</p>
              <p className="db-muted-blue text-xs">بدء فوري بعد تأكيد الطلب</p>
            </div>
          </div>
          <div className="db-badge-purple flex items-center gap-3 rounded-2xl px-4 py-3">
            <Headphones className="w-5 h-5 text-purple-500 shrink-0" />
            <div>
              <p className="db-text text-sm font-semibold">دعم 24/7</p>
              <p className="db-muted-purple text-xs">فريق دعم عربي متاح دائماً</p>
            </div>
          </div>
        </div>

        {/* Guarantee badge */}
        <div className="db-badge-emerald flex items-center justify-center gap-3 rounded-2xl px-4 py-3">
          <span className="text-2xl">💯</span>
          <p className="db-emerald-text font-bold text-sm">بدون باسورد — آمن 100% على حسابك</p>
          <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="db-stat-card-gradient col-span-2 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium db-stat-label">الرصيد المتاح</CardTitle>
              <Wallet className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                {profileLoading ? (
                  <Skeleton className="h-10 w-32 db-skeleton" />
                ) : (
                  <div className="db-balance-number text-3xl font-bold font-mono">IQD {balance.toLocaleString()}</div>
                )}
                <Link href="/wallet"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4" /> شحن
                </Link>
              </div>
            </CardContent>
          </Card>

          {[
            { label: "إجمالي الطلبات", value: totalOrders, cls: "db-stat-number", icon: <ShoppingCart className="h-4 w-4 db-icon-muted" /> },
            { label: "مكتملة", value: completedOrders, cls: "db-stat-number-green", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
          ].map(item => (
            <Card key={item.label} className="db-stat-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium db-stat-label">{item.label}</CardTitle>
                {item.icon}
              </CardHeader>
              <CardContent>
                {ordersLoading ? <Skeleton className="h-8 w-16 db-skeleton" /> : (
                  <div className={`text-2xl font-bold font-mono ${item.cls}`}>{item.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Instagram promo card */}
        <a href="https://www.instagram.com/_eufx" target="_blank" rel="noopener noreferrer"
          className="db-promo-card flex items-center gap-4 p-4 rounded-2xl transition-all group cursor-pointer">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-500 p-[2px]">
              <div className="w-full h-full rounded-full db-promo-icon-bg flex items-center justify-center">
                <FaInstagram className="text-pink-400 w-7 h-7" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 border-2 border-white dark:border-[#0f0f1a] flex items-center justify-center">
              <span className="text-[8px] text-white font-black">✓</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="db-text font-bold text-sm">@_eufx</p>
            <p className="db-muted text-xs mt-0.5">تابعنا على إنستقرام للعروض الحصرية والأخبار</p>
          </div>
          <div className="shrink-0 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl group-hover:from-pink-500 group-hover:to-purple-500 transition-all">
            متابعة
          </div>
        </a>

        {/* Popular services */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <h2 className="text-xl font-bold db-text">الأكثر طلباً</h2>
              <span className="text-xs db-hot-badge px-2 py-0.5 rounded-full font-medium">
                الأعلى مبيعاً
              </span>
            </div>
            <Link href="/services"
              className="text-sm db-link flex items-center gap-1 db-link-bg px-3 py-1.5 rounded-xl transition-colors">
              <TrendingUp className="w-3.5 h-3.5" />
              عرض الكل
            </Link>
          </div>

          {servicesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl db-skeleton" />)}
            </div>
          ) : !popularServices.length ? (
            <div className="text-center py-8 db-muted db-empty-card border rounded-2xl">
              <p>لا توجد خدمات متاحة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {popularServices.map((service, idx) => (
                <Link key={service.id} href={`/order?service=${service.id}`}>
                  <div className="db-service-row group flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="db-rank-badge w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="db-text font-medium text-sm truncate">{translateServiceName(service.name)}</p>
                        <p className="db-muted text-xs">
                          {service.service_type === "Followers" ? "متابعين" :
                           service.service_type === "Likes" ? "لايكات" :
                           service.service_type === "Views" ? "مشاهدات" :
                           service.service_type === "Comments" ? "تعليقات" : service.service_type || "خدمة"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left">
                        <p className="db-accent font-mono text-sm font-bold">
                          IQD {(Number(service.price || 0)).toLocaleString()}
                        </p>
                        <p className="db-muted text-xs">لكل 1000</p>
                      </div>
                      <div className="flex items-center gap-1 db-featured-badge px-2 py-1 rounded-lg">
                        <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                        <span className="db-featured-text text-xs font-bold">مميز</span>
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
            <h2 className="text-xl font-bold db-text">المنصات المدعومة</h2>
            <Link href="/services"
              className="text-sm db-link flex items-center gap-1 db-link-bg px-3 py-1.5 rounded-xl">
              <ShoppingCart className="w-4 h-4" />
              تصفح الخدمات
            </Link>
          </div>
          {platformsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl db-skeleton" />)}
            </div>
          ) : !platforms?.length ? (
            <div className="text-center py-12 db-muted">
              <p>لا توجد منصات مفعّلة بعد.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {platforms.map(platform => (
                <Link key={platform.id} href={`/services?platform=${platform.id}`}>
                  <Card className="db-platform-card transition-all cursor-pointer group rounded-2xl relative overflow-hidden h-full">
                    <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
                      <div className="transform group-hover:scale-110 transition-transform duration-300">
                        {getPlatformIcon(platform.name)}
                      </div>
                      <h3 className="font-semibold db-text">{platform.name}</h3>
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
              <h2 className="text-xl font-bold db-text">آخر الطلبات</h2>
              <Link href="/orders" className="text-sm db-link">عرض الكل</Link>
            </div>
            <div className="space-y-3">
              {orders.slice(0, 3).map(order => (
                <div key={order.id} className="db-order-row rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="db-text font-medium">{order.services?.name ? translateServiceName(order.services.name) : `طلب #${order.id}`}</p>
                    <p className="text-xs db-muted font-mono truncate max-w-[180px]" dir="ltr">{order.link}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono db-accent text-sm">IQD {Number(order.total_price).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === "completed" ? "bg-green-500/20 text-green-600 dark:text-green-400" :
                      order.status === "processing" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                      "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"}`}>
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
