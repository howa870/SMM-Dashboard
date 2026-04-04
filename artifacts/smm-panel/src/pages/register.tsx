import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useSupabaseAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export function Register() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [, setLocation]         = useLocation();
  const { toast }               = useToast();
  const { register }            = useSupabaseAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ variant: "destructive", title: "كلمة المرور قصيرة", description: "يجب أن تكون كلمة المرور 6 أحرف على الأقل." });
      return;
    }

    setIsPending(true);
    try {
      // 1 — Create the account in Supabase Auth
      await register(name, email, password);

      // 2 — Try immediate sign-in (works when email confirmation is OFF)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInData?.session) {
        // Email confirmation is disabled — user is logged in directly ✅
        toast({ title: "🎉 تم إنشاء الحساب بنجاح!", description: "مرحباً بك في Boost Iraq" });
        setLocation("/");
        return;
      }

      // 3 — No session → email confirmation is required OR other issue
      const confirmationNeeded = signInError?.message?.toLowerCase().includes("email") ||
                                 signInError?.message?.toLowerCase().includes("confirm") ||
                                 signInError?.message?.toLowerCase().includes("not confirmed");

      if (confirmationNeeded) {
        toast({
          title: "📧 تحقق من بريدك الإلكتروني",
          description: "تم إرسال رابط التأكيد. انقر عليه ثم ارجع لتسجيل الدخول.",
        });
      } else {
        toast({
          title: "✅ تم إنشاء الحساب",
          description: "الآن سجّل دخولك باستخدام بيانات حسابك.",
        });
      }
      setLocation("/login");

    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);

      // Friendly Arabic error messages
      let arabicMsg = raw;
      if (raw.includes("already registered") || raw.includes("already been registered"))
        arabicMsg = "هذا البريد الإلكتروني مسجّل مسبقاً. جرّب تسجيل الدخول.";
      else if (raw.includes("invalid email") || raw.includes("Invalid email"))
        arabicMsg = "البريد الإلكتروني غير صالح.";
      else if (raw.includes("Password"))
        arabicMsg = "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
      else if (raw.includes("rate limit") || raw.includes("too many"))
        arabicMsg = "تم إرسال طلبات كثيرة. انتظر دقيقة وحاول مجدداً.";

      toast({ variant: "destructive", title: "خطأ في إنشاء الحساب", description: arabicMsg });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden" dir="rtl">
      {/* Blobs */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(108,92,231,0.15)" }} />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(0,184,148,0.1)" }} />

      <div className="glass-card w-full max-w-md p-8 z-10 page-enter">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-[18px] bg-boost-gradient mx-auto mb-4 flex items-center justify-center shadow-lg text-2xl"
            style={{ boxShadow: "0 8px 25px rgba(108,92,231,0.4)" }}>
            🚀
          </div>
          <h1 className="text-2xl font-black text-white">إنشاء حساب جديد</h1>
          <p className="text-slate-400 text-sm mt-1">انضم إلى Boost Iraq وابدأ رحلة النمو</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">الاسم الكامل</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required
              placeholder="أدخل اسمك الكامل"
              className="h-12 rounded-[14px] bg-white/6 border-white/10 text-white placeholder:text-slate-500" />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">البريد الإلكتروني</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="example@email.com"
              className="h-12 rounded-[14px] bg-white/6 border-white/10 text-white placeholder:text-slate-500"
              dir="ltr" />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm font-medium">كلمة المرور</Label>
            <div className="relative">
              <Input type={showPw ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6}
                placeholder="6 أحرف على الأقل"
                className="h-12 rounded-[14px] bg-white/6 border-white/10 text-white placeholder:text-slate-500 pl-10"
                dir="ltr" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-red-400">كلمة المرور قصيرة جداً ({password.length}/6)</p>
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={isPending || !name || !email || password.length < 6}
            className="btn-boost w-full h-12 mt-2">
            {isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />جاري الإنشاء...</span>
              : "إنشاء الحساب"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-slate-500">أو</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <p className="text-center text-sm text-slate-400">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
