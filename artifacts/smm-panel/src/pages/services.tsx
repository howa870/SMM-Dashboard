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
import { Search, ShoppingCart, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import type { Service } from "@/lib/supabase-db";

// ─── Platform metadata ────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  Instagram:  { icon: "📸", color: "text-pink-400",   bg: "from-pink-600/25 to-purple-600/25",   border: "border-pink-500/40"   },
  TikTok:     { icon: "🎵", color: "text-cyan-300",   bg: "from-cyan-700/25 to-slate-800/40",    border: "border-cyan-500/40"   },
  Telegram:   { icon: "✈️", color: "text-blue-400",   bg: "from-blue-700/25 to-sky-700/25",      border: "border-blue-500/40"   },
  YouTube:    { icon: "▶️", color: "text-red-400",    bg: "from-red-700/25 to-orange-700/25",    border: "border-red-500/40"    },
  Facebook:   { icon: "👤", color: "text-blue-300",   bg: "from-blue-800/25 to-indigo-800/25",   border: "border-blue-400/40"   },
  Twitter:    { icon: "𝕏",  color: "text-gray-200",   bg: "from-gray-700/30 to-slate-800/30",    border: "border-gray-500/40"   },
  Snapchat:   { icon: "👻", color: "text-yellow-300", bg: "from-yellow-700/25 to-amber-700/25",  border: "border-yellow-500/40" },
  Twitch:     { icon: "🎮", color: "text-purple-300", bg: "from-purple-800/25 to-violet-800/25", border: "border-purple-500/40" },
  Spotify:    { icon: "🎧", color: "text-green-300",  bg: "from-green-800/25 to-emerald-800/25", border: "border-green-500/40"  },
  SoundCloud: { icon: "🔊", color: "text-orange-300", bg: "from-orange-700/25 to-amber-700/25",  border: "border-orange-500/40" },
  LinkedIn:   { icon: "💼", color: "text-blue-200",   bg: "from-blue-900/25 to-indigo-800/25",   border: "border-blue-300/40"   },
  Pinterest:  { icon: "📌", color: "text-rose-300",   bg: "from-rose-700/25 to-red-700/25",      border: "border-rose-500/40"   },
  Discord:    { icon: "💬", color: "text-indigo-300", bg: "from-indigo-800/25 to-violet-700/25", border: "border-indigo-500/40" },
  Threads:    { icon: "🧵", color: "text-gray-300",   bg: "from-gray-800/25 to-slate-700/25",    border: "border-gray-400/40"   },
  Other:      { icon: "🌐", color: "text-gray-400",   bg: "from-gray-800/25 to-gray-700/25",     border: "border-gray-500/40"   },
};

function getMeta(p: string) { return PLATFORM_META[p] || PLATFORM_META["Other"]; }

// ─── Fetch services via backend (auto-syncs from Followiz if needed) ──────────
const SMM_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api/smm";

async function fetchServices(): Promise<Service[]> {
  const res = await fetch(`${SMM_BASE}/services`);
  if (!res.ok) throw new Error("تعذر تحميل الخدمات");
  const json = await res.json() as { ok: boolean; data: Service[]; error?: string };
  if (!json.ok) throw new Error(json.error || "خطأ");
  return json.data;
}

export function Services() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [search,           setSearch]           = useState("");

  const { data: services, isLoading, isFetching, error, refetch } = useQuery({
    queryKey:  ["backend", "smm-services"],
    queryFn:   fetchServices,
    staleTime: 5 * 60 * 1000,   // 5 min client-side cache
    retry: 2,
  });

  // Platform counts from loaded data
  const platformStats = useMemo(() => {
    if (!services) return [];
    const map: Record<string, number> = {};
    for (const s of services) {
      const p = s.platform || "Other";
      map[p] = (map[p] || 0) + 1;
    }
    return Object.entries(map).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  // Filtered services
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

  const isFirstLoad = isLoading;  // no data yet

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">

        {/* ── Header ── */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">الخدمات</h1>
            {services && services.length > 0 ? (
              <p className="text-gray-400">
                {services.length.toLocaleString()} خدمة متاحة عبر {platformStats.length} منصة
                {isFetching && <span className="text-blue-400 text-xs mr-2">• يحدث...</span>}
              </p>
            ) : (
              <p className="text-blue-400">
                {isFirstLoad ? "جاري تحميل الخدمات..." : "لا توجد خدمات"}
              </p>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "يحدث..." : "تحديث"}
          </button>
        </header>

        {/* ── Error State ── */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
            <span>تعذر تحميل الخدمات</span>
            <button onClick={() => refetch()} className="text-xs underline hover:no-underline">إعادة المحاولة</button>
          </div>
        )}

        {/* ── Platform Grid ── */}
        {isFirstLoad ? (
          // Loading skeleton for grid
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                <div className="h-full animate-pulse bg-gradient-to-r from-white/5 to-white/10" />
              </div>
            ))}
          </div>
        ) : platformStats.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* "All" card */}
            <button
              onClick={() => setSelectedPlatform(null)}
              className={`p-4 rounded-2xl border transition-all text-right flex flex-col gap-2 hover:scale-[1.03] active:scale-100 ${
                !selectedPlatform
                  ? "bg-gradient-to-br from-purple-600/30 to-blue-600/30 border-purple-500/50 shadow-lg shadow-purple-500/20"
                  : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl select-none">✨</span>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full font-bold ${
                  !selectedPlatform ? "bg-white/20 text-white" : "bg-white/10 text-gray-400"
                }`}>
                  {services?.length || 0}
                </span>
              </div>
              <div>
                <p className={`font-bold text-sm ${!selectedPlatform ? "text-white" : "text-gray-300"}`}>الكل</p>
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
                <button key={name}
                  onClick={() => setSelectedPlatform(active ? null : name)}
                  className={`p-4 rounded-2xl border transition-all text-right flex flex-col gap-2 hover:scale-[1.03] active:scale-100 ${
                    active
                      ? `bg-gradient-to-br ${meta.bg} ${meta.border} shadow-lg`
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl select-none">{meta.icon}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full font-bold ${
                      active ? "bg-white/20 text-white" : "bg-white/10 text-gray-400"
                    }`}>{count}</span>
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
        ) : !isFirstLoad && !error ? (
          // Never-synced state
          <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <p className="text-white font-semibold text-lg">جاري تحميل الخدمات...</p>
            <p className="text-gray-400 text-sm max-w-xs">يتم جلب الخدمات تلقائياً، انتظر لحظة</p>
            <button onClick={() => refetch()} className="text-purple-400 text-sm underline hover:no-underline">
              تحديث يدوي
            </button>
          </div>
        ) : null}

        {/* ── Services Table ── */}
        {!isFirstLoad && platformStats.length > 0 && (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-5">
            {/* Search + breadcrumb */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
              <div className="flex items-center gap-2 text-sm shrink-0 flex-wrap">
                {selectedPlatform ? (
                  <>
                    <span className="text-lg">{getMeta(selectedPlatform).icon}</span>
                    <span className={`font-bold ${getMeta(selectedPlatform).color}`}>{selectedPlatform}</span>
                    <button onClick={() => setSelectedPlatform(null)}
                      className="text-gray-600 hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">جميع المنصات</span>
                )}
                <Badge className="bg-white/10 text-gray-300 text-xs border-none font-mono">
                  {filtered.length.toLocaleString()} خدمة
                </Badge>
              </div>

              <div className="relative flex-1 w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="البحث عن خدمة..."
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
                    <TableHead className="text-right text-gray-400 w-12">#</TableHead>
                    <TableHead className="text-right text-gray-400">الفئة</TableHead>
                    <TableHead className="text-right text-gray-400">الخدمة</TableHead>
                    <TableHead className="text-right text-gray-400">السعر/1000</TableHead>
                    <TableHead className="text-right text-gray-400 hidden sm:table-cell">أقل / أقصى</TableHead>
                    <TableHead className="text-right text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-gray-400">
                        {search ? "لا توجد نتائج للبحث" : "لا توجد خدمات لهذه المنصة"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(svc => {
                      const meta = getMeta(svc.platform || "Other");
                      return (
                        <TableRow key={svc.id} className="border-white/10 hover:bg-white/5 transition-colors">
                          <TableCell className="font-mono text-gray-600 text-xs">{svc.id}</TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-500 line-clamp-1 max-w-[110px] block">
                              {svc.category || svc.platforms?.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base select-none shrink-0">{meta.icon}</span>
                              <span className="text-white text-sm line-clamp-2 leading-snug">{svc.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold font-mono text-purple-400 text-sm whitespace-nowrap">
                            IQD {Number(svc.price).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-gray-500 font-mono text-xs whitespace-nowrap hidden sm:table-cell">
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
                عرض {filtered.length.toLocaleString()} خدمة{selectedPlatform ? ` في ${selectedPlatform}` : ""}
              </p>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}
