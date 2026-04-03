import { Layout } from "@/components/layout";
import { useGetServices, useGetPlatforms, getGetServicesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, ShoppingCart } from "lucide-react";

export function Services() {
  const [selectedPlatform, setSelectedPlatform] = useState<number | undefined>();
  const [search, setSearch] = useState("");

  const { data: platforms, isLoading: platformsLoading } = useGetPlatforms();
  
  const { data: services, isLoading: servicesLoading } = useGetServices({
    query: {
      queryKey: getGetServicesQueryKey({ platformId: selectedPlatform }),
    },
    request: {
      query: {
        platformId: selectedPlatform,
      }
    }
  } as any);

  const filteredServices = services?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.platformName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">الخدمات</h1>
          <p className="text-gray-400">تصفح جميع الخدمات المتاحة للطلب</p>
        </header>

        <Card className="backdrop-blur-xl bg-white/5 border-white/10 p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="البحث عن خدمة..."
                className="pl-4 pr-10 h-12 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-purple-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              <Button
                variant={selectedPlatform === undefined ? "default" : "outline"}
                className={`rounded-xl whitespace-nowrap ${selectedPlatform === undefined ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-none' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                onClick={() => setSelectedPlatform(undefined)}
              >
                الكل
              </Button>
              {platforms?.map(p => (
                <Button
                  key={p.id}
                  variant={selectedPlatform === p.id ? "default" : "outline"}
                  className={`rounded-xl whitespace-nowrap ${selectedPlatform === p.id ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-none' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                  onClick={() => setSelectedPlatform(p.id)}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-right text-gray-400">الرقم</TableHead>
                  <TableHead className="text-right text-gray-400">المنصة</TableHead>
                  <TableHead className="text-right text-gray-400">الخدمة</TableHead>
                  <TableHead className="text-right text-gray-400">السعر لـ 1000</TableHead>
                  <TableHead className="text-right text-gray-400">أقل / أقصى طلب</TableHead>
                  <TableHead className="text-right text-gray-400"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicesLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="border-white/10">
                      <TableCell><Skeleton className="h-4 w-8 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 bg-white/10" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 bg-white/10 rounded-lg" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredServices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                      لا توجد خدمات متاحة
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices?.map(service => (
                    <TableRow key={service.id} className="border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="font-mono text-gray-400">{service.id}</TableCell>
                      <TableCell className="text-white font-medium">{service.platformName}</TableCell>
                      <TableCell className="text-white">{service.name}</TableCell>
                      <TableCell className="text-purple-400 font-bold font-mono">
                        IQD {service.price}
                      </TableCell>
                      <TableCell className="text-gray-400 font-mono">
                        {service.minOrder} - {service.maxOrder}
                      </TableCell>
                      <TableCell className="text-left">
                        <Link href={`/order?serviceId=${service.id}&platformId=${service.platformId}`}>
                          <Button size="sm" className="bg-white/10 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600 text-white rounded-lg">
                            <ShoppingCart className="w-4 h-4 ml-2" />
                            طلب
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
