import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/hooks/useProfile";
import { getAdminStats, getDailyPaymentStats } from "@/lib/supabase-db";
import { useQuery } from "@tanstack/react-query";
import { Users, ShoppingCart, DollarSign, CreditCard, Activity, TrendingUp, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

export function AdminDashboard() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") setLocation("/");
  }, [profile, profileLoading, setLocation]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["supabase", "admin", "stats"],
    queryFn: getAdminStats,
    refetchInterval: 60_000,
    enabled: profile?.role === "admin",
  });

  const { data: dailyData } = useQuery({
    queryKey: ["supabase", "admin", "daily-payments"],
    queryFn: getDailyPaymentStats,
    enabled: profile?.role === "admin",
  });

  const chartData = (dailyData || []).slice(-14).map(d => ({
    date: format(new Date(d.date), "MM/dd"),
    amount: d.amount,
    count: d.count,
  }));

  const statCards = [
    { label: "إجمالي المستخدمين", value: stats?.totalUsers, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "إجمالي الطلبات", value: stats?.totalOrders, icon: ShoppingCart, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "طلبات معلقة", value: stats?.pendingPayments, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "إجمالي الإيرادات", value: stats?.totalRevenue ? `IQD ${stats.totalRevenue.toLocaleString()}` : "—", icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10" },
  ];

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-400" />
            نظرة عامة
          </h1>
          <p className="text-gray-400">ملخص أداء المنصة في الوقت الفعلي</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(card => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{card.label}</CardTitle>
                  <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white font-mono">
                    {statsLoading ? (
                      <div className="h-8 w-20 bg-white/10 animate-pulse rounded" />
                    ) : (
                      card.value ?? "—"
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Chart */}
        <Card className="backdrop-blur-xl bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              المدفوعات المقبولة (آخر 14 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!chartData.length ? (
              <div className="h-48 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>لا توجد بيانات بعد</p>
                </div>
              </div>
            ) : (
              <div className="h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#a78bfa" }}
                      formatter={(v: number) => [`IQD ${v.toLocaleString()}`, "المبلغ"]}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#7c3aed" strokeWidth={2} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mini Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-400" />
                ملخص المدفوعات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "مقبولة", value: stats?.approvedPayments, color: "text-green-400" },
                { label: "معلقة", value: stats?.pendingPayments, color: "text-yellow-400" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{item.label}</span>
                  <span className={`font-bold font-mono ${item.color}`}>{statsLoading ? "..." : item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                الإيرادات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white font-mono">
                IQD {statsLoading ? "..." : (stats?.totalRevenue || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">من {stats?.approvedPayments || 0} عملية مقبولة</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
