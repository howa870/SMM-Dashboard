import { Layout } from "@/components/layout";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Settings, Plus, Pencil, Trash2, Search, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Service, Platform } from "@/lib/supabase-db";

const SMM_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") + "/api/smm";

async function syncServices(token: string): Promise<{ synced: number; total: number; message: string }> {
  const res = await fetch(`${SMM_BASE}/sync-services`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const json = await res.json() as { ok: boolean; synced: number; total: number; message: string; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error || "فشل المزامنة");
  return json;
}

async function getAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*, platforms(name)")
    .order("platform_id")
    .order("id");
  if (error) throw error;
  return data as Service[];
}

async function getAllPlatforms(): Promise<Platform[]> {
  const { data, error } = await supabase.from("platforms").select("*").order("id");
  if (error) throw error;
  return data as Platform[];
}

async function upsertService(service: Partial<Service>): Promise<void> {
  if (service.id) {
    const { error } = await supabase.from("services").update({
      platform_id: service.platform_id,
      name: service.name,
      description: service.description,
      price: service.price,
      min_order: service.min_order,
      max_order: service.max_order,
      status: service.status,
    }).eq("id", service.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("services").insert({
      platform_id: service.platform_id,
      name: service.name,
      description: service.description || null,
      price: service.price,
      min_order: service.min_order,
      max_order: service.max_order,
      status: service.status || "active",
    });
    if (error) throw error;
  }
}

async function deleteService(id: number): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

const BLANK_FORM = { name: "", platform_id: 0, price: 1000, min_order: 100, max_order: 100000, description: "", status: "active" as const };

export function AdminServices() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [syncing,  setSyncing]  = useState(false);

  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") setLocation("/");
  }, [profile, profileLoading, setLocation]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("الجلسة منتهية");
      const result = await syncServices(token);
      queryClient.invalidateQueries({ queryKey: ["supabase"] });
      toast({ title: `✅ ${result.message}`, description: `تم مزامنة ${result.total} خدمة من Followiz` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ في المزامنة";
      toast({ variant: "destructive", title: "فشل المزامنة", description: msg });
    } finally {
      setSyncing(false);
    }
  };

  const { data: services, isLoading } = useQuery({
    queryKey: ["supabase", "admin", "services"],
    queryFn: getAllServices,
    enabled: profile?.role === "admin",
  });

  const { data: platforms } = useQuery({
    queryKey: ["supabase", "admin", "all-platforms"],
    queryFn: getAllPlatforms,
    enabled: profile?.role === "admin",
  });

  const { mutateAsync: saveService, isPending: saving } = useMutation({
    mutationFn: upsertService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase"] });
      toast({ title: editingService ? "✅ تم تحديث الخدمة" : "✅ تم إضافة الخدمة" });
      setDialogOpen(false);
      setEditingService(null);
      setForm(BLANK_FORM);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "خطأ", description: err.message }),
  });

  const { mutateAsync: removeService, isPending: deleting } = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase"] });
      toast({ title: "🗑️ تم حذف الخدمة" });
      setDeleteId(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "خطأ", description: err.message }),
  });

  const openAdd = () => {
    setEditingService(null);
    setForm({ ...BLANK_FORM, platform_id: platforms?.[0]?.id || 0 });
    setDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setForm({ name: s.name, platform_id: s.platform_id, price: s.price, min_order: s.min_order, max_order: s.max_order, description: s.description || "", status: (s.status as "active" | "inactive") });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.platform_id) {
      toast({ variant: "destructive", title: "يرجى ملء جميع الحقول المطلوبة" });
      return;
    }
    saveService({ ...(editingService ? { id: editingService.id } : {}), ...form });
  };

  const filtered = services?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.platforms?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-gray-400">هل أنت متأكد من حذف هذه الخدمة؟ لا يمكن التراجع.</p>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
              onClick={() => deleteId && removeService(deleteId)} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف"}
            </Button>
            <Button className="flex-1 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
              onClick={() => setDeleteId(null)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingService(null); setForm(BLANK_FORM); } }}>
        <DialogContent className="bg-[#111122] border-white/10 text-white max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingService ? "تعديل الخدمة" : "إضافة خدمة جديدة"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-gray-300">المنصة *</Label>
              <Select value={String(form.platform_id)} onValueChange={v => setForm(f => ({ ...f, platform_id: Number(v) }))}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                  <SelectValue placeholder="اختر المنصة" />
                </SelectTrigger>
                <SelectContent className="bg-[#111122] border-white/10 text-white">
                  {platforms?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">اسم الخدمة *</Label>
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-white/5 border-white/10 text-white rounded-xl h-11" placeholder="مثال: متابعين انستغرام عرب" />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">وصف (اختياري)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-white/5 border-white/10 text-white rounded-xl h-11" placeholder="وصف الخدمة..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">سعر 1000 (IQD) *</Label>
                <Input type="number" required min={1} value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11 font-mono" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">أقل كمية *</Label>
                <Input type="number" required min={1} value={form.min_order}
                  onChange={e => setForm(f => ({ ...f, min_order: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11 font-mono" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">أقصى كمية *</Label>
                <Input type="number" required min={1} value={form.max_order}
                  onChange={e => setForm(f => ({ ...f, max_order: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white rounded-xl h-11 font-mono" dir="ltr" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as "active" | "inactive" }))}>
                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111122] border-white/10 text-white">
                  <SelectItem value="active">مفعّل</SelectItem>
                  <SelectItem value="inactive">معطّل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={saving}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-bold mt-2">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingService ? "حفظ التعديلات" : "إضافة الخدمة")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Settings className="w-8 h-8 text-green-400" />
              إدارة الخدمات
            </h1>
            <p className="text-gray-400">إضافة وتعديل وحذف الخدمات المتاحة</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Sync Followiz Services */}
            <Button onClick={handleSync} disabled={syncing}
              className="bg-gradient-to-r from-green-700 to-teal-700 hover:from-green-800 hover:to-teal-800 text-white rounded-xl gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {syncing ? "جاري المزامنة..." : "مزامنة خدمات Followiz"}
            </Button>
            {/* Add Local Service */}
            <Button onClick={openAdd}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl gap-2">
              <Plus className="w-5 h-5" />
              إضافة خدمة
            </Button>
          </div>
        </header>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="ابحث عن خدمة أو منصة..."
            className="pr-10 h-12 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-purple-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />)}</div>
        ) : !filtered?.length ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-12 text-center text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد خدمات — اضغط "إضافة خدمة" للبدء</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(service => (
              <Card key={service.id} className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-xs font-mono text-purple-400 bg-purple-400/10 px-2 py-1 rounded shrink-0">#{service.id}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded">{service.platforms?.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${service.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {service.status === "active" ? "مفعّل" : "معطّل"}
                        </span>
                      </div>
                      <p className="font-bold text-white truncate mt-0.5">{service.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">السعر / 1000</p>
                      <p className="font-mono text-purple-400 font-bold">IQD {Number(service.price).toLocaleString()}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">الكميات</p>
                      <p className="font-mono text-gray-300 text-sm">{service.min_order.toLocaleString()} — {service.max_order.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(service)}
                        className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(service.id)}
                        className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
