import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
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
import { Search, ShoppingCart, ArrowRight, Globe, Database, RefreshCw, Layers } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Service } from "@/lib/supabase-db";

// ─── Platform metadata ────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { icon: string; color: string; gradient: string }> = {
  Instagram:  { icon: "📸", color: "text-pink-400",   gradient: "from-pink-600/20 to-purple-600/20 border-pink-500/20"   },
  TikTok:     { icon: "🎵", color: "text-cyan-400",   gradient: "from-cyan-600/20 to-black/30 border-cyan-500/20"        },
  Telegram:   { icon: "✈️", color: "text-blue-400",   gradient: "from-blue-600/20 to-sky-600/20 border-blue-500/20"      },
  YouTube:    { icon: "▶️", color: "text-red-400",    gradient: "from-red-600/20 to-orange-600/20 border-red-500/20"     },
  Facebook:   { icon: "👤", color: "text-blue-500",   gradient: "from-blue-700/20 to-indigo-700/20 border-blue-600/20"   },
  Twitter:    { icon: "𝕏",  color: "text-gray-200",   gradient: "from-gray-700/30 to-slate-700/20 border-gray-500/20"   },
  Snapchat:   { icon: "👻", color: "text-yellow-400", gradient: "from-yellow-600/20 to-amber-600/20 border-yellow-500/20"},
  Twitch:     { icon: "🎮", color: "text-purple-400", gradient: "from-purple-700/20 to-violet-700/20 border-purple-500/20"},
  Spotify:    { icon: "🎧", color: "text-green-400",  gradient: "from-green-700/20 to-emerald-700/20 border-green-500/20"},
  SoundCloud: { icon: "🔊", color: "text-orange-400", gradient: "from-orange-600/20 to-amber-600/20 border-orange-500/20"},
  LinkedIn:   { icon: "💼", color: "text-blue-300",   gradient: "from-blue-800/20 to-indigo-700/20 border-blue-400/20"  },
  Pinterest:  { icon: "📌", color: "text-rose-400",   gradient: "from-rose-600/20 to-red-600/20 border-rose-500/20"     },
  Discord:    { icon: "💬", color: "text-indigo-400", gradient: "from-indigo-700/20 to-violet-600/20 border-indigo-500/20"},
  Threads:    { icon: "🧵", color: "text-gray-300",   gradient: "from-gray-700/20 to-slate-600/20 border-gray-400/20"   },
  Other:      { icon: "🌐", color: "text-gray-400",   gradient: "from-gray-700/20 to-gray-600/20 border-gray-500/20"    },
};

function getMeta(platform: string) {
  return PLATFORM_META[platform] || PLATFORM_META["Other"];
}

// ─── Fetch all active services from Supabase ──────────────────────────────────
async function fetchAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, category, platform, price, min_order, max_order, status, provider, provider_service_id, platform_id")
    .eq("status", "active")
    .order("platform")
    .order("id");
  if (error) throw error;
  return data as Service[];
}

export function Services() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [search, setSearch]                     = useState("");

  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ["supabase", "services-all"],
    queryFn:  fetchAllServices,
    staleTime: 60_000,
  });

  // Build platform summary from loaded services
  const platformStats = useMemo(() => {
    if (!services) return [];
    const map: Record<string, number> = {};
    for (const s of services) {
      const p = s.platform || "Other";
      map[p] = (map[p] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  // Filter by selected platform + search
  const filtered = useMemo(() => {
    if (!services) return [];
    return services.filter(s => {
      const byPlatform = !selectedPlatform || (s.platform || "Other") === selectedPlatform;
      const bySearch   = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.category || "").toLowerCase().includes(search.toLowerCase());
      return byPlatform && bySearch;
    });
  }, [services, selectedPlatform, search]);

  const syncedCount   = services?.filter(s => s.provider === "followiz").length || 0;
  const localCount    = services?.filter(s => s.provider !== "followiz").length || 0;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* ── Header ── */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">الخدمات</h1>
            <p className="text-gray-400">
              {syncedCount > 0
                ? `${syncedCount.toLocaleString()} خدمة من المزود • ${localCount} خدمة محلية`
                : "لم يتم مزامنة الخدمات بعد — اذهب للوحة المشرف وأضغط مزامنة"}
            </p>
          </div>
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all text-sm">
            <RefreshCw className="w-4 h-4" />تحديث
          </button>
        </header>

        {/* ── Platform Grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : platformStats.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-10 text-center">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 mb-2">لا توجد خدمات مزامنة بعد</p>
            <p className="text-gray-600 text-sm">اذهب إلى <strong className="text-purple-400">لوحة المشرف ← إدارة الخدمات</strong> واضغط "مزامنة خدمات Followiz"</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* "All" card */}
            <button
              onClick={() => setSelectedPlatform(null)}
              className={`group relative p-4 rounded-2xl border transition-all text-right flex flex-col gap-2 hover:scale-[1.03] ${
                selectedPlatform === null
                  ? "bg-gradient-to-br from-purple-600/30 to-blue-600/30 border-purple-500/50 shadow-lg shadow-purple-500/20"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">✨</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  selectedPlatform === null ? "bg-purple-500/30 text-purple-300" : "bg-white/10 text-gray-400"
                }`}>
                  {services?.length || 0}
                </span>
              </div>
              <div>
                <p className={`font-bold text-sm ${selectedPlatform === null ? "text-white" : "text-gray-300"}`}>
                  جميع المنصات
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs text-green-400">متاح</span>
                </div>
              </div>
            </button>

            {platformStats.map(({ name, count }) => {
              const meta   = getMeta(name);
              const active = selectedPlatform === name;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedPlatform(active ? null : name)}
                  className={`group relative p-4 rounded-2xl border transition-all text-right flex flex-col gap-2 hover:scale-[1.03] ${
                    active
                      ? `bg-gradient-to-br ${meta.gradient} shadow-lg`
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{meta.icon}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                      active ? "bg-white/20 text-white" : "bg-white/10 text-gray-400"
                    }`}>
                      {count}
                    </span>
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${active ? "text-white" : "text-gray-300"}`}>{name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-xs text-green-400">متاح</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Services Table ── */}
        {(platformStats.length > 0 || isLoading) && (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-6">
            {/* Search + breadcrumb */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
                {selectedPlatform ? (
                  <>
                    <span className="text-xl">{getMeta(selectedPlatform).icon}</span>
                    <span className={`font-bold ${getMeta(selectedPlatform).color}`}>{selectedPlatform}</span>
                    <button onClick={() => setSelectedPlatform(null)}
                      className="text-gray-600 hover:text-gray-300 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-gray-500">جميع الخدمات</span>
                )}
                <Badge className="bg-white/10 text-gray-300 text-xs border-none">
                  {filtered.length.toLocaleString()} خدمة
                </Badge>
              </div>

              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="البحث..."
                  className="pr-10 h-10 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-purple-500 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-right text-gray-400 w-14">#</TableHead>
                    <TableHead className="text-right text-gray-400">الفئة</TableHead>
                    <TableHead className="text-right text-gray-400">اسم الخدمة</TableHead>
                    <TableHead className="text-right text-gray-400 whitespace-nowrap">السعر/1000</TableHead>
                    <TableHead className="text-right text-gray-400 whitespace-nowrap hidden sm:table-cell">أقل / أقصى</TableHead>
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
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                        {search ? "لا توجد خدمات تطابق البحث" : "لا توجد خدمات لهذه المنصة"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(svc => {
                      const p = svc.platform || "Other";
                      const meta = getMeta(p);
                      return (
                        <TableRow key={svc.id} className="border-white/10 hover:bg-white/5 transition-colors">
                          <TableCell className="font-mono text-gray-500 text-xs">{svc.id}</TableCell>
                          <TableCell>
                            <span className="text-xs line-clamp-1 max-w-[120px] block text-gray-400">
                              {svc.category || svc.platforms?.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{meta.icon}</span>
                              <span className="text-white text-sm line-clamp-2 leading-snug">{svc.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold font-mono text-purple-400 text-sm whitespace-nowrap">
                            IQD {Number(svc.price).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-gray-400 font-mono text-xs whitespace-nowrap hidden sm:table-cell">
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
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {filtered.length > 0 && (
              <p className="text-xs text-gray-600 mt-3 text-center">
                عرض {filtered.length.toLocaleString()} خدمة
                {selectedPlatform ? ` من ${selectedPlatform}` : ""}
              </p>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}
