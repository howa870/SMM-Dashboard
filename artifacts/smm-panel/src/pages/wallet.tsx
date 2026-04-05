import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Receipt, Clock, CheckCircle2, XCircle, Info, Upload, Copy, Check, Sparkles, ImageIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useProfile } from "@/hooks/useProfile";
import { useUserPayments } from "@/hooks/usePaymentsData";
import { uploadProofImage, getPaymentSettings } from "@/lib/supabase-db";
import { useSupabaseAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { Payment } from "@/lib/supabase-db";

const METHOD_META: Record<string, { label: string; icon: string; color: string; description: string }> = {
  zaincash: { label: "زين كاش",  icon: "💳", color: "from-purple-600 to-purple-800", description: "حوّل المبلغ إلى رقم زين كاش أدناه ثم أدخل رقم العملية." },
  asiacell: { label: "آسياسيل", icon: "📱", color: "from-orange-500 to-red-600",    description: "حوّل المبلغ إلى رقم آسياسيل أدناه ثم أدخل رقم العملية." },
  qicard:   { label: "QiCard",  icon: "💰", color: "from-teal-500 to-emerald-700",  description: "حوّل المبلغ إلى رقم QiCard أدناه ثم أدخل رقم العملية." },
  manual:   { label: "يدوي",    icon: "🏦", color: "from-slate-500 to-slate-700",   description: "تواصل مع فريق الدعم لإتمام عملية التحويل اليدوي." },
};

const STATUS_CONFIG: Record<Payment["status"], { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "قيد المراجعة", cls: "badge-pending",  icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: "مقبول ✅",     cls: "badge-approved", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: "مرفوض ❌",     cls: "badge-rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const METHOD_ORDER: Payment["method"][] = ["zaincash", "asiacell", "qicard", "manual"];

const DB_KEY_TO_METHOD: Record<string, Payment["method"]> = {
  zain: "zaincash",
  asiacell: "asiacell",
  qicard: "qicard",
};

function generateTxId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "BI";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function Wallet() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: payments, isLoading: paymentsLoading } = useUserPayments();
  const { supabaseUser } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const { data: paymentSettings } = useQuery({
    queryKey: ["supabase", "payment_settings"],
    queryFn: getPaymentSettings,
    staleTime: 60 * 1000,
  });

  const paymentNumbers: Record<string, string> = { manual: "تواصل مع الدعم" };
  (paymentSettings || []).forEach(s => {
    const method = DB_KEY_TO_METHOD[s.key];
    if (method) paymentNumbers[method] = s.value;
  });

  const [amount, setAmount]           = useState<number | "">("");
  const [method, setMethod]           = useState<Payment["method"]>("zaincash");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes]             = useState("");
  const [proofFile, setProofFile]     = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedTxid, setCopiedTxid]   = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [liveBalance, setLiveBalance]     = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing]   = useState(false);

  // ── دالة جلب الرصيد الحي من API (service role — لا RLS) ─────────────────
  const fetchLiveBalance = useCallback(async () => {
    if (!supabaseUser) return;
    setIsRefreshing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;
      const res  = await fetch("/api/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok || json.success) {
        setLiveBalance(Number(json.balance ?? 0));
        // نحدّث أيضاً الـ cache لتنعكس القيمة في الهيدر
        queryClient.setQueryData(
          ["supabase", "profile", supabaseUser.id],
          (old: Record<string, unknown> | null) =>
            old ? { ...old, balance: Number(json.balance ?? 0) } : old
        );
      }
    } catch (e) {
      console.warn("[wallet] fetchLiveBalance:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [supabaseUser, queryClient]);

  // ── Polling: جلب الرصيد كل 5 ثوان ───────────────────────────────────────
  useEffect(() => {
    fetchLiveBalance();
    const interval = setInterval(fetchLiveBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchLiveBalance]);

  // ── Realtime: استمع لتحديثات جدول profiles ───────────────────────────────
  useEffect(() => {
    if (!supabaseUser) return;
    const channel = supabase
      .channel(`balance:${supabaseUser.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${supabaseUser.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["supabase", "profile", supabaseUser.id] });
          fetchLiveBalance();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser?.id, queryClient, fetchLiveBalance]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleCopyTxid = () => {
    const id = generateTxId();
    setTransactionId(id);
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedTxid(true);
    setTimeout(() => setCopiedTxid(false), 2000);
  };

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num.replace(/\s/g, "")).catch(() => {});
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) < 1000) {
      toast({ variant: "destructive", title: "المبلغ يجب أن يكون 1000 IQD على الأقل" });
      return;
    }
    if (!proofFile) {
      toast({ variant: "destructive", title: "صورة الإثبات مطلوبة", description: "يرجى رفع صورة إثبات التحويل." });
      fileInputRef.current?.click();
      return;
    }

    let proof_url: string | undefined;
    if (proofFile && supabaseUser) {
      setUploadingProof(true);
      try {
        proof_url = await uploadProofImage(proofFile, supabaseUser.id);
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        toast({ variant: "destructive", title: "خطأ في رفع الصورة", description: msg });
        setUploadingProof(false);
        return;
      }
      setUploadingProof(false);
    }

    setIsSubmitting(true);
    try {
      // Use API endpoint (service role — bypasses Supabase RLS)
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");

      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount:         Number(amount),
          method,
          transaction_id: transactionId || null,
          proof_url:      proof_url || null,
          notes:          notes || null,
        }),
      });
      const json = await res.json() as { ok?: boolean; success?: boolean; error?: string };
      if (!json.ok && !json.success) throw new Error(json.error || "فشل إرسال الطلب");

      toast({ title: "✅ تم إرسال طلب الشحن بنجاح", description: "سيتم مراجعته من قِبل الإدارة قريباً." });
      setAmount(""); setTransactionId(""); setNotes(""); setProofFile(null); setProofPreview(null);
      queryClient.invalidateQueries({ queryKey: ["supabase", "payments"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: "destructive", title: "فشل إرسال الطلب", description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // liveBalance من API (أحدث قيمة) أو profile من Supabase كـ fallback
  const balance = liveBalance !== null ? liveBalance : Number(profile?.balance || 0);
  const selectedMeta = METHOD_META[method] || METHOD_META.manual;
  const selectedNumber = paymentNumbers[method] || "—";

  return (
    <Layout>
      <div className="space-y-8 page-enter">

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">المحفظة 💰</h1>
          <p className="text-slate-400 mt-1">إدارة رصيدك وطلبات الشحن</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left Column: Balance + Form ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* ══ Balance Card ══ */}
            <div className="relative rounded-[24px] overflow-hidden animate-balance-glow"
              style={{ background: "linear-gradient(135deg, #6C5CE7 0%, #4f46e5 40%, #00B894 100%)" }}>
              {/* Decorative blobs */}
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-black/20 blur-xl pointer-events-none" />
              {/* Mesh lines */}
              <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.15) 0, rgba(255,255,255,.15) 1px, transparent 0, transparent 50%)", backgroundSize: "18px 18px" }} />

              <div className="relative p-8 text-center">
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-3xl">💰</span>
                </div>
                <p className="text-white/70 text-sm font-medium mb-2 tracking-wide uppercase">الرصيد الحالي</p>
                {profileLoading ? (
                  <div className="h-12 w-48 bg-white/20 animate-pulse rounded-xl mx-auto" />
                ) : (
                  <div>
                    <h2 className="text-5xl font-black text-white font-mono leading-none">
                      {balance.toLocaleString()}
                    </h2>
                    <p className="text-white/60 text-sm mt-2 font-medium">دينار عراقي (IQD)</p>
                  </div>
                )}
                <div className="mt-5 flex items-center justify-center gap-2">
                  <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                    <span className="text-white/80 text-xs">يتحدث كل 5 ثوان</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchLiveBalance}
                    disabled={isRefreshing}
                    title="تحديث الرصيد الآن"
                    className="bg-white/20 hover:bg-white/35 active:scale-95 rounded-full p-2 transition-all duration-150 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-white ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* ══ Quick Amounts ══ */}
            <div className="glass-card p-5 space-y-4">
              <p className="text-slate-300 text-sm font-semibold">مبالغ سريعة</p>
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 25000, 50000].map(p => (
                  <button key={p} type="button" onClick={() => setAmount(p)}
                    className={`rounded-[14px] py-2.5 text-sm font-bold font-mono transition-all duration-200 border ${
                      amount === p
                        ? "bg-boost-gradient text-white border-transparent shadow-lg shadow-purple-500/30 scale-[1.04]"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white hover:scale-[1.02]"
                    }`}>
                    {(p / 1000)}K
                  </button>
                ))}
              </div>
            </div>

            {/* ══ Charge Form ══ */}
            <div className="glass-card p-6 space-y-5">
              <div>
                <h2 className="text-white font-bold text-lg">شحن الرصيد</h2>
                <p className="text-slate-400 text-sm">اختر طريقة الدفع وأرسل طلبك</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Amount input */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">المبلغ (IQD)</Label>
                  <Input type="number" value={amount}
                    onChange={e => setAmount(e.target.value ? Number(e.target.value) : "")}
                    className="h-12 rounded-[14px] bg-white/5 border-white/10 text-white font-mono text-base"
                    dir="ltr" placeholder="أدخل المبلغ..." required min={1000} />
                </div>

                {/* Method Cards */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">طريقة الدفع</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {METHOD_ORDER.map(key => {
                      const meta = METHOD_META[key];
                      return (
                        <button key={key} type="button" onClick={() => setMethod(key)}
                          className={`method-card ${method === key ? "active" : ""}`}>
                          <div className="text-2xl mb-1.5">{meta.icon}</div>
                          <div className="text-xs font-bold text-white">{meta.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected method info */}
                <div className="rounded-[16px] bg-blue-500/8 border border-blue-400/15 p-4 space-y-3">
                  <p className="text-blue-300 text-sm flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
                    {selectedMeta.description}
                  </p>
                  {method !== "manual" && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-white text-sm bg-white/8 rounded-[12px] px-4 py-2.5 text-center border border-white/8" dir="ltr">
                        {selectedNumber || <span className="text-slate-500 animate-pulse">جاري التحميل...</span>}
                      </code>
                      <button type="button" onClick={() => handleCopyNumber(selectedNumber)}
                        className="w-10 h-10 rounded-[12px] bg-white/8 hover:bg-white/15 text-slate-300 transition-all flex items-center justify-center border border-white/8 hover:border-white/20">
                        {copiedNumber ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* TXID */}
                {method !== "manual" && (
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm font-medium">رقم العملية (TXID)</Label>
                    <div className="flex gap-2">
                      <Input value={transactionId} onChange={e => setTransactionId(e.target.value)}
                        className="h-11 rounded-[14px] bg-white/5 border-white/10 text-white font-mono flex-1"
                        dir="ltr" placeholder="TXID..." />
                      <button type="button" onClick={handleCopyTxid}
                        className="px-3 rounded-[14px] bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 hover:scale-[1.03]">
                        {copiedTxid ? <Check className="w-4 h-4 text-green-400" /> : <Sparkles className="w-4 h-4" />}
                        <span className="hidden sm:block">توليد</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Proof Upload */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">
                    صورة إثبات الدفع <span className="text-red-400 text-xs font-bold">* إجباري</span>
                  </Label>
                  <div onClick={() => fileInputRef.current?.click()}
                    className={`cursor-pointer rounded-[16px] border-2 border-dashed transition-all p-4 text-center ${
                      proofPreview
                        ? "border-purple-500/50 bg-purple-500/8"
                        : "border-red-500/25 bg-red-500/5 hover:border-purple-500/40 hover:bg-purple-500/5"
                    }`}>
                    {proofPreview ? (
                      <div className="relative">
                        <img src={proofPreview} alt="proof" className="w-full max-h-36 object-contain rounded-xl" />
                        <p className="text-xs text-green-400 mt-2 font-medium">✅ تم اختيار الصورة — انقر للتغيير</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                        <p className="text-slate-400 text-sm">اضغط لاختيار صورة الإيصال</p>
                        <p className="text-slate-600 text-xs mt-1">JPG, PNG, WEBP</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">
                    ملاحظات <span className="text-slate-500 text-xs">(اختياري)</span>
                  </Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                    className="bg-white/5 border-white/10 text-white rounded-[14px] resize-none text-sm"
                    rows={2} placeholder="أي معلومات إضافية..." />
                </div>

                <button type="submit"
                  disabled={isSubmitting || uploadingProof || !amount || Number(amount) < 1000}
                  className="btn-boost w-full h-13 py-3.5 text-base">
                  {(isSubmitting || uploadingProof)
                    ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />جاري الإرسال...</span>
                    : <span className="flex items-center justify-center gap-2"><Upload className="w-5 h-5" />إرسال طلب الشحن</span>}
                </button>
              </form>
            </div>
          </div>

          {/* ── Right Column: Payment History ── */}
          <div className="lg:col-span-3">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  سجل طلبات الشحن
                </h2>
                <span className="text-xs text-slate-500 bg-white/5 border border-white/8 rounded-full px-3 py-1">
                  {payments?.length || 0} طلب
                </span>
              </div>

              {paymentsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-[76px] bg-white/4 animate-pulse rounded-[18px]" />
                  ))}
                </div>
              ) : !payments?.length ? (
                <div className="text-center py-20 text-slate-500">
                  <Receipt className="w-14 h-14 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">لا توجد طلبات شحن سابقة</p>
                  <p className="text-sm text-slate-600 mt-1">أرسل طلبك الأول من النموذج</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(pay => {
                    const cfg = STATUS_CONFIG[pay.status];
                    const mMeta = METHOD_META[pay.method] || METHOD_META.manual;
                    const iconBg =
                      pay.status === "approved" ? "bg-green-500/15 border-green-500/20" :
                      pay.status === "rejected" ? "bg-red-500/15 border-red-500/20" :
                      "bg-yellow-500/15 border-yellow-500/20";
                    return (
                      <div key={pay.id}
                        className="flex items-center gap-4 p-4 rounded-[18px] bg-white/4 border border-white/7 hover:bg-white/7 hover:border-white/12 transition-all duration-200 card-hover">
                        <div className={`w-12 h-12 rounded-[14px] shrink-0 flex items-center justify-center text-xl border ${iconBg}`}>
                          {mMeta.icon}
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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-400">{mMeta.label}</span>
                            {pay.transaction_id && (
                              <span className="text-xs font-mono text-slate-500">• {pay.transaction_id}</span>
                            )}
                            <span className="text-xs text-slate-600 font-mono" dir="ltr">
                              {format(new Date(pay.created_at), "yyyy/MM/dd HH:mm")}
                            </span>
                          </div>
                        </div>
                        {pay.proof_url && (
                          <a href={pay.proof_url} target="_blank" rel="noreferrer"
                            className="shrink-0 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-[10px] hover:bg-blue-500/20 transition-colors flex items-center gap-1">
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

        </div>
      </div>
    </Layout>
  );
}
