import { Layout } from "@/components/layout";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { SupabaseOrder } from "@/lib/supabase-db";

type AdminOrder = SupabaseOrder & {
  profiles?: { name: string | null; email: string | null };
};

async function getAllOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(name), profiles(name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AdminOrder[];
}

async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw error;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "جاري التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
  failed: "فشل",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400",
  processing: "text-blue-400",
  completed: "text-green-400",
  cancelled: "text-red-400",
  failed: "text-red-400",
};

export function AdminOrders() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") setLocation("/");
  }, [profile, profileLoading, setLocation]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["supabase", "admin", "orders"],
    queryFn: getAllOrders,
    enabled: profile?.role === "admin",
    refetchInterval: 30_000,
  });

  const { mutate: changeStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "admin", "orders"] });
      toast({ title: "✅ تم تحديث حالة الطلب" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    },
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-purple-400" />
              إدارة الطلبات
            </h1>
            <p className="text-gray-400">تحديث حالات طلبات المستخدمين</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center">
            <p className="text-2xl font-bold text-white">{orders?.length || 0}</p>
            <p className="text-xs text-gray-400">إجمالي الطلبات</p>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />)}</div>
        ) : !orders?.length ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center text-gray-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد طلبات</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <Card key={order.id} className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-purple-400 text-sm bg-purple-400/10 px-2 py-0.5 rounded">#{order.id}</span>
                      <span className="text-white font-bold">{(order as AdminOrder).services?.name || `خدمة #${order.service_id}`}</span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-0.5">
                      <p>{(order as AdminOrder).profiles?.name || (order as AdminOrder).profiles?.email || "مستخدم"}</p>
                      <p className="font-mono truncate text-gray-500 text-xs" dir="ltr">{order.link}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-mono" dir="ltr">{format(new Date(order.created_at), "yyyy/MM/dd HH:mm")}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-left" dir="ltr">
                      <p className="text-xs text-gray-500 text-right mb-0.5">الكمية / السعر</p>
                      <p className="font-mono font-bold text-white text-right">
                        {order.quantity.toLocaleString()} / <span className="text-purple-400">IQD {Number(order.total_price).toLocaleString()}</span>
                      </p>
                    </div>

                    <Select defaultValue={order.status} onValueChange={val => changeStatus({ id: order.id, status: val })}>
                      <SelectTrigger className="bg-white/5 border-white/10 w-40 rounded-xl" dir="rtl">
                        <SelectValue>
                          <span className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status] || order.status}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            <span className={STATUS_COLORS[key]}>{label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
