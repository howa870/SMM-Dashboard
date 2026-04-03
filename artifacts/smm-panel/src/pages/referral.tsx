import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Copy, Check, Gift, TrendingUp, Share2, Star } from "lucide-react";
import { format } from "date-fns";
import { useSupabaseAuth } from "@/context/AuthContext";

interface ReferralStats {
  referral_code: string | null;
  referred_count: number;
  total_earnings: number;
  recent_earnings: { id: number; amount: number; created_at: string }[];
}

async function fetchReferralStats(token: string): Promise<ReferralStats> {
  const res = await fetch("/api/referrals/my", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("فشل تحميل بيانات الإحالة");
  return res.json();
}

export function Referral() {
  const { session } = useSupabaseAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<ReferralStats>({
    queryKey: ["referral", "my", session?.access_token],
    queryFn: () => fetchReferralStats(session!.access_token),
    enabled: !!session?.access_token,
    staleTime: 30 * 1000,
  });

  const referralLink = data?.referral_code
    ? `${window.location.origin}/#/register?ref=${data.referral_code}`
    : null;

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopied(true);
    toast({ title: "✅ تم نسخ رابط الإحالة" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!data?.referral_code) return;
    navigator.clipboard.writeText(data.referral_code).catch(() => {});
    setCopied(true);
    toast({ title: "✅ تم نسخ رمز الإحالة" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">نظام الإحالة</h1>
          <p className="text-gray-400">ادعُ أصدقاءك واكسب عمولة 5% من كل شحن يقومون به</p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : error ? (
          <Card className="bg-red-500/10 border-red-500/20">
            <CardContent className="p-6 text-center text-red-400">فشل تحميل بيانات الإحالة</CardContent>
          </Card>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30">
                <CardContent className="p-5 text-center">
                  <Users className="w-7 h-7 text-purple-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white font-mono">{data?.referred_count ?? 0}</p>
                  <p className="text-gray-400 text-sm mt-1">مستخدم تمت إحالته</p>
                </CardContent>
              </Card>
              <Card className="backdrop-blur-xl bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/30">
                <CardContent className="p-5 text-center">
                  <TrendingUp className="w-7 h-7 text-green-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white font-mono">{(data?.total_earnings ?? 0).toLocaleString()}</p>
                  <p className="text-gray-400 text-sm mt-1">IQD مكتسب من الإحالات</p>
                </CardContent>
              </Card>
              <Card className="backdrop-blur-xl bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-yellow-500/30">
                <CardContent className="p-5 text-center">
                  <Star className="w-7 h-7 text-yellow-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white font-mono">5%</p>
                  <p className="text-gray-400 text-sm mt-1">عمولة لكل شحن</p>
                </CardContent>
              </Card>
            </div>

            {/* Referral Code + Link */}
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-400" />
                  رمز ورابط الإحالة
                </CardTitle>
                <CardDescription className="text-gray-400">شارك هذا الرمز أو الرابط مع أصدقائك</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Referral Code */}
                <div>
                  <p className="text-gray-400 text-sm mb-2">رمز الإحالة الخاص بك</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-2xl text-white bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3 text-center tracking-widest" dir="ltr">
                      {data?.referral_code || <span className="text-gray-500 text-base">جاري التحميل...</span>}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopyCode}
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 h-14 w-14 rounded-xl">
                      {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {/* Referral Link */}
                <div>
                  <p className="text-gray-400 text-sm mb-2">رابط الإحالة</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-3 truncate" dir="ltr">
                      {referralLink || "—"}
                    </div>
                    <Button onClick={handleCopyLink}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl px-4 shrink-0">
                      <Copy className="w-4 h-4 ml-2" /> نسخ
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-yellow-400" />
                  كيف يعمل نظام الإحالة؟
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: "1", title: "شارك الرمز", desc: "شارك رمزك أو رابط الإحالة مع أصدقائك" },
                    { step: "2", title: "يسجل صديقك", desc: "يقوم صديقك بإنشاء حساب باستخدام رمزك" },
                    { step: "3", title: "تكسب العمولة", desc: "تحصل تلقائياً على 5% من كل مبلغ يشحنه صديقك في محفظته" },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-gray-400 text-sm mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bonus tiers */}
            <Card className="backdrop-blur-xl bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-green-400" />
                  مكافآت الشحن
                </CardTitle>
                <CardDescription className="text-gray-400">احصل على مكافأة إضافية عند شحن رصيدك</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { range: "10,000 – 19,999 IQD", bonus: "+10%", color: "from-blue-600/20 to-cyan-600/20 border-blue-500/30", badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                    { range: "20,000 – 49,999 IQD", bonus: "+15%", color: "from-purple-600/20 to-pink-600/20 border-purple-500/30", badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
                    { range: "50,000+ IQD", bonus: "+20%", color: "from-yellow-600/20 to-orange-600/20 border-yellow-500/30", badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
                  ].map(tier => (
                    <div key={tier.range} className={`p-4 rounded-xl bg-gradient-to-br ${tier.color} border text-center`}>
                      <Badge variant="outline" className={`${tier.badgeColor} text-lg font-bold px-3 py-1 mb-2`}>{tier.bonus}</Badge>
                      <p className="text-white text-sm font-mono">{tier.range}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent earnings */}
            {(data?.recent_earnings?.length ?? 0) > 0 && (
              <Card className="backdrop-blur-xl bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    آخر العمولات المكتسبة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data!.recent_earnings.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-mono font-bold">+{Number(e.amount).toLocaleString()} IQD</p>
                            <p className="text-gray-500 text-xs font-mono" dir="ltr">{format(new Date(e.created_at), "yyyy/MM/dd HH:mm")}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">عمولة إحالة</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
