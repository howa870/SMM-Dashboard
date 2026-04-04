import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useSupabaseAuth } from "@/context/AuthContext";

export function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [, setLocation]         = useLocation();
  const { toast }               = useToast();
  const { supabaseUser, login } = useSupabaseAuth();

  useEffect(() => {
    if (supabaseUser) setLocation("/");
  }, [supabaseUser, setLocation]);

  if (supabaseUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await login(email, password);
      toast({ title: "✅ تم تسجيل الدخول بنجاح", description: "مرحباً بك في Boost Iraq" });
      setLocation("/");
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : "تأكد من البريد الإلكتروني وكلمة المرور";
      if (msg.toLowerCase().includes("invalid login credentials") || msg.includes("Invalid"))
        msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
      toast({ variant: "destructive", title: "خطأ في تسجيل الدخول", description: msg });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden" dir="rtl">
      {/* Background blobs */}
      <div className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full blur-[130px] pointer-events-none"
        style={{ background: "rgba(99,102,241,0.14)" }} />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[110px] pointer-events-none"
        style={{ background: "rgba(6,182,212,0.08)" }} />
      <div className="absolute top-[40%] left-[30%] w-[35%] h-[35%] rounded-full blur-[100px] pointer-events-none"
        style={{ background: "rgba(139,92,246,0.07)" }} />

      <div className="w-full max-w-[420px] z-10 page-enter">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-[22px] mx-auto mb-4 flex items-center justify-center text-3xl shadow-xl"
            style={{
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              boxShadow: "0 10px 30px rgba(99,102,241,0.4)"
            }}>
            🚀
          </div>
          <h1 className="text-3xl font-black text-white mb-1">مرحباً بك</h1>
          <p className="text-slate-400 text-sm">سجّل دخولك إلى Boost Iraq</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm font-semibold">البريد الإلكتروني</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="example@gmail.com"
                dir="ltr"
                className="h-12 rounded-[14px] text-white placeholder:text-slate-600"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm font-semibold">كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  dir="ltr"
                  className="h-12 rounded-[14px] text-white placeholder:text-slate-600 pl-11"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || !email || !password}
              className="btn-boost w-full h-12 text-base mt-2"
            >
              {isPending
                ? <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الدخول...
                  </span>
                : "تسجيل الدخول"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs text-slate-500">أو</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          <p className="text-center text-sm text-slate-400">
            ليس لديك حساب؟{" "}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
              إنشاء حساب مجاني
            </Link>
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            آمن 100%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            تسليم فوري
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            دعم عربي
          </span>
        </div>
      </div>
    </div>
  );
}
