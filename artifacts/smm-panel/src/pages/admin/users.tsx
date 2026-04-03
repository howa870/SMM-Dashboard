import { Layout } from "@/components/layout";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Users, ShieldAlert, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase-db";

async function getAllUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("email");
  if (error) throw error;
  return data as Profile[];
}

async function adminSetBalance(userId: string, newBalance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (error) throw error;
}

export function AdminUsers() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [operation, setOperation] = useState<"add" | "subtract" | "set">("add");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") setLocation("/");
  }, [profile, profileLoading, setLocation]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["supabase", "admin", "users"],
    queryFn: getAllUsers,
    enabled: profile?.role === "admin",
    refetchInterval: 30_000,
  });

  const { mutateAsync: updateBalance, isPending } = useMutation({
    mutationFn: async ({ userId, balance, op }: { userId: string; balance: number; op: "add" | "subtract" | "set" }) => {
      const user = users?.find(u => u.id === userId);
      if (!user) throw new Error("User not found");
      let newBalance: number;
      if (op === "set") newBalance = balance;
      else if (op === "add") newBalance = Number(user.balance) + balance;
      else newBalance = Math.max(0, Number(user.balance) - balance);
      await adminSetBalance(userId, newBalance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "admin", "users"] });
      toast({ title: "✅ تم تحديث الرصيد" });
      setDialogOpen(false);
      setBalanceAmount("");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !balanceAmount) return;
    updateBalance({ userId: selectedUserId, balance: Number(balanceAmount), op: operation });
  };

  const filtered = users?.filter(u =>
    (u.name?.toLowerCase().includes(search.toLowerCase()) || "") ||
    (u.email?.toLowerCase().includes(search.toLowerCase()) || "")
  );

  const selectedUser = users?.find(u => u.id === selectedUserId);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              إدارة المستخدمين
            </h1>
            <p className="text-gray-400">تعديل الأرصدة وإدارة حسابات المستخدمين</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center">
            <p className="text-2xl font-bold text-white">{users?.length || 0}</p>
            <p className="text-xs text-gray-400">مستخدم مسجل</p>
          </div>
        </header>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="ابحث بالاسم أو الإيميل..."
            className="pr-10 h-12 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-purple-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />)}</div>
        ) : !filtered?.length ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center text-gray-400">
            لا يوجد مستخدمون
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <Card key={u.id} className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                      {(u.name || u.email || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white">{u.name || "بدون اسم"}</h3>
                        {u.role === "admin" && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />مدير
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">الرصيد</p>
                      <p className="font-mono font-bold text-purple-400 text-lg">IQD {Number(u.balance).toLocaleString()}</p>
                    </div>

                    <Dialog open={dialogOpen && selectedUserId === u.id}
                      onOpenChange={open => {
                        setDialogOpen(open);
                        if (open) { setSelectedUserId(u.id); setBalanceAmount(""); setOperation("add"); }
                      }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl">
                          تعديل الرصيد
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                        <DialogHeader>
                          <DialogTitle>تعديل رصيد {selectedUser?.name || selectedUser?.email}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                          <div className="flex gap-2">
                            {(["add", "subtract", "set"] as const).map(op => (
                              <Button key={op} type="button"
                                className={`flex-1 rounded-xl ${operation === op ? "bg-purple-600 text-white" : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"}`}
                                onClick={() => setOperation(op)}>
                                {op === "add" ? "إضافة" : op === "subtract" ? "خصم" : "تعيين"}
                              </Button>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">الرصيد الحالي: <span className="font-mono text-white">IQD {Number(selectedUser?.balance || 0).toLocaleString()}</span></p>
                          </div>
                          <Input type="number" required min={0}
                            value={balanceAmount}
                            onChange={e => setBalanceAmount(e.target.value)}
                            placeholder="المبلغ (IQD)"
                            className="bg-white/5 border-white/10 text-white rounded-xl h-12 font-mono"
                            dir="ltr" />
                          <Button type="submit" disabled={isPending}
                            className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold">
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ التعديل"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
