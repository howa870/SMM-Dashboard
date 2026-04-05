import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Globe, Database, ExternalLink, RefreshCw } from "lucide-react";
import { useUserOrders } from "@/hooks/useOrdersData";
import { translateServiceName } from "@/lib/translate-service";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: "⏳ قيد التنفيذ",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" },
  processing: { label: "⚙️ جاري التنفيذ",  color: "bg-blue-500/20 text-blue-400 border-blue-500/50"     },
  completed:  { label: "✅ مكتمل",          color: "bg-green-500/20 text-green-400 border-green-500/50"   },
  cancelled:  { label: "❌ ملغي",           color: "bg-red-500/20 text-red-400 border-red-500/50"         },
  failed:     { label: "❌ فشل",            color: "bg-red-500/20 text-red-400 border-red-500/50"         },
};

export function Orders() {
  const { data: orders, isLoading, refetch } = useUserOrders();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["supabase", "orders"] });
    refetch();
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">سجل الطلبات</h1>
            <p className="text-gray-400">تتبع جميع طلباتك وحالتها • يتحدث كل 30 ثانية تلقائياً</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : !orders?.length ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center">
            <p className="text-gray-400 text-lg mb-2">لا توجد طلبات سابقة</p>
            <p className="text-gray-600 text-sm">ابدأ بطلب خدمة من صفحة الخدمات</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const isProviderOrder = !!(order as unknown as { provider_order_id?: string }).provider_order_id;
              const providerOrderId = (order as unknown as { provider_order_id?: string }).provider_order_id;

              return (
                <Card key={order.id} className="backdrop-blur-xl bg-white/5 border-white/10 overflow-hidden hover:bg-white/10 transition-colors">
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-sm font-mono text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">#{order.id}</span>
                        <Badge className={`${cfg.color} border`} variant="outline">
                          {cfg.label}
                        </Badge>
                        {isProviderOrder ? (
                          <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md">
                            <Globe className="w-3 h-3" />مزود خارجي
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-white/5 text-gray-500 border border-white/10 px-2 py-1 rounded-md">
                            <Database className="w-3 h-3" />محلي
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {format(new Date(order.created_at), "yyyy/MM/dd HH:mm")}
                        </span>
                      </div>

                      <h3 className="font-bold text-white">
                        {order.services?.name ? translateServiceName(order.services.name) : (isProviderOrder ? "خدمة مزود خارجي" : `خدمة #${order.service_id}`)}
                      </h3>

                      <p className="text-sm text-gray-400 font-mono truncate max-w-xs md:max-w-md" dir="ltr">
                        {order.link}
                      </p>

                      {providerOrderId && (
                        <div className="flex items-center gap-2 mt-1">
                          <ExternalLink className="w-3 h-3 text-gray-600" />
                          <span className="text-xs text-gray-600 font-mono">
                            رقم الطلب لدى المزود: <span className="text-gray-400">{providerOrderId}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 md:border-r border-white/10 md:pr-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">الكمية</p>
                        <p className="font-mono font-semibold text-white">{order.quantity.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">السعر</p>
                        <p className="font-mono font-bold text-purple-400">IQD {Number(order.total_price).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
