import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useSupabaseAuth } from "@/context/AuthContext";

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { supabaseUser, register } = useSupabaseAuth();

  useEffect(() => {
    if (supabaseUser) setLocation("/");
  }, [supabaseUser, setLocation]);

  if (supabaseUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await register(name, email, password);
      const { data } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      if (data.session) {
        toast({ title: "تم إنشاء الحساب بنجاح" });
        setLocation("/");
      } else {
        toast({
          title: "تحقق من بريدك الإلكتروني",
          description: "تم إرسال رابط التأكيد إلى بريدك الإلكتروني. يرجى تأكيد الحساب ثم تسجيل الدخول.",
        });
        setLocation("/login");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "يرجى المحاولة مرة أخرى";
      toast({
        variant: "destructive",
        title: "خطأ في إنشاء الحساب",
        description: msg,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md backdrop-blur-xl bg-white/5 border-white/10 z-10">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-xl mb-2 flex items-center justify-center shadow-lg shadow-purple-500/20" />
          <CardTitle className="text-2xl font-bold text-white">إنشاء حساب جديد</CardTitle>
          <CardDescription className="text-gray-400">انضم إلى منصتنا لزيادة نمو حساباتك</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">الاسم الكامل</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-12"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/5 border-white/10 text-white focus-visible:ring-purple-500 rounded-xl h-12"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "إنشاء حساب"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-gray-400">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 transition-colors">
              تسجيل الدخول
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
