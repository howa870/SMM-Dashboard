import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings, Save, RefreshCw, Phone, CreditCard, Smartphone } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { getPaymentSettings, updatePaymentSetting } from "@/lib/supabase-db";

const FIELD_META: Record<string, { label: string; icon: React.ReactNode; placeholder: string; hint: string }> = {
  zain: {
    label: "رقم زين كاش",
    icon: <Phone className="w-4 h-4 text-green-400" />,
    placeholder: "07881457896",
    hint: "رقم الهاتف المسجّل في زين كاش",
  },
  asiacell: {
    label: "رقم آسياسيل",
    icon: <Smartphone className="w-4 h-4 text-blue-400" />,
    placeholder: "07769079777",
    hint: "رقم الهاتف المسجّل في آسياسيل",
  },
  qicard: {
    label: "رقم QiCard",
    icon: <CreditCard className="w-4 h-4 text-yellow-400" />,
    placeholder: "1234021689",
    hint: "رقم بطاقة QiCard",
  },
};

const FIELD_ORDER = ["zain", "asiacell", "qicard"];

export function AdminSettings() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect non-admins
  useEffect(() => {
    if (!profileLoading && profile && profile.role !== "admin") setLocation("/");
  }, [profile, profileLoading, setLocation]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["supabase", "payment_settings"],
    queryFn: getPaymentSettings,
  });

  // Local editable state — initialized from DB
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      settings.forEach(s => { map[s.key] = s.value; });
      setValues(map);
    }
  }, [settings]);

  const { mutateAsync: save } = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await updatePaymentSetting(key, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "payment_settings"] });
    },
  });

  const handleSave = async (key: string) => {
    const value = values[key]?.trim();
    if (!value) { toast({ variant: "destructive", title: "لا يمكن حفظ قيمة فارغة" }); return; }
    setSavingKey(key);
    try {
      await save({ key, value });
      toast({ title: "✅ تم الحفظ", description: `تم تحديث ${FIELD_META[key]?.label || key} بنجاح.` });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingKey("all");
    try {
      await Promise.all(FIELD_ORDER.map(key => save({ key, value: values[key]?.trim() || "" })));
      toast({ title: "✅ تم حفظ جميع الأرقام بنجاح" });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setSavingKey(null);
    }
  };

  const lastUpdated = settings?.reduce((latest, s) => {
    return s.updated_at > latest ? s.updated_at : latest;
  }, "");

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Settings className="w-8 h-8 text-purple-400" />
              إعدادات الدفع
            </h1>
            <p className="text-gray-400">تعديل أرقام طرق الدفع المعروضة للمستخدمين</p>
            {lastUpdated && (
              <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                آخر تحديث: {new Date(lastUpdated).toLocaleString("ar-IQ")}
              </p>
            )}
          </div>
        </header>

        {/* Telegram hint */}
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
          <p className="text-blue-300 text-sm">
            💡 يمكنك أيضاً تعديل الأرقام مباشرةً من Telegram بإرسال الأمر:
          </p>
          <code className="block font-mono text-xs text-white bg-white/5 rounded-lg px-3 py-2 mt-2 text-left" dir="ltr">
            /setnumbers [رقم_زين] [رقم_آسياسيل] [رقم_qicard]
          </code>
          <p className="text-xs text-gray-500 mt-1">مثال: /setnumbers 07881457896 07769079777 1234021689</p>
        </div>

        {/* Settings Form */}
        <Card className="backdrop-blur-xl bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">أرقام طرق الدفع</CardTitle>
            <CardDescription className="text-gray-400">
              تُعرض هذه الأرقام للمستخدمين في صفحة المحفظة عند اختيار طريقة الدفع
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {FIELD_ORDER.map(k => <div key={k} className="h-20 bg-white/5 animate-pulse rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {FIELD_ORDER.map(key => {
                  const meta = FIELD_META[key];
                  if (!meta) return null;
                  const isSaving = savingKey === key || savingKey === "all";
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-gray-300 flex items-center gap-2">
                        {meta.icon}
                        {meta.label}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={values[key] || ""}
                          onChange={e => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-11 font-mono flex-1"
                          dir="ltr"
                          placeholder={meta.placeholder}
                        />
                        <Button
                          onClick={() => handleSave(key)}
                          disabled={isSaving}
                          className="bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 rounded-xl px-4 shrink-0"
                          variant="outline"
                          size="sm">
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">{meta.hint}</p>
                    </div>
                  );
                })}

                {/* Save All */}
                <div className="pt-2 border-t border-white/10">
                  <Button
                    onClick={handleSaveAll}
                    disabled={savingKey !== null}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold">
                    {savingKey === "all"
                      ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />جاري الحفظ...</>
                      : <><Save className="w-4 h-4 ml-2" />حفظ جميع الأرقام</>}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current values preview */}
        {!isLoading && settings && settings.length > 0 && (
          <Card className="backdrop-blur-xl bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">معاينة الأرقام الحالية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {settings.map(s => (
                  <div key={s.key} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-gray-400 text-sm">{FIELD_META[s.key]?.label || s.key}</span>
                    <code className="font-mono text-white text-sm" dir="ltr">{s.value}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
