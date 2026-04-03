import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAllPayments, useApprovePayment, useRejectPayment } from "@/hooks/usePaymentsData";
import { useProfile } from "@/hooks/useProfile";
import type { Payment } from "@/lib/supabase-db";

const METHOD_INFO: Record<Payment["method"], { label: string; icon: string }> = {
  zaincash: { label: "زين كاش", icon: "💳" },
  qicard: { label: "QiCard", icon: "💰" },
  manual: { label: "حوالة يدوية", icon: "🏦" },
};

const STATUS_CONFIG: Record<Payment["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "مقبول", color: "bg-green-500/20 text-green-400 border-green-500/50", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: "مرفوض", color: "bg-red-500/20 text-red-400 border-red-500/50", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const ALL_FILTERS: { value: Payment["status"] | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "مقبول" },
  { value: "rejected", label: "مرفوض" },
];

export function AdminPayments() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<Payment["status"] | "all">("pending");
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") {
      setLocation("/");
    }
  }, [profile, profileLoading, setLocation]);

  const { data: payments, isLoading } = useAllPayments();
  const { mutateAsync: approve } = useApprovePayment();
  const { mutateAsync: reject } = useRejectPayment();
  const { toast } = useToast();

  const filtered = payments?.filter(p => filter === "all" || p.status === filter);

  const handleApprove = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      await approve({ paymentId: payment.id, userId: payment.user_id, amount: payment.amount });
      toast({ title: "✅ تمت الموافقة على طلب الشحن", description: `تم إضافة IQD ${Number(payment.amount).toLocaleString()} لرصيد المستخدم.` });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "خطأ في القبول", description: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      await reject(payment.id);
      toast({ title: "❌ تم رفض طلب الشحن" });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "خطأ في الرفض", description: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = payments?.filter(p => p.status === "pending").length || 0;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">إدارة المدفوعات</h1>
            <p className="text-gray-400">مراجعة وإدارة طلبات شحن الرصيد</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-4 py-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-bold">{pendingCount} طلب معلق</span>
            </div>
          )}
        </header>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {ALL_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f.value
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="mr-2 text-xs opacity-70">
                  ({payments?.filter(p => p.status === f.value).length || 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table Header (desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">المستخدم</div>
          <div className="col-span-2">المبلغ</div>
          <div className="col-span-2">الطريقة</div>
          <div className="col-span-2">رقم العملية</div>
          <div className="col-span-1">الحالة</div>
          <div className="col-span-2 text-left">إجراء</div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : !filtered?.length ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center text-gray-400">
            لا توجد مدفوعات في هذا القسم
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(payment => {
              const cfg = STATUS_CONFIG[payment.status];
              const mInfo = METHOD_INFO[payment.method];
              const isActing = actionId === payment.id;

              return (
                <Card key={payment.id} className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-4">

                      {/* User */}
                      <div className="md:col-span-3">
                        <p className="font-semibold text-white">
                          {payment.profiles?.name || "مستخدم"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{payment.profiles?.email || payment.user_id.slice(0, 16) + "..."}</p>
                        <p className="text-xs text-gray-600 font-mono mt-1" dir="ltr">
                          {format(new Date(payment.created_at), "yyyy/MM/dd HH:mm")}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="md:col-span-2">
                        <p className="font-bold text-white font-mono text-lg">
                          IQD {Number(payment.amount).toLocaleString()}
                        </p>
                      </div>

                      {/* Method */}
                      <div className="md:col-span-2">
                        <p className="text-white flex items-center gap-2">
                          <span>{mInfo.icon}</span>
                          <span>{mInfo.label}</span>
                        </p>
                      </div>

                      {/* Transaction ID */}
                      <div className="md:col-span-2">
                        <p className="text-gray-400 font-mono text-sm">
                          {payment.transaction_id || "—"}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-gray-600 mt-1 truncate">{payment.notes}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="md:col-span-1">
                        <Badge variant="outline" className={`flex items-center gap-1 w-fit ${cfg.color}`}>
                          {cfg.icon}
                          <span className="text-xs">{cfg.label}</span>
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 flex items-center gap-2 md:justify-end">
                        {payment.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300 rounded-lg"
                              onClick={() => handleApprove(payment)}
                              disabled={isActing}
                            >
                              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 ml-1" />}
                              قبول
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg"
                              onClick={() => handleReject(payment)}
                              disabled={isActing}
                            >
                              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 ml-1" />}
                              رفض
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-600">لا يوجد إجراء</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
