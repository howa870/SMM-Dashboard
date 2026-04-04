import { Layout } from "@/components/layout";
import { useSearch, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Link as LinkIcon, Calculator, AlertTriangle,
  Wallet, Globe, CheckCircle2, ArrowRight, ShoppingCart,
  TrendingDown, TrendingUp, Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { useSupabaseAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") + "/api/smm";

// ─── Step tracker for order submission ─────────────────────────────────────────
type Step = "idle" | "deducting" | "sending" | "saving" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:      "",
  deducting: "جاري خصم الرصيد...",
  sending:   "إرسال الطلب للمزود...",
  saving:    "حفظ الطلب...",
  done:      "تم بنجاح!",
  error:     "حدث خطأ",
};

// ─── Place order API call ───────────────────────────────────────────────────────
async function placeOrder(params: {
  service_id: number | string;
  link: string;
  quantity: number;
  token: string;
}): Promise<{
  ok: boolean;
  order_id: number;
  provider_order_id: string | null;
  total_price: number;
  message: string;
}> {
  const res = await fetch(`${BASE}/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      service_id: params.service_id,
      link:       params.link,
      quantity:   params.quantity,
    }),
  });
  const json = await res.json() as {
    ok: boolean;
    order_id?: number;
    order?: { id: number };
    provider_order_id?: string;
    total_price?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok || !json.ok) throw new Error(json.error || "فشل إنشاء الطلب");
  return {
    ok:                true,
    order_id:          json.order_id || json.order?.id || 0,
    provider_order_id: json.provider_order_id || null,
    total_price:       json.total_price || 0,
    message:           json.message || "تم إنشاء الطلب بنجاح",
  };
}

// ─── Main Order Page ────────────────────────────────────────────────────────────
export function NewOrder() {
  const searchParams = new URLSearchParams(useSearch());

  // Service params passed from services page via URL
  const serviceId    = searchParams.get("sid") || "0";
  const serviceName  = searchParams.get("sname")    ? decodeURIComponent(searchParams.get("sname")!)    : "";
  const servicePrice = Number(searchParams.get("sprice")   || "0");
  const serviceMin   = Number(searchParams.get("smin")     || "10");
  const serviceMax   = Number(searchParams.get("smax")     || "100000");
  const sProvider    =        searchParams.get("sprovider") ? decodeURIComponent(searchParams.get("sprovider")!) : "local";

  const [link,       setLink]       = useState("");
  const [quantity,   setQuantity]   = useState<number | "">("");
  const [qError,     setQError]     = useState<string | null>(null);
  const [step,       setStep]       = useState<Step>("idle");
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    order_id: number; provider_order_id: string | null; total_price: number; message: string;
  } | null>(null);

  const [, setLocation]   = useLocation();
  const { toast }         = useToast();
  const queryClient       = useQueryClient();
  const { supabaseUser }  = useSupabaseAuth();
  const { data: profile } = useProfile();

  const balance        = Number(profile?.balance || 0);
  const isProvider     = sProvider === "followiz";
  const serviceIdNum   = Number(serviceId);

  // Price calculation
  const totalPrice = useMemo(() => {
    if (!quantity || !servicePrice) return 0;
    return Math.ceil((Number(quantity) * servicePrice) / 1000);
  }, [quantity, servicePrice]);

  const hasEnoughBalance = balance >= totalPrice;
  const submitting       = step !== "idle" && step !== "done" && step !== "error";

  const validateQty = (val: number): boolean => {
    if (val < serviceMin) { setQError(`أقل كمية مسموحة: ${serviceMin.toLocaleString()}`); return false; }
    if (val > serviceMax) { setQError(`أقصى كمية مسموحة: ${serviceMax.toLocaleString()}`); return false; }
    setQError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !serviceId || serviceId === "0" || !link || !quantity) return;
    if (!validateQty(Number(quantity))) return;
    if (!hasEnoughBalance) {
      toast({ variant: "destructive", title: "رصيد غير كافٍ",
        description: `رصيدك IQD ${balance.toLocaleString()} — المطلوب IQD ${totalPrice.toLocaleString()}` });
      return;
    }

    setStep("deducting");
    setErrorMsg(null);
    setSuccessData(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");

      setStep("sending");
      const result = await placeOrder({
        service_id: serviceId,   // pass as-is (backend resolves Followiz ID too)
        link,
        quantity:   Number(quantity),
        token,
      });

      setStep("saving");
      await new Promise(r => setTimeout(r, 400)); // brief pause for UX

      setStep("done");
      setSuccessData(result);

      queryClient.invalidateQueries({ queryKey: ["supabase", "profile", supabaseUser.id] });
      queryClient.invalidateQueries({ queryKey: ["supabase", "orders"] });

      toast({ title: "✅ تم تنفيذ الطلب بنجاح" });
      setLink("");
      setQuantity("");
      setQError(null);

      setTimeout(() => setLocation("/orders"), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ، حاول مرة أخرى";
      setStep("error");
      setErrorMsg(msg);
      toast({ variant: "destructive", title: "فشل الطلب", description: msg });
    }
  };

  const canSubmit = !submitting && step !== "done" && !!link && !!quantity
    && !qError && hasEnoughBalance && serviceId !== "0";

  // ─── No service selected ─────────────────────────────────────────────────────
  if (serviceId === "0" || !serviceName) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto pt-16 text-center space-y-4">
          <div className="text-6xl">🛒</div>
          <h2 className="text-xl font-bold text-white">لم تختر خدمة بعد</h2>
          <p className="text-gray-400">يرجى اختيار خدمة من قائمة الخدمات أولاً</p>
          <Button onClick={() => setLocation("/services")}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl">
            <ArrowRight className="w-4 h-4 ml-2" />
            عرض الخدمات
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-500">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <button onClick={() => setLocation("/services")} className="hover:text-white transition-colors">
              الخدمات
            </button>
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="text-white">طلب جديد</span>
          </div>
          <h1 className="text-2xl font-bold text-white">تنفيذ الطلب</h1>
        </div>

        {/* ── Balance ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
          <Wallet className="w-5 h-5 text-purple-400 shrink-0" />
          <span className="text-gray-400 text-sm">رصيدك الحالي</span>
          <span className="font-bold text-white font-mono text-base mr-auto">IQD {balance.toLocaleString()}</span>
        </div>

        {/* ── Service Card ──────────────────────────────────────────────────── */}
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-600/15 to-blue-600/15 border border-purple-500/25 space-y-3">
          <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
            <Globe className="w-4 h-4" />
            <span>{isProvider ? "خدمة مزود Followiz" : "خدمة محلية"}</span>
          </div>
          <p className="text-white font-semibold leading-snug">{serviceName}</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs">
              <TrendingDown className="w-3.5 h-3.5 text-green-400" />
              <span className="text-gray-400">أقل: </span>
              <span className="text-white font-mono font-bold">{serviceMin.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-gray-400">أقصى: </span>
              <span className="text-white font-mono font-bold">{serviceMax.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-gray-400">السعر/1000: </span>
              <span className="text-purple-300 font-mono font-bold">IQD {servicePrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Success Banner ────────────────────────────────────────────────── */}
        {step === "done" && successData && (
          <div className="rounded-2xl p-5 bg-green-500/10 border border-green-500/25 space-y-3">
            <div className="flex items-center gap-2 text-green-400 font-bold text-lg">
              <CheckCircle2 className="w-6 h-6" />
              <span>تم تنفيذ الطلب بنجاح!</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="px-3 py-2 rounded-lg bg-white/5">
                <p className="text-gray-500 text-xs mb-0.5">رقم الطلب</p>
                <p className="text-white font-mono font-bold">#{successData.order_id}</p>
              </div>
              {successData.provider_order_id && (
                <div className="px-3 py-2 rounded-lg bg-white/5">
                  <p className="text-gray-500 text-xs mb-0.5">رقم المزود</p>
                  <p className="text-white font-mono font-bold">{successData.provider_order_id}</p>
                </div>
              )}
              <div className="px-3 py-2 rounded-lg bg-white/5">
                <p className="text-gray-500 text-xs mb-0.5">المبلغ المخصوم</p>
                <p className="text-red-400 font-mono font-bold">IQD {successData.total_price.toLocaleString()}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-white/5">
                <p className="text-gray-500 text-xs mb-0.5">الحالة</p>
                <p className="text-yellow-400 font-bold">قيد التنفيذ</p>
              </div>
            </div>
            <p className="text-green-300/70 text-xs">سيتم توجيهك لصفحة طلباتك خلال ثوانٍ...</p>
          </div>
        )}

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {step === "error" && errorMsg && (
          <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/25 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">فشل تنفيذ الطلب</p>
              <p className="text-red-300/80 text-xs mt-1">{errorMsg}</p>
              <button onClick={() => setStep("idle")}
                className="text-xs text-red-400 underline mt-2 hover:text-red-300">
                حاول مرة أخرى
              </button>
            </div>
          </div>
        )}

        {/* ── Order Form ────────────────────────────────────────────────────── */}
        {step !== "done" && (
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Link */}
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-sm">رابط الحساب / المنشور</Label>
                  <div className="relative">
                    <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      value={link}
                      onChange={e => setLink(e.target.value)}
                      required
                      placeholder="https://instagram.com/username"
                      disabled={submitting}
                      className="pl-4 pr-10 h-11 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl font-mono text-sm text-left disabled:opacity-60"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-sm flex items-center justify-between">
                    <span>الكمية</span>
                    <span className="text-gray-600 text-xs font-mono">
                      {serviceMin.toLocaleString()} — {serviceMax.toLocaleString()}
                    </span>
                  </Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={e => {
                      const v = e.target.value === "" ? "" : Number(e.target.value);
                      setQuantity(v);
                      if (v !== "") validateQty(Number(v));
                      else setQError(null);
                    }}
                    required
                    min={serviceMin}
                    max={serviceMax}
                    placeholder={serviceMin.toLocaleString()}
                    disabled={submitting}
                    className={`h-11 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl text-sm disabled:opacity-60 ${qError ? "border-red-500/50" : ""}`}
                    dir="ltr"
                  />
                  {qError && (
                    <div className="flex items-center gap-1.5 text-red-400 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />{qError}
                    </div>
                  )}
                </div>

                {/* Price summary */}
                {totalPrice > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Calculator className="w-4 h-4 text-purple-400" />
                      <span>التكلفة الإجمالية</span>
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold font-mono text-xl">IQD {totalPrice.toLocaleString()}</p>
                      <p className="text-gray-600 text-xs font-mono">
                        {Number(quantity).toLocaleString()} × {servicePrice.toLocaleString()} ÷ 1000
                      </p>
                    </div>
                  </div>
                )}

                {/* Insufficient balance warning */}
                {totalPrice > 0 && !hasEnoughBalance && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>رصيدك غير كافٍ — <a href="/wallet" className="underline">اشحن رصيدك الآن</a></span>
                  </div>
                )}

                {/* Step progress indicator */}
                {submitting && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{STEP_LABELS[step]}</span>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20 font-bold text-base disabled:opacity-40 transition-all"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {STEP_LABELS[step]}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      تنفيذ الطلب
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}
