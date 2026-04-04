import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Zap, Shield, Wallet, Smartphone, CheckCircle,
  TrendingUp, Users, Star, ArrowLeft, Lock, Flame
} from "lucide-react";

// ─── Animated counter ───────────────────────────────────────────────────────
function Counter({ to, suffix = "", duration = 2000 }: { to: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(eased * to));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Live activity feed ─────────────────────────────────────────────────────
const ACTIVITIES = [
  "👤 مستخدم من بغداد اشترى 1,000 متابع انستغرام",
  "🔥 طلب جديد: 5,000 مشاهدة يوتيوب — تم التنفيذ ✅",
  "👤 مستخدم من الموصل اشترى 500 لايك تيك توك",
  "⚡ طلب متابعين تيليغرام 2,000 — تسليم فوري",
  "👤 مستخدم من أربيل اشترى 1,500 متابع انستغرام",
  "🔥 طلب جديد: 10,000 مشاهدة يوتيوب — نجح!",
  "👤 مستخدم من البصرة اشترى متابعين تيك توك",
  "⚡ طلب 3,000 لايك فيسبوك — اكتمل بنجاح",
  "👤 مستخدم من كركوك اشترى 2,000 متابع سناب شات",
  "🔥 طلب جديد: 500 تعليق انستغرام — تنفيذ سريع",
];

function LiveFeed() {
  const [items, setItems] = useState(ACTIVITIES.slice(0, 4));
  const [fadeNew, setFadeNew] = useState(false);

  useEffect(() => {
    let index = 4;
    const interval = setInterval(() => {
      setFadeNew(true);
      setTimeout(() => {
        setItems(prev => {
          const next = [...prev.slice(1), ACTIVITIES[index % ACTIVITIES.length]];
          index++;
          return next;
        });
        setFadeNew(false);
      }, 350);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2.5">
      {items.map((text, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
            i === items.length - 1 && fadeNew ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          }`}
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.15)",
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
          <p className="text-slate-300 text-sm flex-1">{text}</p>
          <span className="text-xs text-slate-500 shrink-0">الآن</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Landing Page ──────────────────────────────────────────────────────
export function Landing() {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#0F172A] text-[#E2E8F0] overflow-x-hidden" dir="rtl">

      {/* ── Ambient background glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] rounded-full blur-[140px]"
          style={{ background: "rgba(99,102,241,0.12)" }} />
        <div className="absolute top-[30%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[130px]"
          style={{ background: "rgba(139,92,246,0.08)" }} />
        <div className="absolute bottom-[-5%] right-[20%] w-[40%] h-[40%] rounded-full blur-[120px]"
          style={{ background: "rgba(6,182,212,0.07)" }} />
      </div>

      {/* ══════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════ */}
      <nav className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        navScrolled ? "py-3" : "py-5"
      }`}
        style={{
          background: navScrolled ? "rgba(15,23,42,0.95)" : "transparent",
          backdropFilter: navScrolled ? "blur(20px)" : "none",
          borderBottom: navScrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}>
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
              🚀
            </div>
            <span className="text-lg font-black text-white">Boost Iraq</span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="hidden sm:flex text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-white/5">
              تسجيل الدخول
            </Link>
            <Link href="/register"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              }}>
              ابدأ الآن
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 px-5 text-center overflow-hidden">
        {/* Urgency ticker */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-bold mb-8"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
            animation: "fadeInUp 0.6s ease both",
          }}>
          <Flame className="w-4 h-4 animate-pulse" />
          آلاف المستخدمين يستخدمون المنصة الآن
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6"
          style={{ animation: "fadeInUp 0.7s ease 0.1s both" }}>
          ارفع حسابك
          <br />
          <span style={{
            background: "linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            خلال دقائق 🚀
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto mb-4 leading-relaxed"
          style={{ animation: "fadeInUp 0.7s ease 0.2s both" }}>
          متابعين، لايكات، مشاهدات حقيقية بأسعار رخيصة وبسرعة خيالية
        </p>

        <p className="text-sm text-emerald-400 mb-10 font-semibold"
          style={{ animation: "fadeInUp 0.7s ease 0.3s both" }}>
          ✅ بدون باسورد — آمن 100% — تسليم فوري
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4"
          style={{ animation: "fadeInUp 0.7s ease 0.4s both" }}>
          <Link href="/register"
            className="group relative w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white text-lg font-black transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              boxShadow: "0 8px 40px rgba(99,102,241,0.5), 0 0 0 1px rgba(99,102,241,0.3)",
            }}>
            <span>ابدأ الآن مجاناً</span>
            <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }} />
          </Link>
          <Link href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-slate-300 hover:text-white text-lg font-bold transition-all hover:bg-white/6"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            تسجيل الدخول
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Social proof micro */}
        <div className="flex items-center justify-center gap-1.5 mt-8">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          ))}
          <span className="text-slate-400 text-sm mr-2">+10,000 مستخدم راضٍ في العراق والخليج</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          STATS (Animated counters)
      ══════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { label: "طلب مكتمل",    to: 50000, suffix: "+",  icon: "✅", color: "from-emerald-500/20 to-teal-500/10",     border: "border-emerald-500/20" },
              { label: "مستخدم نشط",    to: 10000, suffix: "+",  icon: "👥", color: "from-indigo-500/20 to-violet-500/10",    border: "border-indigo-500/20" },
              { label: "رضا العملاء",   to: 99,    suffix: "%",  icon: "⭐", color: "from-yellow-500/20 to-orange-500/10",    border: "border-yellow-500/20" },
            ].map((stat, i) => (
              <div key={i}
                className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${stat.color} border ${stat.border} p-7 text-center`}
                style={{ backdropFilter: "blur(12px)" }}>
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-4xl sm:text-5xl font-black text-white font-mono mb-2">
                  <Counter to={stat.to} suffix={stat.suffix} />
                </div>
                <p className="text-slate-400 font-semibold text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">لماذا Boost Iraq؟</h2>
            <p className="text-slate-400 text-lg">الأفضل في العراق والخليج لأسباب قوية</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Zap className="w-7 h-7" />,
                title: "تنفيذ سريع",
                desc: "يبدأ الطلب خلال دقائق من تأكيده — بدون انتظار",
                color: "from-yellow-500/15 to-amber-500/10",
                border: "border-yellow-500/20",
                glow: "rgba(234,179,8,0.2)",
                iconColor: "#FDE047",
              },
              {
                icon: <Shield className="w-7 h-7" />,
                title: "أمان كامل",
                desc: "لا نطلب باسوردك أبداً — حسابك آمن 100%",
                color: "from-emerald-500/15 to-teal-500/10",
                border: "border-emerald-500/20",
                glow: "rgba(34,197,94,0.2)",
                iconColor: "#4ADE80",
              },
              {
                icon: <Wallet className="w-7 h-7" />,
                title: "أسعار رخيصة",
                desc: "أقل الأسعار في السوق العراقي بجودة عالية",
                color: "from-indigo-500/15 to-violet-500/10",
                border: "border-indigo-500/20",
                glow: "rgba(99,102,241,0.2)",
                iconColor: "#818CF8",
              },
              {
                icon: <Smartphone className="w-7 h-7" />,
                title: "كل المنصات",
                desc: "انستغرام، تيك توك، يوتيوب، تيليغرام وأكثر",
                color: "from-cyan-500/15 to-blue-500/10",
                border: "border-cyan-500/20",
                glow: "rgba(6,182,212,0.2)",
                iconColor: "#22D3EE",
              },
            ].map((feat, i) => (
              <div key={i}
                className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${feat.color} border ${feat.border} p-6 cursor-default transition-all duration-300 hover:-translate-y-1`}
                style={{ backdropFilter: "blur(12px)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 50px ${feat.glow}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${feat.glow}`, color: feat.iconColor }}>
                  {feat.icon}
                </div>
                <h3 className="text-white font-black text-lg mb-2">{feat.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          LIVE ACTIVITY
      ══════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ADE80" }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              نشاط مباشر
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">ماذا يشتري المستخدمون الآن؟</h2>
            <p className="text-slate-400">آلاف الطلبات تُنفَّذ يومياً في Boost Iraq</p>
          </div>
          <LiveFeed />
          <div className="text-center mt-8">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold transition-all hover:scale-105 active:scale-95 text-base"
              style={{
                background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                boxShadow: "0 6px 25px rgba(99,102,241,0.35)",
              }}>
              انضم الآن وابدأ طلبك
              <Zap className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">كيف تبدأ؟</h2>
            <p className="text-slate-400 text-lg">ثلاث خطوات بسيطة وأنت جاهز</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "١",
                title: "سجّل حساب",
                desc: "أنشئ حسابك المجاني في ثوانٍ — لا بطاقة مطلوبة",
                icon: <Users className="w-6 h-6" />,
                color: "rgba(99,102,241,0.2)",
                border: "rgba(99,102,241,0.3)",
              },
              {
                step: "٢",
                title: "اشحن رصيدك",
                desc: "ادفع بزين كاش، آسياسيل، أو QiCard بكل سهولة",
                icon: <Wallet className="w-6 h-6" />,
                color: "rgba(139,92,246,0.2)",
                border: "rgba(139,92,246,0.3)",
              },
              {
                step: "٣",
                title: "ابدأ الطلب",
                desc: "اختر خدمتك وشاهد النتائج تصل خلال دقائق",
                icon: <TrendingUp className="w-6 h-6" />,
                color: "rgba(6,182,212,0.2)",
                border: "rgba(6,182,212,0.3)",
              },
            ].map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-0 w-full h-0.5 opacity-20"
                    style={{ background: "linear-gradient(to left, rgba(99,102,241,0.5), transparent)" }} />
                )}
                <div className="relative w-20 h-20 rounded-[24px] flex items-center justify-center mb-5 text-white"
                  style={{
                    background: step.color,
                    border: `2px solid ${step.border}`,
                    boxShadow: `0 10px 30px ${step.color}`,
                  }}>
                  {step.icon}
                  <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white"
                    style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
                    {step.step}
                  </div>
                </div>
                <h3 className="text-white font-black text-xl mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          LOCKED PREVIEW
      ══════════════════════════════════════════════ */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">هذا ينتظرك داخل المنصة</h2>
            <p className="text-slate-400">سجّل الآن لفتح الوصول الكامل لجميع الخدمات</p>
          </div>

          {/* Blurred dashboard preview */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{ border: "1px solid rgba(99,102,241,0.2)" }}>

            {/* Fake dashboard content (blurred) */}
            <div className="select-none pointer-events-none" style={{ filter: "blur(6px)", opacity: 0.4 }}>
              <div className="p-6" style={{ background: "rgba(15,23,42,0.9)" }}>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {["الرصيد المتاح", "إجمالي الطلبات", "مكتملة"].map((label, i) => (
                    <div key={i} className="rounded-2xl p-4 text-center"
                      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <p className="text-slate-400 text-xs mb-1">{label}</p>
                      <p className="text-white font-mono font-black text-xl">
                        {i === 0 ? "150,000" : i === 1 ? "47" : "45"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="rounded-xl p-3 flex items-center justify-between gap-3"
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="w-32 h-3 rounded-full bg-white/10" />
                      <div className="w-20 h-3 rounded-full bg-indigo-500/30" />
                      <div className="w-16 h-3 rounded-full bg-white/10" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6"
              style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))",
                  border: "1px solid rgba(99,102,241,0.4)",
                }}>
                <Lock className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-white text-2xl font-black mb-2">سجّل الآن لفتح جميع الخدمات</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-xs">
                انضم مجاناً وابدأ رحلتك نحو النمو الحقيقي على السوشيال ميديا
              </p>
              <Link href="/register"
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-black text-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  boxShadow: "0 8px 30px rgba(99,102,241,0.5)",
                }}>
                إنشاء حساب الآن 🔥
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          PLATFORMS
      ══════════════════════════════════════════════ */}
      <section className="py-10 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500 text-sm mb-5 uppercase tracking-widest font-bold">المنصات المدعومة</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { name: "انستغرام", icon: "📸", color: "rgba(236,72,153,0.1)", border: "rgba(236,72,153,0.2)" },
              { name: "تيك توك",  icon: "🎵", color: "rgba(6,182,212,0.1)",  border: "rgba(6,182,212,0.2)"  },
              { name: "يوتيوب",   icon: "▶️", color: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)"  },
              { name: "تيليغرام", icon: "✈️", color: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
              { name: "فيسبوك",   icon: "👤", color: "rgba(37,99,235,0.1)",  border: "rgba(37,99,235,0.2)"  },
              { name: "سناب شات", icon: "👻", color: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.2)"  },
              { name: "تويتر",    icon: "𝕏",  color: "rgba(100,116,139,0.1)",border: "rgba(100,116,139,0.2)"},
              { name: "سبوتيفاي", icon: "🎧", color: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)"  },
            ].map((p, i) => (
              <div key={i}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-300"
                style={{ background: p.color, border: `1px solid ${p.border}` }}>
                <span>{p.icon}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section className="py-24 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-[40px] overflow-hidden text-center p-10 sm:p-16"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.2) 50%, rgba(6,182,212,0.15) 100%)",
              border: "1px solid rgba(99,102,241,0.25)",
              boxShadow: "0 40px 100px rgba(99,102,241,0.2)",
            }}>

            {/* Decorative circles */}
            <div className="absolute top-[-30%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] pointer-events-none"
              style={{ background: "rgba(99,102,241,0.2)" }} />
            <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[70px] pointer-events-none"
              style={{ background: "rgba(6,182,212,0.15)" }} />

            <div className="relative">
              <div className="text-5xl mb-5">🚀</div>
              <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight">
                لا تضيع الفرصة
                <br />
                <span style={{
                  background: "linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  ابدأ اليوم مجاناً
                </span>
              </h2>
              <p className="text-slate-300 text-lg mb-10 max-w-md mx-auto leading-relaxed">
                انضم لأكثر من 10,000 مستخدم يثقون في Boost Iraq لتنمية حساباتهم
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register"
                  className="group relative w-full sm:w-auto flex items-center justify-center gap-2.5 px-10 py-4 rounded-2xl text-white text-xl font-black transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                    boxShadow: "0 8px 40px rgba(99,102,241,0.6), 0 0 0 1px rgba(99,102,241,0.4)",
                  }}>
                  ابدأ الآن 🔥
                  <span className="absolute inset-0 rounded-2xl animate-ping opacity-15"
                    style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }} />
                </Link>
                <Link href="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-slate-300 hover:text-white text-lg font-bold transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  لدي حساب بالفعل
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center justify-center gap-5 mt-8 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" />مجاني 100%</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" />لا بطاقة مطلوبة</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" />آمن تماماً</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" />دعم عربي</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-5 text-center text-slate-600 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span>🚀</span>
          <span className="font-bold text-slate-500">Boost Iraq</span>
        </div>
        <p>© 2026 جميع الحقوق محفوظة — أفضل خدمات السوشيال ميديا في العراق والخليج</p>
      </footer>

    </div>
  );
}
