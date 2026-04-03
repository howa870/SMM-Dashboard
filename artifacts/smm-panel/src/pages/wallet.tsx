import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Loader2, Wallet as WalletIcon, Receipt, Clock, CheckCircle2, XCircle, Info, Upload, Copy, Check, Sparkles, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { useProfile } from "@/hooks/useProfile";
import { useUserPayments, useCreatePayment } from "@/hooks/usePaymentsData";
import { uploadProofImage } from "@/lib/supabase-db";
import { notifyTelegramPayment } from "@/lib/telegram";
import { useSupabaseAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { Payment } from "@/lib/supabase-db";

const METHOD_INFO: Record<Payment["method"], { label: string; icon: string; number: string; description: string }> = {
  zaincash: { label: "زين كاش", icon: "💳", number: "07801234567", description: "حوّل المبلغ إلى رقم زين كاش أدناه ثم أدخل رقم العملية." },
  qicard: { label: "QiCard", icon: "💰", number: "1234 5678 9012 3456", description: "حوّل المبلغ إلى رقم QiCard أدناه ثم أدخل رقم العملية." },
  manual: { label: "حوالة يدوية", icon: "🏦", number: "تواصل مع الدعم", description: "تواصل مع فريق الدعم لإتمام عملية التحويل اليدوي." },
};

const STATUS_CONFIG: Record<Payment["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: <Clock className="w-4 h-4" /> },
  approved: { label: "مقبول ✅", color: "bg-green-500/20 text-green-400 border-green-500/50", icon: <CheckCircle2 className="w-4 h-4" /> },
  rejected: { label: "مرفوض ❌", color: "bg-red-500/20 text-red-400 border-red-500/50", icon: <XCircle className="w-4 h-4" /> },
};

function generateTxId(): string {
  const prefix = "PF";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = prefix;
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function Wallet() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: payments, isLoading: paymentsLoading } = useUserPayments();
  const { supabaseUser } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<Payment["method"]>("zaincash");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedTxid, setCopiedTxid] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { mutateAsync: createPayment, isPending: isSubmitting } = useCreatePayment();

  // Realtime balance update
  useEffect(() => {
    if (!supabaseUser) return;
    const channel = supabase
      .channel(`balance:${supabaseUser.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${supabaseUser.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["supabase", "profile", supabaseUser.id] });
      })
      .subscribe((status, err) => {
        if (err) console.warn("[Realtime] balance channel error:", err);
      });
    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser?.id, queryClient]);

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

    let proof_url: string | undefined;

    if (proofFile && supabaseUser) {
      setUploadingProof(true);
      try {
        console.log("[Wallet] Uploading proof image...", proofFile.name, proofFile.size);
        proof_url = await uploadProofImage(proofFile, supabaseUser.id);
        console.log("[Wallet] Upload success →", proof_url);
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.error("[Wallet] Upload failed:", msg, uploadErr);
        toast({ variant: "destructive", title: "خطأ في رفع صورة الإثبات", description: msg });
        setUploadingProof(false);
        return;
      }
      setUploadingProof(false);
    }

    try {
      console.log("[Wallet] Submitting payment:", { amount, method, transactionId });
      const payment = await createPayment({
        amount: Number(amount),
        method,
        transaction_id: transactionId || undefined,
        proof_url,
        notes: notes || undefined,
      });
      console.log("[Wallet] Payment created ✅:", payment);

      // Telegram notification (non-blocking)
      notifyTelegramPayment({
        id: payment.id,
        email: supabaseUser?.email || "مجهول",
        amount: Number(amount),
        method,
        transaction_id: transactionId || null,
        proof_url: proof_url || null,
        notes: notes || null,
      }).catch(e => console.warn("[Wallet] Telegram notify failed:", e));

      toast({ title: "✅ تم إرسال طلب الشحن بنجاح", description: "سيتم مراجعته من قِبل الإدارة قريباً." });
      setAmount("");
      setTransactionId("");
      setNotes("");
      setProofFile(null);
      setProofPreview(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Wallet] Submit failed:", msg, err);
      toast({ variant: "destructive", title: "فشل إرسال الطلب", description: msg });
    }
  };

  const balance = Number(profile?.balance || 0);
  const selectedMethodInfo = METHOD_INFO[method];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">المحفظة</h1>
          <p className="text-gray-400">إدارة رصيدك وطلبات الشحن</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Balance + Form */}
          <div className="lg:col-span-1 space-y-6">

            {/* Balance */}
            <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none" />
              <CardContent className="p-6 text-center relative">
                <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse-slow">
                  <WalletIcon className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-gray-400 mb-2 text-sm">الرصيد الحالي</p>
                {profileLoading ? (
                  <div className="h-10 w-40 bg-white/10 animate-pulse rounded-lg mx-auto" />
                ) : (
                  <h2 className="text-4xl font-bold text-white font-mono transition-all duration-300">
                    IQD {balance.toLocaleString()}
                  </h2>
                )}
                <p className="text-xs text-purple-400/60 mt-2">يتم التحديث تلقائياً</p>
              </CardContent>
            </Card>

            {/* Form */}
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">شحن الرصيد</CardTitle>
                <CardDescription className="text-gray-400">اختر طريقة الدفع وأرسل طلبك</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">المبلغ (IQD)</Label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {[5000, 10000, 25000, 50000].map(p => (
                        <Button key={p} type="button" variant="outline"
                          className={`rounded-lg font-mono text-sm transition-all ${amount === p ? "bg-purple-600/30 border-purple-500/50 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}
                          onClick={() => setAmount(p)}>
                          {p.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                    <Input type="number" value={amount}
                      onChange={e => setAmount(e.target.value ? Number(e.target.value) : "")}
                      className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-12 text-left font-mono"
                      dir="ltr" placeholder="أو أدخل مبلغاً مخصصاً..." required min={1000} />
                  </div>

                  {/* Method */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">طريقة الدفع</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(METHOD_INFO) as [Payment["method"], typeof METHOD_INFO[Payment["method"]]][]).map(([key, info]) => (
                        <button key={key} type="button" onClick={() => setMethod(key)}
                          className={`rounded-xl p-3 text-center border transition-all ${method === key ? "bg-purple-600/30 border-purple-500/50 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"}`}>
                          <div className="text-2xl mb-1">{info.icon}</div>
                          <div className="text-xs font-medium">{info.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Method Info */}
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 space-y-3">
                    <p className="text-blue-300 text-sm flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      {selectedMethodInfo.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-white text-sm bg-white/10 rounded-lg px-3 py-2 text-center" dir="ltr">
                        {selectedMethodInfo.number}
                      </code>
                      {method !== "manual" && (
                        <button type="button" onClick={() => handleCopyNumber(selectedMethodInfo.number)}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-all">
                          {copiedNumber ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TXID */}
                  {method !== "manual" && (
                    <div className="space-y-2">
                      <Label className="text-gray-300">رقم العملية (Transaction ID)</Label>
                      <div className="flex gap-2">
                        <Input value={transactionId} onChange={e => setTransactionId(e.target.value)}
                          className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-11 font-mono flex-1"
                          dir="ltr" placeholder="TXID..." />
                        <button type="button" onClick={handleCopyTxid}
                          title="توليد TXID تلقائي"
                          className="px-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all flex items-center gap-1 text-xs shrink-0">
                          {copiedTxid ? <Check className="w-4 h-4 text-green-400" /> : <Sparkles className="w-4 h-4" />}
                          <span className="hidden sm:block">توليد</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Proof Upload */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">صورة إثبات الدفع <span className="text-gray-500 text-xs">(اختياري)</span></Label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed transition-all p-4 text-center ${proofPreview ? "border-purple-500/50 bg-purple-500/10" : "border-white/10 bg-white/5 hover:border-purple-500/30 hover:bg-white/10"}`}>
                      {proofPreview ? (
                        <div className="relative">
                          <img src={proofPreview} alt="proof" className="w-full max-h-32 object-contain rounded-lg" />
                          <p className="text-xs text-green-400 mt-2">✅ تم اختيار الصورة</p>
                        </div>
                      ) : (
                        <div className="py-3">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                          <p className="text-gray-400 text-sm">اضغط لاختيار صورة الإيصال</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">ملاحظات <span className="text-gray-500 text-xs">(اختياري)</span></Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                      className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl resize-none"
                      rows={2} placeholder="أي معلومات إضافية..." />
                  </div>

                  <Button type="submit"
                    disabled={isSubmitting || uploadingProof || !amount || Number(amount) < 1000}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-base shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all">
                    {(isSubmitting || uploadingProof)
                      ? <><Loader2 className="w-5 h-5 animate-spin ml-2" />جاري الإرسال...</>
                      : <><Upload className="w-5 h-5 ml-2" />إرسال طلب الشحن</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right: Payment History */}
          <div className="lg:col-span-2">
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  سجل طلبات الشحن
                  <span className="text-xs text-purple-400/60 font-normal mr-auto">يتحدث تلقائياً</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />)}</div>
                ) : !payments?.length ? (
                  <div className="text-center py-16 text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا توجد طلبات شحن سابقة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map(pay => {
                      const cfg = STATUS_CONFIG[pay.status];
                      const mInfo = METHOD_INFO[pay.method];
                      return (
                        <div key={pay.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-xl ${
                              pay.status === "approved" ? "bg-green-500/20" :
                              pay.status === "rejected" ? "bg-red-500/20" : "bg-yellow-500/20"}`}>
                              {mInfo.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white font-mono">IQD {Number(pay.amount).toLocaleString()}</p>
                              <p className="text-xs text-gray-400">
                                {mInfo.label}
                                {pay.transaction_id && <span className="font-mono mr-2 text-gray-500">• {pay.transaction_id}</span>}
                              </p>
                              <p className="text-xs text-gray-600 font-mono" dir="ltr">{format(new Date(pay.created_at), "yyyy/MM/dd HH:mm")}</p>
                            </div>
                            {pay.proof_url && (
                              <a href={pay.proof_url} target="_blank" rel="noreferrer"
                                className="shrink-0 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                                <ImageIcon className="w-3 h-3 inline ml-1" />إثبات
                              </a>
                            )}
                          </div>
                          <Badge variant="outline" className={`flex items-center gap-1.5 shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
