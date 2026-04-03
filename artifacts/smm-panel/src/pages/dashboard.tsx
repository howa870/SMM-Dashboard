import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useGetDashboardStats, useGetPlatforms, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Clock, CheckCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { 
  FaInstagram, FaTiktok, FaTelegram, FaFacebook, 
  FaYoutube, FaXTwitter, FaSnapchat, FaTwitch, 
  FaSpotify, FaSoundcloud 
} from "react-icons/fa6";
import { Skeleton } from "@/components/ui/skeleton";

export function Dashboard() {
  const { user } = useAuth();
  const { supabaseUser, logout } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: {
      queryKey: getGetDashboardStatsQueryKey(),
      enabled: !!user,
    }
  });

  const { data: platforms, isLoading: platformsLoading } = useGetPlatforms();

  const getPlatformIcon = (name: string) => {
    const iconName = name.toLowerCase();
    if (iconName.includes('instagram')) return <FaInstagram className="text-pink-500 w-8 h-8" />;
    if (iconName.includes('tiktok')) return <FaTiktok className="text-gray-300 w-8 h-8" />;
    if (iconName.includes('telegram')) return <FaTelegram className="text-blue-400 w-8 h-8" />;
    if (iconName.includes('facebook')) return <FaFacebook className="text-blue-600 w-8 h-8" />;
    if (iconName.includes('youtube')) return <FaYoutube className="text-red-500 w-8 h-8" />;
    if (iconName.includes('twitter') || iconName.includes('x')) return <FaXTwitter className="text-gray-300 w-8 h-8" />;
    if (iconName.includes('snapchat')) return <FaSnapchat className="text-yellow-400 w-8 h-8" />;
    if (iconName.includes('twitch')) return <FaTwitch className="text-purple-500 w-8 h-8" />;
    if (iconName.includes('spotify')) return <FaSpotify className="text-green-500 w-8 h-8" />;
    if (iconName.includes('soundcloud')) return <FaSoundcloud className="text-orange-500 w-8 h-8" />;
    return <div className="w-8 h-8 rounded-full bg-gray-700" />;
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">مرحباً {user?.name || supabaseUser?.email}</h1>
            <p className="text-gray-400 text-sm">{supabaseUser?.email}</p>
            <p className="text-gray-500 text-xs mt-1">إليك نظرة عامة على حسابك اليوم</p>
          </div>
          <Button
            variant="ghost"
            onClick={async () => { await logout(); setLocation("/login"); }}
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl border border-red-400/20"
          >
            تسجيل الخروج
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-white/10 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">الرصيد المتاح</CardTitle>
              <Wallet className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                {statsLoading ? (
                  <Skeleton className="h-10 w-32 bg-white/10" />
                ) : (
                  <div className="text-4xl font-bold text-white">IQD {stats?.balance?.toLocaleString() || 0}</div>
                )}
                <Link href="/wallet" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-purple-500/20">
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
              {statsLoading ? (
                <Skeleton className="h-8 w-16 bg-white/10" />
              ) : (
                <div className="text-2xl font-bold text-white">{stats?.processingOrders || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">مكتملة</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 bg-white/10" />
              ) : (
                <div className="text-2xl font-bold text-white">{stats?.completedOrders || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-6">المنصات المدعومة</h2>
          {platformsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {platforms?.map(platform => (
                <Link key={platform.id} href={`/services?platform=${platform.id}`}>
                  <Card className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer group rounded-2xl relative overflow-hidden h-full">
                    <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
                      <div className="transform group-hover:scale-110 transition-transform duration-300">
                        {getPlatformIcon(platform.name)}
                      </div>
                      <h3 className="font-semibold text-white">{platform.name}</h3>
                      <p className="text-xs text-gray-400">{platform.servicesCount} خدمة</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
