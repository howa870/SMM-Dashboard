import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ShoppingCart, Globe, Database, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Service } from "@/lib/supabase-db";

// ─── Fetch all active services from Supabase ──────────────────────────────────
async function fetchAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*, platforms(name)")
    .eq("status", "active")
    .order("id");
  if (error) throw error;
  return data as Service[];
}

type Tab = "all" | "followiz" | "local";

export function Services() {
  const [tab, setTab]                       = useState<Tab>("all");
  const [search, setSearch]                 = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ["supabase", "services-all"],
    queryFn:  fetchAllServices,
    staleTime: 60_000,
  });

  // Compute unique categories (for followiz services)
  const categories = useMemo(() => {
    if (!services) return [];
    const cats = new Set(services.filter(s => s.provider === "followiz" && s.category).map(s => s.category!));
    return ["الكل", ...Array.from(cats)];
  }, [services]);

  // Filter based on tab + search + category
  const filtered = useMemo(() => {
    if (!services) return [];
    return services.filter(s => {
      const byTab =
        tab === "all"     ? true :
        tab === "followiz"? s.provider === "followiz" :
        tab === "local"   ? s.provider !== "followiz" : true;

      const bySearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.category || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.platforms?.name || "").toLowerCase().includes(search.toLowerCase());

      const byCat = selectedCategory === "الكل" ||
        tab !== "followiz" ||
        s.category === selectedCategory;

      return byTab && bySearch && byCat;
    });
  }, [services, tab, search, selectedCategory]);

  const followizCount = services?.filter(s => s.provider === "followiz").length || 0;
  const localCount    = services?.filter(s => s.provider !== "followiz").length || 0;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">الخدمات</h1>
          <p className="text-gray-400">تصفح جميع الخدمات المتاحة وأنشئ طلبك</p>
        </header>

        {/* Tab Bar */}
        <div className="flex gap-3 flex-wrap">
          {(["all", "followiz", "local"] as const).map(t => {
            const labels: Record<Tab, string> = { all: "الكل", followiz: "خدمات المزود", local: "خدماتنا" };
            const icons: Record<Tab, React.ReactNode> = {
              all:     <span className="font-bold text-sm">{services?.length || 0}</span>,
              followiz:<Globe className="w-4 h-4" />,
              local:   <Database className="w-4 h-4" />,
            };
            return (
              <button key={t} onClick={() => { setTab(t); setSelectedCategory("الكل"); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${
                  tab === t
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20"
                    : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}>
                {icons[t]}
                {labels[t]}
                {t === "followiz" && followizCount > 0 && (
                  <Badge className="bg-white/20 text-white text-xs px-1.5 py-0.5">{followizCount}</Badge>
                )}
                {t === "local" && localCount > 0 && (
                  <Badge className="bg-white/20 text-white text-xs px-1.5 py-0.5">{localCount}</Badge>
                )}
              </button>
            );
          })}
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all mr-auto">
            <RefreshCw className="w-4 h-4" />تحديث
          </button>
        </div>

        <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="البحث عن خدمة..."
                className="pl-4 pr-10 h-12 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-purple-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {tab === "followiz" && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <Button key={cat} size="sm"
                    variant={selectedCategory === cat ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-xl whitespace-nowrap text-xs ${
                      selectedCategory === cat
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 border-none"
                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                    }`}>
                    {cat}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-right text-gray-400 w-14">#</TableHead>
                  <TableHead className="text-right text-gray-400">الفئة / المنصة</TableHead>
                  <TableHead className="text-right text-gray-400">الخدمة</TableHead>
                  <TableHead className="text-right text-gray-400">السعر/1000</TableHead>
                  <TableHead className="text-right text-gray-400">أقل / أقصى</TableHead>
                  <TableHead className="text-right text-gray-400"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <TableRow key={i} className="border-white/10">
                      {[...Array(6)].map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full bg-white/10" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !filtered.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                      {followizCount === 0
                        ? "لا توجد خدمات بعد — اطلب من المشرف مزامنة الخدمات من المزود"
                        : "لا توجد خدمات تطابق البحث"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(svc => (
                    <TableRow key={svc.id} className="border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="font-mono text-gray-500 text-xs">{svc.id}</TableCell>
                      <TableCell>
                        {svc.provider === "followiz" ? (
                          <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md line-clamp-1 max-w-[140px] block">
                            {svc.category || "—"}
                          </span>
                        ) : (
                          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                            {svc.platforms?.name || "محلي"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-white text-sm max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          {svc.provider === "followiz"
                            ? <Globe className="w-3 h-3 text-purple-400 shrink-0" />
                            : <Database className="w-3 h-3 text-blue-400 shrink-0" />}
                          <span className="line-clamp-2">{svc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold font-mono text-purple-400 text-sm whitespace-nowrap">
                        IQD {Number(svc.price).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-400 font-mono text-xs whitespace-nowrap">
                        {svc.min_order.toLocaleString()} — {svc.max_order.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Link href={`/order?sid=${svc.id}&sname=${encodeURIComponent(svc.name)}&sprice=${svc.price}&smin=${svc.min_order}&smax=${svc.max_order}&sprovider=${svc.provider || "local"}`}>
                          <Button size="sm"
                            className="bg-white/10 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600 text-white rounded-lg text-xs whitespace-nowrap transition-all">
                            <ShoppingCart className="w-3 h-3 ml-1" />طلب
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filtered.length > 0 && (
            <p className="text-xs text-gray-600 mt-3 text-center">
              عرض {filtered.length.toLocaleString()} خدمة
            </p>
          )}
        </Card>
      </div>
    </Layout>
  );
}
