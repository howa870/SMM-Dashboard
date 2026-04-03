import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart, RefreshCw, Loader2, ChevronRight, ArrowRight } from "lucide-react";
import type { Service, ServiceType } from "@/lib/supabase-db";

// ─── Platform metadata ─────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { icon: string; color: string; bg: string; border: string; glow: string }> = {
  Instagram:  { icon: "📸", color: "text-pink-400",   bg: "from-pink-600/20 to-purple-600/20",   border: "border-pink-500/40",   glow: "shadow-pink-500/20"   },
  TikTok:     { icon: "🎵", color: "text-cyan-300",   bg: "from-cyan-700/20 to-slate-800/30",    border: "border-cyan-500/40",   glow: "shadow-cyan-500/20"   },
  Telegram:   { icon: "✈️", color: "text-sky-400",    bg: "from-sky-700/20 to-blue-700/20",      border: "border-sky-500/40",    glow: "shadow-sky-500/20"    },
  YouTube:    { icon: "▶️", color: "text-red-400",    bg: "from-red-700/20 to-orange-700/20",    border: "border-red-500/40",    glow: "shadow-red-500/20"    },
  Facebook:   { icon: "👤", color: "text-blue-300",   bg: "from-blue-800/20 to-indigo-800/20",   border: "border-blue-400/40",   glow: "shadow-blue-500/20"   },
  Twitter:    { icon: "𝕏",  color: "text-gray-200",   bg: "from-gray-700/25 to-slate-800/25",    border: "border-gray-500/40",   glow: "shadow-gray-500/20"   },
  Snapchat:   { icon: "👻", color: "text-yellow-300", bg: "from-yellow-700/20 to-amber-700/20",  border: "border-yellow-500/40", glow: "shadow-yellow-500/20" },
  Twitch:     { icon: "🎮", color: "text-purple-300", bg: "from-purple-800/20 to-violet-800/20", border: "border-purple-500/40", glow: "shadow-purple-500/20" },
  Spotify:    { icon: "🎧", color: "text-green-300",  bg: "from-green-800/20 to-emerald-800/20", border: "border-green-500/40",  glow: "shadow-green-500/20"  },
  SoundCloud: { icon: "🔊", color: "text-orange-300", bg: "from-orange-700/20 to-amber-700/20",  border: "border-orange-500/40", glow: "shadow-orange-500/20" },
  LinkedIn:   { icon: "💼", color: "text-blue-200",   bg: "from-blue-900/20 to-indigo-800/20",   border: "border-blue-300/40",   glow: "shadow-blue-400/20"   },
  Other:      { icon: "🌐", color: "text-gray-400",   bg: "from-gray-800/20 to-gray-700/20",     border: "border-gray-500/40",   glow: "shadow-gray-500/20"   },
};
const getMeta = (p: string) => PLATFORM_META[p] || PLATFORM_META["Other"];

// ─── Service type metadata ─────────────────────────────────────────────────────
const TYPE_META: Record<ServiceType, { icon: string; label: string; color: string }> = {
  Followers: { icon: "👥", label: "متابعون",    color: "text-blue-400"   },
  Likes:     { icon: "❤️", label: "إعجابات",    color: "text-pink-400"   },
  Views:     { icon: "👁️", label: "مشاهدات",    color: "text-purple-400" },
  Comments:  { icon: "💬", label: "تعليقات",    color: "text-yellow-400" },
  Other:     { icon: "⚡", label: "خدمات أخرى", color: "text-gray-400"   },
};
const TYPE_ORDER: ServiceType[] = ["Followers", "Likes", "Views", "Comments", "Other"];

function getServiceType(s: Service): ServiceType {
  if (s.service_type) return s.service_type;
  const n = s.name.toLowerCase();
  if (/follower|member|subscriber|\bsubs?\b|audience|fan/.test(n)) return "Followers";
  if (/\blikes?\b|heart|reaction|retweet|\bfave\b/.test(n))        return "Likes";
  if (/\bviews?\b|watch|\bplays?\b|stream|impression/.test(n))     return "Views";
  if (/comment|reply|review/.test(n))                               return "Comments";
  return "Other";
}

function qualityBadge(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("no drop"))                         return "بدون انخفاض";
  if (n.includes("[r365]"))                          return "ضمان سنة";
  if (n.includes("high quality") || n.includes("hq")) return "جودة عالية";
  if (n.includes("real"))                            return "حقيقي";
  if (n.includes("[r90]") || n.includes("[r60]"))   return "ضمان 90يوم";
  if (n.includes("[r30]"))                           return "ضمان 30يوم";
  if (n.includes("[r7]") || n.includes("refill"))   return "ريفيل";
  if (n.includes("fast"))                            return "سريع";
  return null;
}

// ─── Backend fetch ──────────────────────────────────────────────────────────────
const SMM_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api/smm";

async function fetchServices(): Promise<Service[]> {
  const res = await fetch(`${SMM_BASE}/services`);
  if (!res.ok) throw new Error("تعذر تحميل الخدمات");
  const json = await res.json() as { ok: boolean; data: Service[] };
  if (!json.ok) throw new Error("خطأ في تحميل الخدمات");
  return json.data;
}

// ─── Single service row ─────────────────────────────────────────────────────────
function ServiceRow({ svc, platformMeta }: { svc: Service; platformMeta: ReturnType<typeof getMeta> }) {
  const badge = qualityBadge(svc.name);
  const orderUrl = `/order?sid=${svc.id}&sname=${encodeURIComponent(svc.name)}&sprice=${svc.price}&smin=${svc.min_order}&smax=${svc.max_order}&sprovider=${svc.provider || "local"}`;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/10 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-sm font-medium leading-snug line-clamp-2">{svc.name}</span>
          {badge && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>الحد الأدنى: <span className="text-gray-400">{svc.min_order.toLocaleString()}</span></span>
          <span>•</span>
          <span>الأقصى: <span className="text-gray-400">{svc.max_order.toLocaleString()}</span></span>
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="text-xs text-gray-500 mb-0.5">لكل 1000</div>
        <div className={`font-bold font-mono text-sm ${platformMeta.color}`}>
          IQD {Number(svc.price).toLocaleString()}
        </div>
      </div>
      <Link href={orderUrl}>
        <Button size="sm"
          className="shrink-0 h-8 px-3 bg-white/8 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100">
          <ShoppingCart className="w-3 h-3 ml-1" />طلب
        </Button>
      </Link>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function Services() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedType,     setSelectedType]     = useState<ServiceType | "all">("all");
  const [search,           setSearch]           = useState("");

  const { data: services, isLoading, isFetching, error, refetch } = useQuery({
    queryKey:  ["smm-services"],
    queryFn:   fetchServices,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Platform stats from loaded services
  const platformStats = useMemo(() => {
    if (!services) return [];
    const map: Record<string, number> = {};
    for (const s of services) { const p = s.platform || "Other"; map[p] = (map[p] || 0) + 1; }
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [services]);

  // Services for the selected platform
  const platformServices = useMemo(() => {
    if (!services) return [];
    return services.filter(s => (s.platform || "Other") === selectedPlatform);
  }, [services, selectedPlatform]);

  // Available types in the selected platform
  const availableTypes = useMemo<ServiceType[]>(() => {
    if (!platformServices.length) return [];
    const seen = new Set<ServiceType>();
    for (const s of platformServices) seen.add(getServiceType(s));
    return TYPE_ORDER.filter(t => seen.has(t));
  }, [platformServices]);

  // Filtered + searched services for selected platform & type
  const filteredServices = useMemo(() => {
    let list = platformServices;
    if (selectedType !== "all") list = list.filter(s => getServiceType(s) === selectedType);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [platformServices, selectedType, search]);

  // Group filteredServices by type for display
  const groupedServices = useMemo(() => {
    if (selectedType !== "all") {
      return { [selectedType]: filteredServices } as Record<ServiceType, Service[]>;
    }
    const groups: Record<string, Service[]> = {};
    for (const s of filteredServices) {
      const t = getServiceType(s);
      (groups[t] ||= []).push(s);
    }
    return groups as Record<ServiceType, Service[]>;
  }, [filteredServices, selectedType]);

  const currentMeta = selectedPlatform ? getMeta(selectedPlatform) : null;

  return (
    <Layout>
      <div className="space-y-5 animate-in fade-in duration-500">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            {selectedPlatform ? (
              <div className="flex items-center gap-2">
                <button onClick={() => { setSelectedPlatform(null); setSelectedType("all"); setSearch(""); }}
                  className="text-gray-500 hover:text-white transition-colors text-sm flex items-center gap-1">
                  <span>الخدمات</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className={`text-lg font-bold ${currentMeta?.color}`}>
                  {getMeta(selectedPlatform).icon} {selectedPlatform}
                </span>
                <span className="text-gray-500 text-sm">({platformServices.length} خدمة)</span>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-white">الخدمات</h1>
            )}
            {!selectedPlatform && services && (
              <p className="text-gray-500 text-sm mt-0.5">
                {services.length} خدمة عالية الجودة عبر {platformStats.length} منصة
              </p>
            )}
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white text-sm transition-all disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "يحدث..." : "تحديث"}
          </button>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
            <span>تعذر تحميل الخدمات</span>
            <button onClick={() => refetch()} className="text-xs underline">إعادة المحاولة</button>
          </div>
        )}

        {/* ══ PLATFORM GRID (shown when no platform selected) ══════════ */}
        {!selectedPlatform && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
                ))}
              </div>
            ) : platformStats.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-white font-semibold">جاري تحميل الخدمات...</p>
                <p className="text-gray-500 text-sm">يتم جلب الخدمات تلقائياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {platformStats.map(({ name, count }) => {
                  const meta = getMeta(name);
                  return (
                    <button key={name} onClick={() => { setSelectedPlatform(name); setSelectedType("all"); setSearch(""); }}
                      className={`group p-4 rounded-2xl border bg-gradient-to-br ${meta.bg} ${meta.border} hover:shadow-lg ${meta.glow} transition-all hover:scale-[1.03] active:scale-100 text-right flex flex-col gap-2.5`}>
                      <div className="flex items-start justify-between">
                        <span className="text-2xl select-none">{meta.icon}</span>
                        <div className="text-right">
                          <span className={`font-mono font-bold text-lg ${meta.color}`}>{count}</span>
                          <p className="text-[10px] text-gray-500">خدمة</p>
                        </div>
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${meta.color}`}>{name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] text-emerald-400">متاح الآن</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-gray-500">عرض الخدمات</span>
                        <ArrowRight className={`w-3 h-3 ${meta.color}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ PLATFORM DETAIL (shown after clicking a platform) ════════ */}
        {selectedPlatform && currentMeta && (
          <div className="space-y-4">
            {/* ── Type tabs ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedType("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedType === "all"
                    ? `bg-gradient-to-r ${currentMeta.bg} ${currentMeta.border} border ${currentMeta.color}`
                    : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                }`}
              >
                ✨ الكل ({platformServices.length})
              </button>
              {availableTypes.map(type => {
                const tm = TYPE_META[type];
                const count = platformServices.filter(s => getServiceType(s) === type).length;
                return (
                  <button key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedType === type
                        ? "bg-white/15 border border-white/20 text-white"
                        : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {tm.icon} {tm.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* ── Search ────────────────────────────────────────────────── */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder={`البحث في ${selectedPlatform}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 h-10 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-purple-500 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">✕</button>
              )}
            </div>

            {/* ── Services grouped by type ──────────────────────────────── */}
            {filteredServices.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                {search ? `لا توجد نتائج لـ "${search}"` : "لا توجد خدمات في هذا القسم"}
              </div>
            ) : (
              <div className="space-y-6">
                {TYPE_ORDER.filter(type => groupedServices[type]?.length > 0).map(type => {
                  const typeSvcs = groupedServices[type] || [];
                  const tm = TYPE_META[type];
                  return (
                    <div key={type}>
                      {/* Type section header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">{tm.icon}</span>
                        <h3 className={`font-bold text-sm ${tm.color}`}>{tm.label}</h3>
                        <div className="flex-1 h-px bg-white/5" />
                        <Badge className="bg-white/8 text-gray-400 border-none text-xs font-mono">
                          {typeSvcs.length}
                        </Badge>
                      </div>

                      {/* Service rows */}
                      <div className="space-y-1.5">
                        {typeSvcs.map(svc => (
                          <ServiceRow key={svc.id} svc={svc} platformMeta={currentMeta} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredServices.length > 0 && (
              <p className="text-center text-xs text-gray-600 pt-2">
                عرض {filteredServices.length} خدمة من منصة {selectedPlatform}
              </p>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
