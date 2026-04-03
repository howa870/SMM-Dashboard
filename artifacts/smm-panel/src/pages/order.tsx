import { Layout } from "@/components/layout";
import { useSearch, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, Calculator, AlertTriangle, Wallet, Globe, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlatforms, useServices } from "@/hooks/useServicesData";
import { useProfile } from "@/hooks/useProfile";
import { useSupabaseAuth } from "@/context/AuthContext";
import { submitOrder, deductBalance } from "@/lib/supabase-db";
import { createFollowizOrder } from "@/lib/smm";
import { supabase } from "@/lib/supabase";

export function NewOrder() {
  const searchParams = new URLSearchParams(useSearch());
  const isProvider    = searchParams.get("provider") === "1";
  const defaultPlatformId = searchParams.get("platformId") || "";
  const defaultServiceId  = searchParams.get("serviceId")  || "";

  // Provider service params (from Followiz services page)
  const providerServiceId   = searchParams.get("pid")   || "";
  const providerRate        = searchParams.get("prate") || "";
  const providerMin         = Number(searchParams.get("pmin")  || "10");
  const providerMax         = Number(searchParams.get("pmax")  || "100000");
  const providerName        = decodeURIComponent(searchParams.get("pname") || "");

  const [platformId, setPlatformId] = useState<string>(defaultPlatformId);
  const [serviceId,  setServiceId]  = useState<string>(defaultServiceId);
  const [link,       setLink]       = useState("");
  const [quantity,   setQuantity]   = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const { supabaseUser } = useSupabaseAuth();

  const { data: platforms } = usePlatforms();
  const { data: services }  = useServices(platformId ? Number(platformId) : undefined);
  const { data: profile }   = useProfile();

  const selectedService = useMemo(
    () => services?.find(s => s.id.toString() === serviceId),
    [services, serviceId]
  );

  // For provider orders: price per 1000 in USD (as float)
  const providerPricePerK = Number(providerRate || 0);

  // ── Price calculation ────────────────────────────────────────────────────────
  const totalPrice = useMemo(() => {
    if (!quantity) return 0;
    if (isProvider) {
      // Provider price in USD — convert to IQD (1 USD ≈ 1300 IQD)
      const USD_TO_IQD = 1300;
      return Math.ceil((Number(quantity) * providerPricePerK * USD_TO_IQD) / 1000);
    }
    if (!selectedService) return 0;
    return Number(quantity) * (Number(selectedService.price) / 1000);
  }, [quantity, isProvider, providerPricePerK, selectedService]);

  const balance         = Number(profile?.balance || 0);
  const hasEnoughBalance = balance >= totalPrice;

  // ── Quantity validation ──────────────────────────────────────────────────────
  const minQty = isProvider ? providerMin : (selectedService?.min_order ?? 10);
  const maxQty = isProvider ? providerMax : (selectedService?.max_order ?? 1000000);

  const validateQuantity = (val: number) => {
    if (val < minQty) {
      setQuantityError(`أقل كمية هي ${minQty.toLocaleString()}`);
      return false;
    }
    if (val > maxQty) {
      setQuantityError(`أقصى كمية هي ${maxQty.toLocaleString()}`);
      return false;
    }
    setQuantityError(null);
    return true;
  };

  const handleQuantityChange = (val: string) => {
    const num = val === "" ? "" : Number(val);
    setQuantity(num);
    if (num !== "") validateQuantity(Number(num));
    else setQuantityError(null);
  };

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !link || !quantity) return;
    if (!validateQuantity(Number(quantity))) return;
    if (!hasEnoughBalance) {
      toast({ variant: "destructive", title: "رصيد غير كافٍ", description: `رصيدك IQD ${balance.toLocaleString()} وتحتاج IQD ${totalPrice.toLocaleString()}` });
      return;
    }

    setSubmitting(true);
    setOrderSuccess(null);

    try {
      if (isProvider) {
        // ── FOLLOWIZ ORDER FLOW ──────────────────────────────────────────────
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) throw new Error("الجلسة منتهية، أعد تسجيل الدخول");

        const result = await createFollowizOrder({
          provider_service_id: Number(providerServiceId),
          link,
          quantity: Number(quantity),
          price_per_1000: providerPricePerK * 1300, // convert USD to IQD for backend
          token,
        });

        queryClient.invalidateQueries({ queryKey: ["supabase", "profile", supabaseUser.id] });
        queryClient.invalidateQueries({ queryKey: ["supabase", "orders"] });

        setOrderSuccess(`✅ تم إرسال الطلب بنجاح!\nرقم الطلب لدى المزود: ${result.followiz_order_id}`);
        toast({ title: "✅ تم إرسال الطلب عبر المزود", description: `رقم الطلب: ${result.followiz_order_id}` });
        setLink("");
        setQuantity("");
      } else {
        // ── LOCAL ORDER FLOW ─────────────────────────────────────────────────
        if (!selectedService) return;

        await submitOrder({
          user_id: supabaseUser.id,
          service_id: selectedService.id,
          link,
          quantity: Number(quantity),
          total_price: totalPrice,
        });

        const newBalance = balance - totalPrice;
        await deductBalance(supabaseUser.id, newBalance);

        queryClient.invalidateQueries({ queryKey: ["supabase", "profile", supabaseUser.id] });
        queryClient.invalidateQueries({ queryKey: ["supabase", "orders"] });

        toast({ title: "✅ تم إرسال الطلب بنجاح" });
        setServiceId("");
        setPlatformId("");
        setLink("");
        setQuantity("");
        setQuantityError(null);
        setLocation("/orders");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ، حاول مرة أخرى";
      toast({ variant: "destructive", title: "خطأ في إنشاء الطلب", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && !!link && !!quantity && !quantityError && hasEnoughBalance &&
    (isProvider ? !!providerServiceId : !!serviceId);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">طلب جديد</h1>
          <p className="text-gray-400">
            {isProvider
              ? "طلب عبر مزود الخدمة الخارجي"
              : "قم بإنشاء طلب جديد لأي منصة ترغب بها"}
          </p>
        </header>

        {/* Balance */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <Wallet className="w-5 h-5 text-purple-400" />
          <span className="text-gray-400 text-sm">رصيدك الحالي:</span>
          <span className="font-bold text-white font-mono">IQD {balance.toLocaleString()}</span>
        </div>

        {/* Success banner */}
        {orderSuccess && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <pre className="text-green-300 text-sm whitespace-pre-wrap font-sans">{orderSuccess}</pre>
          </div>
        )}

        <Card className="backdrop-blur-xl bg-white/5 border-white/10">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── PROVIDER: show selected service info ── */}
              {isProvider ? (
                <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold">
                    <Globe className="w-4 h-4" />
                    خدمة من المزود الخارجي
                  </div>
                  <p className="text-white text-sm font-medium">{providerName}</p>
                  <div className="flex gap-4 text-xs text-gray-400 font-mono">
                    <span>رقم الخدمة: <strong className="text-white">{providerServiceId}</strong></span>
                    <span>السعر: <strong className="text-purple-300">${providerRate}/1000</strong></span>
                    <span>أقل: <strong className="text-white">{providerMin.toLocaleString()}</strong></span>
                    <span>أقصى: <strong className="text-white">{providerMax.toLocaleString()}</strong></span>
                  </div>
                </div>
              ) : (
                // ── LOCAL: platform + service selectors ──
                <>
                  <div className="space-y-2">
                    <Label className="text-gray-300">المنصة</Label>
                    <Select value={platformId} onValueChange={(val) => { setPlatformId(val); setServiceId(""); }}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-12" dir="rtl">
                        <SelectValue placeholder="اختر المنصة" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                        {platforms?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">الخدمة</Label>
                    <Select value={serviceId} onValueChange={setServiceId} disabled={!platformId || !services?.length}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-12" dir="rtl">
                        <SelectValue placeholder={!platformId ? "اختر المنصة أولاً" : "اختر الخدمة"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                        {services?.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.id} - {s.name} (IQD {s.price} لكل 1000)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedService && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-200 space-y-1">
                      {selectedService.description && (
                        <p><span className="font-semibold text-blue-400">الوصف:</span> {selectedService.description}</p>
                      )}
                      <p><span className="font-semibold text-blue-400">أقل طلب:</span> {selectedService.min_order.toLocaleString()}</p>
                      <p><span className="font-semibold text-blue-400">أقصى طلب:</span> {selectedService.max_order.toLocaleString()}</p>
                    </div>
                  )}
                </>
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
                    ({minQty.toLocaleString()} - {maxQty.toLocaleString()})
                  </span>
                </Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => handleQuantityChange(e.target.value)}
                  required
                  min={minQty}
                  max={maxQty}
                  placeholder="1000"
                  className={`h-12 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl ${quantityError ? "border-red-500/50" : ""}`}
                  dir="ltr"
                />
                {quantityError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {quantityError}
                  </div>
                )}
              </div>

              {/* Price card */}
              <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">التكلفة الإجمالية</p>
                      <p className="text-2xl font-bold text-white font-mono">
                        IQD {totalPrice.toLocaleString()}
                      </p>
                      {isProvider && quantity && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          ${(providerPricePerK * Number(quantity) / 1000).toFixed(4)} USD
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
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20 font-bold text-lg disabled:opacity-50"
                disabled={!canSubmit}
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
