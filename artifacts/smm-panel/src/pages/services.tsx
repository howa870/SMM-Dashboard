import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ShoppingCart, Globe, Database, RefreshCw } from "lucide-react";
import { usePlatforms, useServices } from "@/hooks/useServicesData";
import { getFollowizServices, type FollowizService } from "@/lib/smm";

// ─── TABS ─────────────────────────────────────────────────────────────────────
type Tab = "local" | "provider";

export function Services() {
  const [tab, setTab] = useState<Tab>("provider");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [selectedPlatformId, setSelectedPlatformId] = useState<number | undefined>();

  // Local Supabase services
  const { data: platforms, isLoading: platformsLoading } = usePlatforms();
  const { data: localServices, isLoading: localLoading } = useServices(selectedPlatformId);

  // Followiz services from backend
  const { data: providerServices, isLoading: providerLoading, error: providerError, refetch } = useQuery({
    queryKey: ["smm", "followiz-services"],
    queryFn: getFollowizServices,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Filter local services
  const filteredLocal = localServices?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.platforms?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  // Extract unique categories from Followiz services
  const categories = useMemo(() => {
    if (!providerServices) return [];
    const cats = new Set(providerServices.map(s => s.category));
    return ["الكل", ...Array.from(cats)];
  }, [providerServices]);

  // Filter Followiz services
  const filteredProvider = useMemo(() => {
    if (!providerServices) return [];
    return providerServices.filter(s => {
      const matchesSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === "الكل" || s.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [providerServices, search, selectedCategory]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">الخدمات</h1>
          <p className="text-gray-400">تصفح جميع الخدمات المتاحة للطلب</p>
        </header>

        {/* Tab switcher */}
        <div className="flex gap-3">
          <button
            onClick={() => setTab("provider")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${
              tab === "provider"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20"
                : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4" />
            خدمات المزود
            {providerServices && (
              <Badge className="bg-white/20 text-white text-xs px-1.5 py-0.5 mr-1">
                {providerServices.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setTab("local")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${
              tab === "local"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20"
                : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Database className="w-4 h-4" />
            خدماتنا
          </button>
        </div>

        <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-6">

          {/* ── Search bar ── */}
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

            {/* Category/Platform filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {tab === "provider" ? (
                // Followiz category filter
                categories.map(cat => (
                  <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"}
                    className={`rounded-xl whitespace-nowrap text-xs ${selectedCategory === cat
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 border-none"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"}`}
                    onClick={() => setSelectedCategory(cat)}>
                    {cat}
                  </Button>
                ))
              ) : (
                // Local platform filter
                <>
                  <Button variant={!selectedPlatformId ? "default" : "outline"}
                    className={`rounded-xl whitespace-nowrap ${!selectedPlatformId
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 border-none"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"}`}
                    onClick={() => setSelectedPlatformId(undefined)}>
                    الكل
                  </Button>
                  {platformsLoading
                    ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-24 rounded-xl bg-white/10" />)
                    : platforms?.map(p => (
                      <Button key={p.id} variant={selectedPlatformId === p.id ? "default" : "outline"}
                        className={`rounded-xl whitespace-nowrap ${selectedPlatformId === p.id
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 border-none"
                          : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"}`}
                        onClick={() => setSelectedPlatformId(p.id)}>
                        {p.name}
                      </Button>
                    ))}
                </>
              )}
            </div>
          </div>

          {/* ── PROVIDER SERVICES TABLE ── */}
          {tab === "provider" && (
            <>
              {providerError && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                  <p className="text-red-400 text-sm">تعذر تحميل خدمات المزود</p>
                  <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                    <RefreshCw className="w-3 h-3" />إعادة المحاولة
                  </button>
                </div>
              )}
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-right text-gray-400 w-16">#</TableHead>
                      <TableHead className="text-right text-gray-400">الفئة</TableHead>
                      <TableHead className="text-right text-gray-400">الخدمة</TableHead>
                      <TableHead className="text-right text-gray-400">السعر/1000</TableHead>
                      <TableHead className="text-right text-gray-400">أقل / أقصى</TableHead>
                      <TableHead className="text-right text-gray-400"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerLoading ? (
                      [...Array(8)].map((_, i) => (
                        <TableRow key={i} className="border-white/10">
                          {[...Array(6)].map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full bg-white/10" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredProvider.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                          لا توجد خدمات{search ? " تطابق البحث" : ""}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProvider.map((svc: FollowizService) => (
                        <TableRow key={svc.service} className="border-white/10 hover:bg-white/5 transition-colors">
                          <TableCell className="font-mono text-gray-500 text-xs">{svc.service}</TableCell>
                          <TableCell>
                            <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md">
                              {svc.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-white text-sm max-w-[260px]">
                            <span className="line-clamp-2">{svc.name}</span>
                          </TableCell>
                          <TableCell className="font-bold font-mono text-purple-400 text-sm whitespace-nowrap">
                            ${Number(svc.rate).toFixed(3)}
                          </TableCell>
                          <TableCell className="text-gray-400 font-mono text-xs whitespace-nowrap">
                            {Number(svc.min).toLocaleString()} - {Number(svc.max).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Link href={`/order?provider=1&pid=${svc.service}&prate=${svc.rate}&pmin=${svc.min}&pmax=${svc.max}&pname=${encodeURIComponent(svc.name)}`}>
                              <Button size="sm" className="bg-white/10 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600 text-white rounded-lg text-xs whitespace-nowrap">
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
              {filteredProvider.length > 0 && (
                <p className="text-xs text-gray-600 mt-3 text-center">
                  عرض {filteredProvider.length} خدمة من أصل {providerServices?.length || 0}
                </p>
              )}
            </>
          )}

          {/* ── LOCAL SERVICES TABLE ── */}
          {tab === "local" && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-right text-gray-400">الرقم</TableHead>
                    <TableHead className="text-right text-gray-400">المنصة</TableHead>
                    <TableHead className="text-right text-gray-400">الخدمة</TableHead>
                    <TableHead className="text-right text-gray-400">السعر لـ 1000</TableHead>
                    <TableHead className="text-right text-gray-400">أقل / أقصى</TableHead>
                    <TableHead className="text-right text-gray-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localLoading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={i} className="border-white/10">
                        {[...Array(6)].map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full bg-white/10" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredLocal?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                        لا توجد خدمات متاحة
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLocal?.map(service => (
                      <TableRow key={service.id} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-gray-400">{service.id}</TableCell>
                        <TableCell className="text-white font-medium">{service.platforms?.name || "—"}</TableCell>
                        <TableCell className="text-white">{service.name}</TableCell>
                        <TableCell className="text-purple-400 font-bold font-mono">IQD {service.price}</TableCell>
                        <TableCell className="text-gray-400 font-mono">{service.min_order} - {service.max_order}</TableCell>
                        <TableCell>
                          <Link href={`/order?serviceId=${service.id}&platformId=${service.platform_id}`}>
                            <Button size="sm" className="bg-white/10 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600 text-white rounded-lg">
                              <ShoppingCart className="w-4 h-4 ml-2" />طلب
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
