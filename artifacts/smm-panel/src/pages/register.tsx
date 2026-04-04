import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Register() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [, setLocation]         = useLocation();
  const { toast }               = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: "destructive", title: "كلمة المرور قصيرة", description: "يجب أن تكون كلمة المرور 6 أحرف على الأقل." });
      return;
    }

    setIsPending(true);
    try {
      // ── Step 1: Create user via API server (uses service_role → email auto-confirmed) ──
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/auth/supabase-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        // Friendly Arabic errors
        let msg: string = json.error || "يرجى المحاولة مرة أخرى";
        if (msg.includes("already registered") || msg.includes("مسجّل مسبقاً"))
          msg = "هذا البريد الإلكتروني مسجّل مسبقاً — جرّب تسجيل الدخول";
        toast({ variant: "destructive", title: "خطأ في إنشاء الحساب", description: msg });
        return;
      }

      // ── Step 2: Sign in immediately (email is auto-confirmed) ──
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

      if (signInData?.session) {
        toast({ title: "🎉 تم إنشاء الحساب بنجاح!", description: "مرحباً بك في Boost Iraq" });
        setLocation("/");
      } else {
        // Account created but sign-in failed (rare edge case)
        const errMsg = signInErr?.message || "";
        if (errMsg.includes("Invalid login credentials")) {
          toast({ title: "✅ تم إنشاء الحساب", description: "يمكنك الآن تسجيل الدخول." });
        } else {
          toast({ title: "✅ تم إنشاء الحساب بنجاح", description: "يمكنك الآن تسجيل الدخول بالبيانات المدخلة." });
        }
        setLocation("/login");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "يرجى المحاولة مرة أخرى";
      toast({ variant: "destructive", title: "خطأ في الاتصال", description: msg });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden" dir="rtl">
      {/* Background blobs */}
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
              <p className="text-xs text-red-400">كلمة المرور قصيرة ({password.length}/6)</p>
            )}
          </div>

          {/* Submit */}
          <button type="submit"
            disabled={isPending || !name.trim() || !email.trim() || password.length < 6}
            className="btn-boost w-full h-12 mt-2">
            {isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />جاري الإنشاء...</span>
              : "إنشاء الحساب"}
          </button>
        </form>

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
