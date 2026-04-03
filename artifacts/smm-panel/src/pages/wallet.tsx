import { Layout } from "@/components/layout";
import { useGetBalance, useGetPayments, useCreatePayment, useUploadReceipt, getGetBalanceQueryKey, getGetPaymentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { Loader2, Upload, Wallet as WalletIcon, CreditCard, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

const statusColors = {
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
  approved: "bg-green-500/20 text-green-400 border-green-500/50",
  rejected: "bg-red-500/20 text-red-400 border-red-500/50",
};

const statusLabels = {
  pending: "قيد الانتظار",
  approved: "مقبول",
  rejected: "مرفوض",
};

const methodLabels = {
  zaincash: "زين كاش",
  asiahawala: "آسيا حوالة",
  stripe: "بطاقة ائتمان",
};

export function Wallet() {
  const { data: balanceData, isLoading: balanceLoading } = useGetBalance();
  const { data: payments, isLoading: paymentsLoading } = useGetPayments();
  
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<"zaincash" | "asiahawala" | "stripe">("zaincash");
  const [transactionId, setTransactionId] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { mutate: uploadReceipt, isPending: isUploading } = useUploadReceipt();
  const { mutate: createPayment, isPending: isSubmitting } = useCreatePayment();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      uploadReceipt({
        data: {
          imageData: base64,
          fileName: file.name
        }
      }, {
        onSuccess: (res) => {
          setReceiptUrl(res.url);
          toast({ title: "تم رفع الإيصال بنجاح" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "خطأ في رفع الإيصال" });
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    createPayment({
      data: {
        amount: Number(amount),
        method,
        transactionId: transactionId || undefined,
        receiptUrl: receiptUrl || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "تم إرسال طلب الشحن بنجاح" });
        setAmount("");
        setTransactionId("");
        setReceiptUrl("");
        queryClient.invalidateQueries({ queryKey: getGetPaymentsQueryKey() });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "خطأ", description: error.error });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">المحفظة</h1>
          <p className="text-gray-400">إدارة رصيدك وعمليات الشحن</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-white/10">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                  <WalletIcon className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-gray-400 mb-2">الرصيد الحالي</p>
                {balanceLoading ? (
                  <div className="h-10 w-32 bg-white/10 animate-pulse rounded-lg mx-auto" />
                ) : (
                  <h2 className="text-4xl font-bold text-white">IQD {balanceData?.balance?.toLocaleString() || 0}</h2>
                )}
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">شحن الرصيد</CardTitle>
                <CardDescription className="text-gray-400">اختر طريقة الدفع المناسبة لك</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">المبلغ (IQD)</Label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {[5000, 10000, 25000, 50000].map(preset => (
                        <Button
                          key={preset}
                          type="button"
                          variant="outline"
                          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                          onClick={() => setAmount(preset)}
                        >
                          {preset.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                      className="bg-white/5 border-white/10 text-white text-left"
                      dir="ltr"
                      placeholder="مبلغ مخصص"
                      required
                      min={1000}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">طريقة الدفع</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["zaincash", "asiahawala", "stripe"] as const).map(m => (
                        <Button
                          key={m}
                          type="button"
                          variant={method === m ? "default" : "outline"}
                          className={method === m ? "bg-gradient-to-r from-purple-600 to-blue-600 border-none" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}
                          onClick={() => setMethod(m)}
                        >
                          {methodLabels[m]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {(method === "zaincash" || method === "asiahawala") && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-4">
                      <p className="text-sm text-blue-200">
                        الرجاء تحويل المبلغ إلى الرقم: <span className="font-mono font-bold" dir="ltr">078X XXX XXXX</span>
                      </p>
                      
                      <div className="space-y-2">
                        <Label className="text-gray-300">رقم العملية (Transaction ID)</Label>
                        <Input
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          className="bg-white/5 border-white/10 text-white font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-300">إيصال التحويل</Label>
                        <div className="flex gap-2 items-center">
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-white/5 border-white/10 text-white flex-1"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 ml-2" />}
                            {receiptUrl ? "تم رفع الإيصال" : "اختر صورة"}
                          </Button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {method === "stripe" && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3 text-gray-400">
                      <CreditCard className="w-5 h-5" />
                      <span className="text-sm">سيتم توجيهك إلى بوابة الدفع</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    disabled={isSubmitting || !amount || ((method === "zaincash" || method === "asiahawala") && !transactionId && !receiptUrl)}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد عملية الشحن"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  سجل المدفوعات
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : payments?.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    لا توجد عمليات شحن سابقة
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments?.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            payment.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            payment.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {payment.method === 'stripe' ? <CreditCard className="w-5 h-5" /> : <WalletIcon className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-white">IQD {payment.amount.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">{format(new Date(payment.createdAt), "yyyy/MM/dd HH:mm")} • {methodLabels[payment.method]}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={statusColors[payment.status]}>
                          {statusLabels[payment.status]}
                        </Badge>
                      </div>
                    ))}
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
