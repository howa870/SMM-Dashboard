import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X, Clock, CheckCircle2, XCircle, Loader2, ImageIcon, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAllPayments, useApprovePayment, useRejectPayment } from "@/hooks/usePaymentsData";
import { useProfile } from "@/hooks/useProfile";
import { notifyTelegramApproved, notifyTelegramRejected } from "@/lib/telegram";
import type { Payment } from "@/lib/supabase-db";

const METHOD_INFO: Record<Payment["method"], { label: string; icon: string }> = {
  zaincash: { label: "زين كاش",  icon: "💳" },
  asiacell: { label: "آسياسيل", icon: "📱" },
  qicard:   { label: "QiCard",  icon: "💰" },
  manual:   { label: "حوالة يدوية", icon: "🏦" },
};

const STATUS_CONFIG: Record<Payment["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "مقبول", color: "bg-green-500/20 text-green-400 border-green-500/50", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: "مرفوض", color: "bg-red-500/20 text-red-400 border-red-500/50", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const FILTERS: { value: Payment["status"] | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "مقبول" },
  { value: "rejected", label: "مرفوض" },
];

export function AdminPayments() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<Payment["status"] | "all">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") setLocation("/");
  }, [profile, profileLoading, setLocation]);

  const { data: payments, isLoading } = useAllPayments();
  const { mutateAsync: approve } = useApprovePayment();
  const { mutateAsync: reject } = useRejectPayment();
  const { toast } = useToast();

  const filtered = payments?.filter(p => filter === "all" || p.status === filter);
  const pendingCount = payments?.filter(p => p.status === "pending").length || 0;

  const handleApprove = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      await approve({ paymentId: payment.id, userId: payment.user_id, amount: payment.amount });
      await notifyTelegramApproved(payment.profiles?.email || "مجهول", payment.amount);
      toast({ title: "✅ تمت الموافقة", description: `تم إضافة IQD ${Number(payment.amount).toLocaleString()} لرصيد المستخدم.` });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      await reject({ paymentId: payment.id, userId: payment.user_id });
      await notifyTelegramRejected(payment.profiles?.email || "مجهول", payment.amount);
      toast({ title: "❌ تم الرفض" });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setActionId(null);
    }
  };

  return (
    <Layout>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="proof" className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            <div className="flex gap-2 mt-3 justify-center">
              <a href={lightboxUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg hover:bg-blue-500/20">
                <ExternalLink className="w-4 h-4" /> فتح في نافذة جديدة
              </a>
              <button onClick={() => setLightboxUrl(null)}
                className="text-sm text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">إدارة المدفوعات</h1>
            <p className="text-gray-400">مراجعة وإدارة طلبات شحن الرصيد — يتحدث تلقائياً</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-4 py-2 animate-pulse">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-bold">{pendingCount} طلب معلق</span>
            </div>
          )}
        </header>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f.value
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"}`}>
              {f.label}
              {f.value !== "all" && (
                <span className="mr-2 text-xs opacity-70">
                  ({payments?.filter(p => p.status === f.value).length || 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-white/5 animate-pulse rounded-xl" />)}</div>
        ) : !filtered?.length ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center text-gray-400">لا توجد مدفوعات في هذا القسم</Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(payment => {
              const cfg = STATUS_CONFIG[payment.status];
              const mInfo = METHOD_INFO[payment.method];
              const isActing = actionId === payment.id;

              return (
                <Card key={payment.id} className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        {/* User & Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">#{payment.id}</span>
                            <Badge variant="outline" className={`flex items-center gap-1 ${cfg.color}`}>
                              {cfg.icon}<span className="text-xs">{cfg.label}</span>
                            </Badge>
                            <span className="text-xs text-gray-500 font-mono" dir="ltr">
                              {format(new Date(payment.created_at), "yyyy/MM/dd HH:mm")}
                            </span>
                          </div>
                          <p className="font-semibold text-white">{payment.profiles?.name || "مستخدم"}</p>
                          <p className="text-xs text-gray-500">{payment.profiles?.email}</p>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white font-mono">IQD {Number(payment.amount).toLocaleString()}</p>
                          <p className="text-sm text-gray-400">{mInfo.icon} {mInfo.label}</p>
                        </div>
                      </div>

                      {/* Details Row */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/5">
                        {payment.transaction_id && (
                          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-gray-400">TXID:</span>
                            <code className="text-xs text-white font-mono">{payment.transaction_id}</code>
                          </div>
                        )}
                        {payment.notes && (
                          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-gray-400 truncate max-w-[200px]">{payment.notes}</span>
                          </div>
                        )}
                        {payment.proof_url && (
                          <button onClick={() => setLightboxUrl(payment.proof_url!)}
                            className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">
                            <ImageIcon className="w-3.5 h-3.5" />
                            عرض إثبات الدفع
                          </button>
                        )}

                        {/* Action Buttons */}
                        {payment.status === "pending" && (
                          <div className="flex items-center gap-2 mr-auto">
                            <Button size="sm"
                              className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg gap-1"
                              onClick={() => handleApprove(payment)} disabled={isActing}>
                              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              قبول
                            </Button>
                            <Button size="sm"
                              className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg gap-1"
                              onClick={() => handleReject(payment)} disabled={isActing}>
                              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                              رفض
                            </Button>
                          </div>
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
