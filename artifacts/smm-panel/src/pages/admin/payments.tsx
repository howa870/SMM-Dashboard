import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useAdminGetPayments, useAdminApprovePayment, useAdminRejectPayment, getAdminGetPaymentsQueryKey, getAdminGetStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const methodLabels = {
  zaincash: "زين كاش",
  asiahawala: "آسيا حوالة",
  stripe: "بطاقة ائتمان",
};

export function AdminPayments() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: payments, isLoading } = useAdminGetPayments();
  const { mutate: approve, isPending: isApproving } = useAdminApprovePayment();
  const { mutate: reject, isPending: isRejecting } = useAdminRejectPayment();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAction = (id: number, action: 'approve' | 'reject') => {
    const mutate = action === 'approve' ? approve : reject;
    mutate({ id }, {
      onSuccess: () => {
        toast({ title: `تم ${action === 'approve' ? 'قبول' : 'رفض'} الدفعة بنجاح` });
        queryClient.invalidateQueries({ queryKey: getAdminGetPaymentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "خطأ", description: err.error });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">إدارة المدفوعات</h1>
          <p className="text-gray-400">مراجعة طلبات الشحن المعلقة</p>
        </header>

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-gray-400">جاري التحميل...</p>
          ) : payments?.length === 0 ? (
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-8 text-center text-gray-400">
              لا توجد مدفوعات معلقة
            </Card>
          ) : (
            payments?.map(payment => (
              <Card key={payment.id} className="backdrop-blur-xl bg-white/5 border-white/10">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-white">IQD {payment.amount.toLocaleString()}</span>
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">معلق</Badge>
                    </div>
                    <div className="text-sm text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1">
                      <p>المستخدم: <span className="text-white">{payment.userName}</span></p>
                      <p>الطريقة: <span className="text-white">{methodLabels[payment.method]}</span></p>
                      <p>التاريخ: <span className="text-white font-mono" dir="ltr">{format(new Date(payment.createdAt), "yyyy/MM/dd HH:mm")}</span></p>
                      {payment.transactionId && <p>رقم العملية: <span className="text-white font-mono" dir="ltr">{payment.transactionId}</span></p>}
                    </div>
                  </div>

                  {payment.receiptUrl && (
                    <div className="shrink-0">
                      <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-2 rounded-lg">
                        <ExternalLink className="w-4 h-4" /> عرض الإيصال
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      className="bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                      onClick={() => handleAction(payment.id, 'approve')}
                      disabled={isApproving || isRejecting}
                    >
                      <Check className="w-4 h-4 ml-2" /> قبول
                    </Button>
                    <Button 
                      variant="outline" 
                      className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                      onClick={() => handleAction(payment.id, 'reject')}
                      disabled={isApproving || isRejecting}
                    >
                      <X className="w-4 h-4 ml-2" /> رفض
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
