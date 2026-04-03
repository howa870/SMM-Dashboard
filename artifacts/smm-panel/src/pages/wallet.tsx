import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, Wallet as WalletIcon, Receipt, Clock, CheckCircle2, XCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { useProfile } from "@/hooks/useProfile";
import { useUserPayments, useCreatePayment } from "@/hooks/usePaymentsData";
import type { Payment } from "@/lib/supabase-db";

const METHOD_INFO: Record<Payment["method"], { label: string; icon: string; number: string; description: string }> = {
  zaincash: {
    label: "زين كاش",
    icon: "💳",
    number: "07801234567",
    description: "حوّل المبلغ إلى رقم زين كاش أدناه، ثم أدخل رقم العملية.",
  },
  qicard: {
    label: "QiCard",
    icon: "💰",
    number: "1234 5678 9012 3456",
    description: "حوّل المبلغ إلى رقم QiCard أدناه، ثم أدخل رقم العملية.",
  },
  manual: {
    label: "حوالة يدوية",
    icon: "🏦",
    number: "تواصل مع الدعم",
    description: "تواصل مع فريق الدعم لإتمام عملية التحويل اليدوي.",
  },
};

const STATUS_CONFIG: Record<Payment["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: <Clock className="w-4 h-4" /> },
  approved: { label: "مقبول", color: "bg-green-500/20 text-green-400 border-green-500/50", icon: <CheckCircle2 className="w-4 h-4" /> },
  rejected: { label: "مرفوض", color: "bg-red-500/20 text-red-400 border-red-500/50", icon: <XCircle className="w-4 h-4" /> },
};

export function Wallet() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: payments, isLoading: paymentsLoading } = useUserPayments();

  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<Payment["method"]>("zaincash");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();
  const { mutateAsync: createPayment, isPending: isSubmitting } = useCreatePayment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) < 1000) {
      toast({ variant: "destructive", title: "المبلغ يجب أن يكون 1000 IQD على الأقل" });
      return;
    }

    try {
      await createPayment({
        amount: Number(amount),
        method,
        transaction_id: transactionId || undefined,
        notes: notes || undefined,
      });
      toast({ title: "✅ تم إرسال طلب الشحن بنجاح", description: "سيتم مراجعته من قِبل الإدارة قريباً." });
      setAmount("");
      setTransactionId("");
      setNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ في إرسال الطلب";
      toast({ variant: "destructive", title: "خطأ", description: msg });
    }
  };

  const selectedMethodInfo = METHOD_INFO[method];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">المحفظة</h1>
          <p className="text-gray-400">إدارة رصيدك وطلبات الشحن</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── LEFT COLUMN: Balance + Form ─── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Balance Card */}
            <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                  <WalletIcon className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-gray-400 mb-2">الرصيد الحالي</p>
                {profileLoading ? (
                  <div className="h-10 w-40 bg-white/10 animate-pulse rounded-lg mx-auto" />
                ) : (
                  <h2 className="text-4xl font-bold text-white font-mono">
                    IQD {Number(profile?.balance || 0).toLocaleString()}
                  </h2>
                )}
              </CardContent>
            </Card>

            {/* Recharge Form */}
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">شحن الرصيد</CardTitle>
                <CardDescription className="text-gray-400">اختر طريقة الدفع وأرسل طلب الشحن</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">المبلغ (IQD)</Label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {[5000, 10000, 25000, 50000].map(p => (
                        <Button
                          key={p}
                          type="button"
                          variant="outline"
                          className={`rounded-lg font-mono text-sm transition-all ${amount === p ? "bg-purple-600/30 border-purple-500/50 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}
                          onClick={() => setAmount(p)}
                        >
                          {p.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value ? Number(e.target.value) : "")}
                      className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-12 text-left font-mono"
                      dir="ltr"
                      placeholder="أو أدخل مبلغاً مخصصاً..."
                      required
                      min={1000}
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">طريقة الدفع</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(METHOD_INFO) as [Payment["method"], typeof METHOD_INFO[Payment["method"]]][]).map(([key, info]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMethod(key)}
                          className={`rounded-xl p-3 text-center border transition-all ${method === key ? "bg-purple-600/30 border-purple-500/50 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"}`}
                        >
                          <div className="text-2xl mb-1">{info.icon}</div>
                          <div className="text-xs font-medium">{info.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Method Info Box */}
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 space-y-3">
                    <div className="flex items-start gap-2 text-blue-300 text-sm">
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>{selectedMethodInfo.description}</p>
                    </div>
                    <div className="font-mono text-white text-sm bg-white/10 rounded-lg px-3 py-2 text-center" dir="ltr">
                      {selectedMethodInfo.number}
                    </div>
                  </div>

                  {/* Transaction ID */}
                  {method !== "manual" && (
                    <div className="space-y-2">
                      <Label className="text-gray-300">رقم العملية (Transaction ID)</Label>
                      <Input
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                        className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-12 font-mono"
                        dir="ltr"
                        placeholder="TXID..."
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">ملاحظات (اختياري)</Label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl resize-none"
                      rows={2}
                      placeholder="أي معلومات إضافية..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !amount || Number(amount) < 1000}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-base shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إرسال طلب الشحن"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ─── RIGHT COLUMN: Payment History ─── */}
          <div className="lg:col-span-2">
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  سجل طلبات الشحن
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
                    ))}
                  </div>
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
                              pay.status === "rejected" ? "bg-red-500/20" : "bg-yellow-500/20"
                            }`}>
                              {mInfo.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white font-mono">IQD {Number(pay.amount).toLocaleString()}</p>
                              <p className="text-xs text-gray-400 truncate">
                                {mInfo.label}
                                {pay.transaction_id && <span className="font-mono mr-2 text-gray-500">• {pay.transaction_id}</span>}
                              </p>
                              <p className="text-xs text-gray-600 font-mono" dir="ltr">
                                {format(new Date(pay.created_at), "yyyy/MM/dd HH:mm")}
                              </p>
                            </div>
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
