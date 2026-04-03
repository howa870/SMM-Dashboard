import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useAdminGetOrders, useAdminUpdateOrderStatus, getAdminGetOrdersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const statusLabels = {
  pending: "قيد الانتظار",
  processing: "جاري التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
  failed: "فشل",
};

export function AdminOrders() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: orders, isLoading } = useAdminGetOrders();
  const { mutate: updateStatus } = useAdminUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStatusChange = (id: number, status: any) => {
    updateStatus({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: "تم تحديث حالة الطلب" });
        queryClient.invalidateQueries({ queryKey: getAdminGetOrdersQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "خطأ", description: err.error });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">إدارة الطلبات</h1>
          <p className="text-gray-400">تحديث حالات طلبات المستخدمين</p>
        </header>

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-gray-400">جاري التحميل...</p>
          ) : orders?.length === 0 ? (
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-8 text-center text-gray-400">
              لا توجد طلبات
            </Card>
          ) : (
            orders?.map(order => (
              <Card key={order.id} className="backdrop-blur-xl bg-white/5 border-white/10">
                <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-400">#{order.id}</span>
                      <span className="text-white font-bold">{order.serviceName}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      <p>المستخدم: {order.userName}</p>
                      <p className="font-mono truncate" dir="ltr">{order.link}</p>
                    </div>
                  </div>

                  <div className="text-center md:border-r md:border-l border-white/10 px-6">
                    <p className="text-xs text-gray-500 mb-1">السعر / الكمية</p>
                    <p className="text-white font-mono font-bold">IQD {order.totalPrice} / {order.quantity}</p>
                  </div>

                  <div className="shrink-0 w-40">
                    <Select defaultValue={order.status} onValueChange={(val) => handleStatusChange(order.id, val)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white w-full" dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
