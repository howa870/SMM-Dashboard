import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Receipt, Clock, CheckCircle2, XCircle, ImageIcon } from "lucide-react";
import { useUserPayments } from "@/hooks/usePaymentsData";
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

export function Transactions() {
  const { data: payments, isLoading } = useUserPayments();

  const totalApproved = payments?.filter(p => p.status === "approved").reduce((s, p) => s + Number(p.amount), 0) || 0;
  const totalPending = payments?.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0) || 0;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">سجل العمليات</h1>
          <p className="text-gray-400">جميع عمليات الشحن وحالاتها</p>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">إجمالي العمليات</p>
                <p className="text-2xl font-bold text-white">{isLoading ? "..." : payments?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">إجمالي المقبول</p>
                <p className="text-2xl font-bold text-white font-mono">IQD {totalApproved.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">قيد المراجعة</p>
                <p className="text-2xl font-bold text-white font-mono">IQD {totalPending.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <Card className="backdrop-blur-xl bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">العمليات</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />)}
              </div>
            ) : !payments?.length ? (
              <div className="text-center py-16 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد عمليات سابقة</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {payments.map(pay => {
                  const cfg = STATUS_CONFIG[pay.status];
                  const mInfo = METHOD_INFO[pay.method];
                  return (
                    <div key={pay.id} className="py-4 flex items-center gap-4 hover:bg-white/5 transition-colors rounded-xl px-3 -mx-3">
                      <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-lg ${
                        pay.status === "approved" ? "bg-green-500/20" :
                        pay.status === "rejected" ? "bg-red-500/20" : "bg-yellow-500/20"}`}>
                        {mInfo.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white font-mono">IQD {Number(pay.amount).toLocaleString()}</span>
                          <Badge variant="outline" className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                            {cfg.icon}{cfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">{mInfo.label}</span>
                          {pay.transaction_id && <span className="text-xs font-mono text-gray-500">{pay.transaction_id}</span>}
                          <span className="text-xs text-gray-600 font-mono" dir="ltr">{format(new Date(pay.created_at), "yyyy/MM/dd HH:mm")}</span>
                        </div>
                      </div>
                      {pay.proof_url && (
                        <a href={pay.proof_url} target="_blank" rel="noreferrer"
                          className="shrink-0 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg hover:bg-blue-500/20">
                          <ImageIcon className="w-3.5 h-3.5 inline ml-1" />إثبات
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
