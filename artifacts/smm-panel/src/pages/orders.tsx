import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Globe, Database, ExternalLink, RefreshCw,
  Clock, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, History, Zap, ShoppingCart,
} from "lucide-react";
import { useUserOrders } from "@/hooks/useOrdersData";
import { translateServiceName } from "@/lib/translate-service";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; stepIdx: number }> = {
  pending:    { label: "قيد الانتظار",  color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/50", icon: <Clock className="w-3 h-3" />,                          stepIdx: 0 },
  processing: { label: "جاري التنفيذ",  color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50",         icon: <Loader2 className="w-3 h-3 animate-spin" />,             stepIdx: 1 },
  completed:  { label: "مكتمل",          color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50",     icon: <CheckCircle2 className="w-3 h-3" />,                     stepIdx: 2 },
  cancelled:  { label: "ملغي",           color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50",             icon: <XCircle className="w-3 h-3" />,                          stepIdx: -1 },
  failed:     { label: "فشل",            color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50",             icon: <XCircle className="w-3 h-3" />,                          stepIdx: -1 },
};

const PROGRESS_STEPS = [
  { key: "pending",    label: "انتظار" },
  { key: "processing", label: "تنفيذ" },
  { key: "completed",  label: "مكتمل" },
];

function OrderProgress({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isFailed = status === "cancelled" || status === "failed";
  const currentIdx = cfg.stepIdx;

  if (isFailed) {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <XCircle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-xs text-red-500">{cfg.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-2.5">
      {PROGRESS_STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`order-progress-dot ${done ? "order-progress-dot--done" : active ? "order-progress-dot--active" : "order-progress-dot--idle"}`}>
                {done && <CheckCircle2 className="w-2 h-2" />}
              </div>
              <span className={`text-[9px] font-medium whitespace-nowrap ${done || active ? "order-progress-label--active" : "order-progress-label--idle"}`}>
                {step.label}
              </span>
            </div>
            {idx < PROGRESS_STEPS.length - 1 && (
              <div className={`h-px flex-1 mb-3 transition-colors ${idx < currentIdx ? "order-progress-line--done" : "order-progress-line--idle"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Orders() {
  const { data: orders, isLoading, refetch } = useUserOrders();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["supabase", "orders"] });
    refetch();
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold db-text mb-1">سجل الطلبات</h1>
            <p className="db-muted text-sm">تتبع جميع طلباتك وحالتها</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium active:scale-95 db-refresh-btn"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:block">تحديث</span>
          </button>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl db-skeleton" />
            ))}
          </div>
        ) : !orders?.length ? (
          <div className="db-empty-state flex flex-col items-center justify-center py-16 rounded-2xl text-center gap-4">
            <div className="db-empty-icon-wrap w-20 h-20 rounded-full flex items-center justify-center mb-2">
              <History className="w-10 h-10 db-empty-icon" />
            </div>
            <div>
              <p className="db-text font-bold text-xl mb-1">لا توجد طلبات بعد</p>
              <p className="db-muted text-sm">ابدأ بطلب خدمتك الأولى وستظهر هنا</p>
            </div>
            <Link href="/services"
              className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 hover:scale-105 transition-all">
              <Zap className="w-4 h-4" />
              تصفح الخدمات وابدأ الآن
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const isProviderOrder = !!(order as unknown as { provider_order_id?: string }).provider_order_id;
              const providerOrderId = (order as unknown as { provider_order_id?: string }).provider_order_id;
              const isExpanded = expandedId === order.id;

              return (
                <Card key={order.id} className="db-order-card overflow-hidden transition-all duration-200">

                  {/* ── Mobile layout (collapsed) ── */}
                  <div className="md:hidden p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-purple-500 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">#{order.id}</span>
                          <Badge className={`${cfg.color} border text-[11px] px-2 py-0.5`} variant="outline">
                            <span className="flex items-center gap-1">{cfg.icon}{cfg.label}</span>
                          </Badge>
                        </div>
                        <h3 className="font-semibold db-text text-sm leading-snug line-clamp-2">
                          {order.services?.name ? translateServiceName(order.services.name) : (isProviderOrder ? "خدمة مزود خارجي" : `خدمة #${order.service_id}`)}
                        </h3>
                        <p className="text-xs db-muted mt-0.5">
                          {format(new Date(order.created_at), "yyyy/MM/dd HH:mm")}
                        </p>
                        <OrderProgress status={order.status} />
                      </div>
                      <button
                        onClick={() => toggleExpand(order.id)}
                        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center db-expand-btn transition-all mt-0.5"
                        aria-label={isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                      >
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Expanded details on mobile */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 db-order-expanded space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="db-muted">الكمية</span>
                          <span className="font-mono font-semibold db-text">{order.quantity.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="db-muted">السعر</span>
                          <span className="font-mono font-bold text-purple-500 dark:text-purple-400">IQD {Number(order.total_price).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="db-muted">المصدر</span>
                          <span className="flex items-center gap-1 text-xs">
                            {isProviderOrder ? <Globe className="w-3 h-3 text-blue-400" /> : <Database className="w-3 h-3 db-muted" />}
                            {isProviderOrder ? "مزود خارجي" : "محلي"}
                          </span>
                        </div>
                        <div className="flex items-start justify-between text-sm gap-2">
                          <span className="db-muted shrink-0">الرابط</span>
                          <p className="font-mono text-xs db-muted truncate max-w-[180px]" dir="ltr">{order.link}</p>
                        </div>
                        {providerOrderId && (
                          <div className="flex items-center gap-1.5 text-xs db-muted">
                            <ExternalLink className="w-3 h-3" />
                            <span>رقم المزود: <span className="font-mono">{providerOrderId}</span></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Desktop layout ── */}
                  <div className="hidden md:flex p-5 items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-sm font-mono text-purple-500 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">#{order.id}</span>
                        <Badge className={`${cfg.color} border`} variant="outline">
                          <span className="flex items-center gap-1.5">{cfg.icon}{cfg.label}</span>
                        </Badge>
                        {isProviderOrder ? (
                          <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-md">
                            <Globe className="w-3 h-3" />مزود خارجي
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs db-muted db-border-btn px-2 py-1 rounded-md">
                            <Database className="w-3 h-3" />محلي
                          </span>
                        )}
                        <span className="text-xs db-muted">
                          {format(new Date(order.created_at), "yyyy/MM/dd HH:mm")}
                        </span>
                      </div>

                      <h3 className="font-bold db-text">
                        {order.services?.name ? translateServiceName(order.services.name) : (isProviderOrder ? "خدمة مزود خارجي" : `خدمة #${order.service_id}`)}
                      </h3>

                      <p className="text-sm db-muted font-mono truncate max-w-xs md:max-w-md" dir="ltr">
                        {order.link}
                      </p>

                      {providerOrderId && (
                        <div className="flex items-center gap-2 mt-1">
                          <ExternalLink className="w-3 h-3 db-muted" />
                          <span className="text-xs db-muted font-mono">
                            رقم الطلب لدى المزود: <span className="db-text">{providerOrderId}</span>
                          </span>
                        </div>
                      )}

                      <OrderProgress status={order.status} />
                    </div>

                    <div className="flex items-center gap-6 db-order-divider md:pl-6">
                      <div className="text-center">
                        <p className="text-xs db-muted mb-1">الكمية</p>
                        <p className="font-mono font-semibold db-text">{order.quantity.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs db-muted mb-1">السعر</p>
                        <p className="font-mono font-bold text-purple-500 dark:text-purple-400">IQD {Number(order.total_price).toLocaleString()}</p>
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
