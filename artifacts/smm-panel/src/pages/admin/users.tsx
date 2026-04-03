import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { useAdminGetUsers, useAdminUpdateUserBalance, getAdminGetUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user && user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: users, isLoading } = useAdminGetUsers();
  const { mutate: updateBalance } = useAdminUpdateUserBalance();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<string>("");
  const [operation, setOperation] = useState<"add" | "subtract" | "set">("add");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleUpdateBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !balanceAmount) return;

    updateBalance({ id: selectedUser, data: { balance: Number(balanceAmount), operation } }, {
      onSuccess: () => {
        toast({ title: "تم تحديث الرصيد بنجاح" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        setIsDialogOpen(false);
        setBalanceAmount("");
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
          <h1 className="text-3xl font-bold text-white mb-2">إدارة المستخدمين</h1>
          <p className="text-gray-400">تعديل الأرصدة وإدارة حسابات المستخدمين</p>
        </header>

        <div className="grid gap-4">
          {isLoading ? (
            <p className="text-gray-400">جاري التحميل...</p>
          ) : users?.map(u => (
            <Card key={u.id} className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">{u.name} {u.role === 'admin' && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded ml-2">مدير</span>}</h3>
                  <p className="text-sm text-gray-400">{u.email}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-left" dir="ltr">
                    <p className="text-xs text-gray-500 text-right">الرصيد</p>
                    <p className="font-mono font-bold text-purple-400 text-right">IQD {u.balance.toLocaleString()}</p>
                  </div>
                  
                  <Dialog open={isDialogOpen && selectedUser === u.id} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (open) setSelectedUser(u.id);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
                        تعديل الرصيد
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                      <DialogHeader>
                        <DialogTitle>تعديل رصيد {u.name}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleUpdateBalance} className="space-y-4 pt-4">
                        <div className="flex gap-2">
                          {(["add", "subtract", "set"] as const).map(op => (
                            <Button 
                              key={op} 
                              type="button" 
                              variant={operation === op ? "default" : "outline"}
                              className={operation === op ? "bg-purple-600" : "bg-white/5 border-white/10 text-gray-300"}
                              onClick={() => setOperation(op)}
                            >
                              {op === "add" ? "إضافة" : op === "subtract" ? "خصم" : "تعيين"}
                            </Button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          required
                          value={balanceAmount}
                          onChange={(e) => setBalanceAmount(e.target.value)}
                          placeholder="المبلغ"
                          className="bg-white/5 border-white/10 text-white"
                          dir="ltr"
                        />
                        <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600">
                          حفظ التعديل
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
