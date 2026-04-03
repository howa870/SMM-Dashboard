import { Layout } from "@/components/layout";
import { useGetOrders } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/50",
  processing: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/50",
  completed: "bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50",
  cancelled: "bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50",
  failed: "bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50",
};

const statusLabels = {
  pending: "قيد الانتظار",
  processing: "جاري التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
  failed: "فشل",
};

export function Orders() {
  const { data: orders, isLoading } = useGetOrders();

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">سجل الطلبات</h1>
          <p className="text-gray-400">تتبع جميع طلباتك وحالتها</p>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : orders?.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center">
            <p className="text-gray-400 text-lg">لا توجد طلبات سابقة</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders?.map(order => (
              <Card key={order.id} className="backdrop-blur-xl bg-white/5 border-white/10 overflow-hidden hover:bg-white/10 transition-colors">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">#{order.id}</span>
                      <Badge className={statusColors[order.status]} variant="outline">
                        {statusLabels[order.status]}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-lg">{order.serviceName}</h3>
                    <p className="text-sm text-gray-400 font-mono truncate max-w-[300px] md:max-w-md" dir="ltr">{order.link}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 md:border-r border-white/10 md:pr-6">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">الكمية</p>
                      <p className="font-mono font-semibold text-white">{order.quantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">السعر</p>
                      <p className="font-mono font-bold text-purple-400">IQD {order.totalPrice}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
