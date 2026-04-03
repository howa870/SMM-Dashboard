import { Layout } from "@/components/layout";
import { useGetPlatforms, useGetServices, useCreateOrder, getGetServicesQueryKey } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, Calculator } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function NewOrder() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const defaultPlatformId = searchParams.get("platformId");
  const defaultServiceId = searchParams.get("serviceId");

  const [platformId, setPlatformId] = useState<string>(defaultPlatformId || "");
  const [serviceId, setServiceId] = useState<string>(defaultServiceId || "");
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: platforms, isLoading: platformsLoading } = useGetPlatforms();
  
  const { data: services, isLoading: servicesLoading } = useGetServices({
    query: {
      queryKey: getGetServicesQueryKey({ platformId: Number(platformId) }),
      enabled: !!platformId,
    },
    request: {
      query: { platformId: Number(platformId) }
    }
  } as any);

  const selectedService = services?.find(s => s.id.toString() === serviceId);

  const { mutate: createOrder, isPending } = useCreateOrder();

  const totalPrice = selectedService && quantity 
    ? (Number(quantity) * (selectedService.price / 1000))
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !link || !quantity) return;

    if (selectedService) {
      if (Number(quantity) < selectedService.minOrder) {
        toast({ variant: "destructive", title: "خطأ", description: `أقل كمية هي ${selectedService.minOrder}` });
        return;
      }
      if (Number(quantity) > selectedService.maxOrder) {
        toast({ variant: "destructive", title: "خطأ", description: `أقصى كمية هي ${selectedService.maxOrder}` });
        return;
      }
    }

    createOrder({
      data: {
        serviceId: Number(serviceId),
        link,
        quantity: Number(quantity)
      }
    }, {
      onSuccess: () => {
        toast({ title: "تم إنشاء الطلب بنجاح" });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        setLocation("/orders");
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "خطأ في إنشاء الطلب", description: error.error || "تأكد من رصيدك" });
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">طلب جديد</h1>
          <p className="text-gray-400">قم بإنشاء طلب جديد لاي منصة ترغب بها</p>
        </header>

        <Card className="backdrop-blur-xl bg-white/5 border-white/10">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <Label className="text-gray-300">المنصة</Label>
                <Select value={platformId} onValueChange={(val) => { setPlatformId(val); setServiceId(""); }}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-12" dir="rtl">
                    <SelectValue placeholder="اختر المنصة" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                    {platforms?.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">الخدمة</Label>
                <Select value={serviceId} onValueChange={setServiceId} disabled={!platformId || servicesLoading}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-12" dir="rtl">
                    <SelectValue placeholder="اختر الخدمة" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111122] border-white/10 text-white" dir="rtl">
                    {services?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.id} - {s.name} (IQD {s.price} لكل 1000)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-200">
                  <p className="mb-1"><span className="font-semibold text-blue-400">الوصف:</span> {selectedService.description}</p>
                  <p><span className="font-semibold text-blue-400">أقل/أقصى طلب:</span> {selectedService.minOrder} - {selectedService.maxOrder}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-gray-300">الرابط (Link)</Label>
                <div className="relative">
                  <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    required
                    placeholder="https://..."
                    className="pl-4 pr-10 h-12 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">الكمية</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={selectedService?.minOrder || 1}
                  max={selectedService?.maxOrder}
                  placeholder="1000"
                  className="h-12 bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl"
                  dir="ltr"
                />
              </div>

              <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">التكلفة الإجمالية</p>
                      <p className="text-2xl font-bold text-white">
                        IQD {totalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20 font-bold text-lg"
                disabled={isPending || !serviceId || !link || !quantity}
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "تأكيد الطلب"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
