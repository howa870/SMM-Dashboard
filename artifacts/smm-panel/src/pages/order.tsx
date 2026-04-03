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
  Wallet, Globe, Database, CheckCircle2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { useSupabaseAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api/smm";

// Call our backend /api/smm/order (handles balance + Followiz + DB in one step)
async function placeOrder(params: {
  service_id: number;
  link: string;
  quantity: number;
  token: string;
}): Promise<{ ok: boolean; order_id: number; provider_order_id: string | null; total_price: number; error?: string }> {
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
    order?: { id: number };
    provider_order_id?: string;
    total_price?: number;
    error?: string;
  };
  if (!res.ok || !json.ok) throw new Error(json.error || "فشل إنشاء الطلب");
  return {
    ok:               true,
    order_id:         json.order?.id || 0,
    provider_order_id:json.provider_order_id || null,
    total_price:      json.total_price || 0,
  };
}

export function NewOrder() {
  const searchParams = new URLSearchParams(useSearch());

  // Service params from URL (set by services page "Order" button)
  const serviceId   = Number(searchParams.get("sid")      || "0");
  const serviceName =        searchParams.get("sname")    ? decodeURIComponent(searchParams.get("sname")!) : "";
  const servicePrice= Number(searchParams.get("sprice")   || "0");
  const serviceMin  = Number(searchParams.get("smin")     || "10");
  const serviceMax  = Number(searchParams.get("smax")     || "100000");
  const sProvider   =        searchParams.get("sprovider") || "local";

  const [link,     setLink]     = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [qError,   setQError]   = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [, setLocation]    = useLocation();
  const { toast }          = useToast();
  const queryClient        = useQueryClient();
  const { supabaseUser }   = useSupabaseAuth();
  const { data: profile }  = useProfile();

  const balance          = Number(profile?.balance || 0);
  const isProvider       = sProvider === "followiz";

  // Price calculation: price is per 1000
  const totalPrice = useMemo(() => {
    if (!quantity || !servicePrice) return 0;
    return Math.ceil((Number(quantity) * servicePrice) / 1000);
  }, [quantity, servicePrice]);

  const hasEnoughBalance = balance >= totalPrice;

  const validateQty = (val: number): boolean => {
    if (val < serviceMin) {
      setQError(`أقل كمية هي ${serviceMin.toLocaleString()}`);
      return false;
    }
    if (val > serviceMax) {
      setQError(`أقصى كمية هي ${serviceMax.toLocaleString()}`);
      return false;
    }
    setQError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !serviceId || !link || !quantity) return;
    if (!validateQty(Number(quantity))) return;
    if (!hasEnoughBalance) {
      toast({ variant: "destructive", title: "رصيد غير كافٍ", description: `رصيدك IQD ${balance.toLocaleString()} — مطلوب IQD ${totalPrice.toLocaleString()}` });
      return;
    }

    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("الجلسة منتهية، سجّل الدخول مجدداً");

      const result = await placeOrder({
        service_id: serviceId,
        link,
        quantity:   Number(quantity),
        token,
      });

      // Refresh profile balance + orders list
      queryClient.invalidateQueries({ queryKey: ["supabase", "profile", supabaseUser.id] });
      queryClient.invalidateQueries({ queryKey: ["supabase", "orders"] });

      const successText = result.provider_order_id
        ? `✅ تم إرسال الطلب عبر المزود!\nرقم الطلب: ${result.provider_order_id}\nالتكلفة: IQD ${result.total_price.toLocaleString()}`
        : `✅ تم إنشاء الطلب بنجاح!\nرقم الطلب: ${result.order_id}\nالتكلفة: IQD ${result.total_price.toLocaleString()}`;
      setSuccessMsg(successText);

      toast({ title: "✅ تم إنشاء الطلب بنجاح" });
      setLink("");
      setQuantity("");
      setQError(null);

      setTimeout(() => setLocation("/orders"), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ، حاول مرة أخرى";
      toast({ variant: "destructive", title: "خطأ في إنشاء الطلب", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && !!link && !!quantity && !qError && hasEnoughBalance && serviceId > 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">طلب جديد</h1>
          <p className="text-gray-400">أدخل تفاصيل طلبك وسيتم تنفيذه تلقائياً</p>
        </header>

        {/* Balance Card */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <Wallet className="w-5 h-5 text-purple-400" />
          <span className="text-gray-400 text-sm">رصيدك الحالي:</span>
          <span className="font-bold text-white font-mono text-lg">IQD {balance.toLocaleString()}</span>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <pre className="text-green-300 text-sm whitespace-pre-wrap font-sans">{successMsg}</pre>
          </div>
        )}

        <Card className="backdrop-blur-xl bg-white/5 border-white/10">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Service Info */}
              {serviceId > 0 ? (
                <div className={`rounded-xl p-4 space-y-2 border ${
                  isProvider
                    ? "bg-purple-500/10 border-purple-500/20"
                    : "bg-blue-500/10 border-blue-500/20"
                }`}>
                  <div className={`flex items-center gap-2 font-semibold text-sm ${isProvider ? "text-purple-400" : "text-blue-400"}`}>
                    {isProvider ? <Globe className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                    {isProvider ? "خدمة مزود خارجي (Followiz)" : "خدمة محلية"}
                  </div>
                  <p className="text-white font-medium">{serviceName}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400 font-mono">
                    <span>رقم الخدمة: <strong className="text-white">#{serviceId}</strong></span>
                    <span>السعر/1000: <strong className="text-purple-300">IQD {servicePrice.toLocaleString()}</strong></span>
                    <span>أقل: <strong className="text-white">{serviceMin.toLocaleString()}</strong></span>
                    <span>أقصى: <strong className="text-white">{serviceMax.toLocaleString()}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                  لم تختر خدمة — ارجع إلى{" "}
                  <a href="/services" className="underline">صفحة الخدمات</a> واختر خدمة أولاً
                </div>
              )}

              {/* Link */}
              <div className="space-y-2">
                <Label className="text-gray-300">الرابط (Link)</Label>
                <div className="relative">
                  <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    value={link}
                    onChange={e => setLink(e.target.value)}
                    required
                    placeholder="https://..."
                    className="pl-4 pr-10 h-12 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  الكمية
                  <span className="text-gray-500 text-xs mr-2">
                    ({serviceMin.toLocaleString()} — {serviceMax.toLocaleString()})
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
                  className={`h-12 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl ${qError ? "border-red-500/50" : ""}`}
                  dir="ltr"
                />
                {qError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />{qError}
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/30">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">التكلفة الإجمالية</p>
                      <p className="text-2xl font-bold text-white font-mono">IQD {totalPrice.toLocaleString()}</p>
                      {totalPrice > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {Number(quantity).toLocaleString()} × IQD {servicePrice.toLocaleString()} ÷ 1000
                        </p>
                      )}
                    </div>
                  </div>
                  {totalPrice > 0 && !hasEnoughBalance && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      رصيد غير كافٍ
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20 font-bold text-lg disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "تأكيد الطلب"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
