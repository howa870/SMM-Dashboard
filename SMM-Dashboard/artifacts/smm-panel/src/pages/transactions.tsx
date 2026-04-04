import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Receipt, Clock, CheckCircle2, XCircle, ImageIcon, TrendingUp } from "lucide-react";
import { useUserPayments } from "@/hooks/usePaymentsData";
import type { Payment } from "@/lib/supabase-db";

const METHOD_INFO: Record<Payment["method"], { label: string; icon: string }> = {
  zaincash: { label: "زين كاش",      icon: "💳" },
  asiacell: { label: "آسياسيل",     icon: "📱" },
  qicard:   { label: "QiCard",      icon: "💰" },
  manual:   { label: "حوالة يدوية", icon: "🏦" },
};

const STATUS_CONFIG: Record<Payment["status"], { label: string; cls: string; icon: React.ReactNode; cardBg: string }> = {
  pending:  { label: "قيد المراجعة", cls: "badge-pending",  icon: <Clock className="w-3.5 h-3.5" />,         cardBg: "border-yellow-500/15 hover:border-yellow-500/25" },
  approved: { label: "مقبول",        cls: "badge-approved", icon: <CheckCircle2 className="w-3.5 h-3.5" />,  cardBg: "border-green-500/15  hover:border-green-500/25" },
  rejected: { label: "مرفوض",        cls: "badge-rejected", icon: <XCircle className="w-3.5 h-3.5" />,       cardBg: "border-red-500/15    hover:border-red-500/25" },
};

export function Transactions() {
  const { data: payments, isLoading } = useUserPayments();

  const totalApproved = payments?.filter(p => p.status === "approved").reduce((s, p) => s + Number(p.amount), 0) || 0;
  const totalPending  = payments?.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0) || 0;
  const totalCount    = payments?.length || 0;

  return (
    <Layout>
      <div className="space-y-8 page-enter">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">سجل العمليات 📋</h1>
          <p className="text-slate-400 mt-1">جميع عمليات الشحن وحالاتها</p>
        </div>

        {/* ══ Stats Row ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Total ops */}
          <div className="glass-card p-5 flex items-center gap-4 card-hover">
            <div className="w-13 h-13 rounded-[16px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(108,92,231,0.25), rgba(108,92,231,0.1))", border: "1px solid rgba(108,92,231,0.2)" }}>
              <Receipt className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">إجمالي العمليات</p>
              <p className="text-3xl font-black text-white mt-0.5">{isLoading ? "..." : totalCount}</p>
            </div>
          </div>

          {/* Total approved */}
          <div className="glass-card p-5 flex items-center gap-4 card-hover">
            <div className="w-13 h-13 rounded-[16px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))", border: "1px solid rgba(34,197,94,0.2)" }}>
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">إجمالي المقبول</p>
              <p className="text-2xl font-black text-white mt-0.5 font-mono">
                {isLoading ? "..." : <>{totalApproved.toLocaleString()} <span className="text-sm text-slate-400 font-sans font-normal">IQD</span></>}
              </p>
            </div>
          </div>

          {/* Total pending */}
          <div className="glass-card p-5 flex items-center gap-4 card-hover">
            <div className="w-13 h-13 rounded-[16px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.25), rgba(234,179,8,0.1))", border: "1px solid rgba(234,179,8,0.2)" }}>
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">قيد المراجعة</p>
              <p className="text-2xl font-black text-white mt-0.5 font-mono">
                {isLoading ? "..." : <>{totalPending.toLocaleString()} <span className="text-sm text-slate-400 font-sans font-normal">IQD</span></>}
              </p>
            </div>
          </div>
        </div>

        {/* ══ Transactions List ══ */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              العمليات
            </h2>
            {!isLoading && totalCount > 0 && (
              <span className="text-xs text-slate-500 bg-white/5 border border-white/8 rounded-full px-3 py-1">
                {totalCount} عملية
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-[80px] rounded-[18px] bg-white/4" />
              ))}
            </div>
          ) : !payments?.length ? (
            <div className="text-center py-20 text-slate-500">
              <Receipt className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-medium text-slate-400">لا توجد عمليات سابقة</p>
              <p className="text-sm text-slate-600 mt-1">اذهب إلى المحفظة لشحن رصيدك</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((pay, idx) => {
                const cfg   = STATUS_CONFIG[pay.status];
                const mInfo = METHOD_INFO[pay.method] || { label: pay.method, icon: "💸" };
                const iconBg =
                  pay.status === "approved" ? "bg-green-500/15 border-green-500/20"  :
                  pay.status === "rejected" ? "bg-red-500/15   border-red-500/20"    :
                  "bg-yellow-500/15 border-yellow-500/20";
                return (
                  <div key={pay.id}
                    style={{ animationDelay: `${idx * 40}ms`, animationFillMode: "both" }}
                    className={`page-enter flex items-center gap-4 p-4 rounded-[18px] bg-white/4 border transition-all duration-200 card-hover ${cfg.cardBg}`}>
                    <div className={`w-12 h-12 rounded-[14px] shrink-0 flex items-center justify-center text-xl border ${iconBg}`}>
                      {mInfo.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white font-mono text-base">
                          IQD {Number(pay.amount).toLocaleString()}
                        </span>
                        <span className={cfg.cls}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
                        <span className="text-slate-400">{mInfo.label}</span>
                        {pay.transaction_id && (
                          <span className="font-mono text-slate-500">• {pay.transaction_id}</span>
                        )}
                        <span className="text-slate-600 font-mono" dir="ltr">
                          {format(new Date(pay.created_at), "yyyy/MM/dd HH:mm")}
                        </span>
                      </div>
                    </div>

                    {pay.proof_url && (
                      <a href={pay.proof_url} target="_blank" rel="noreferrer"
                        className="shrink-0 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-[10px] hover:bg-blue-500/20 transition-colors flex items-center gap-1.5 font-medium">
                        <ImageIcon className="w-3.5 h-3.5" />إثبات
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
