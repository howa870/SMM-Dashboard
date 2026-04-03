import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useAdminGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShoppingCart, DollarSign, CreditCard, Activity } from "lucide-react";
import { useLocation } from "wouter";

export function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: stats, isLoading } = useAdminGetStats();

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Activity className="w-8 h-8 text-purple-400" />
            نظرة عامة (الإدارة)
          </h1>
          <p className="text-gray-400">ملخص سريع لأداء المنصة</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">إجمالي المستخدمين</CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{isLoading ? "..." : stats?.totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">إجمالي الطلبات</CardTitle>
              <ShoppingCart className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{isLoading ? "..." : stats?.totalOrders}</div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">المدفوعات المعلقة</CardTitle>
              <CreditCard className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{isLoading ? "..." : stats?.pendingPayments}</div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">إجمالي الإيرادات</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">IQD {isLoading ? "..." : stats?.totalRevenue?.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
