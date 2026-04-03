import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function requireSupabaseAuth(req: import("express").Request, res: import("express").Response): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح" });
    return null;
  }
  return auth.slice(7);
}

async function getUserId(token: string): Promise<string | null> {
  if (!db) return null;
  const { data } = await db.auth.getUser(token);
  return data?.user?.id ?? null;
}

function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET /api/referrals/my — get my referral code, stats
router.get("/my", async (req, res) => {
  if (!db) { res.status(503).json({ error: "قاعدة البيانات غير متاحة" }); return; }
  const token = requireSupabaseAuth(req, res);
  if (!token) return;
  const userId = await getUserId(token);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }

  // Get or generate referral code
  let { data: profile, error: profErr } = await db.from("profiles").select("referral_code, balance, name, email").eq("id", userId).maybeSingle();
  if (profErr || !profile) { res.status(500).json({ error: "فشل تحميل الملف الشخصي" }); return; }

  if (!profile.referral_code) {
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { error: updateErr } = await db.from("profiles").update({ referral_code: code }).eq("id", userId);
      if (!updateErr) { profile = { ...profile, referral_code: code }; break; }
      if (updateErr.message.includes("unique") || updateErr.message.includes("duplicate")) {
        code = generateCode(); attempts++;
      } else {
        break;
      }
    }
  }

  // Count referred users
  const { count: referredCount } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("referrer_id", userId);

  // Total referral earnings
  const { data: earnings } = await db.from("referral_earnings").select("amount").eq("user_id", userId);
  const totalEarnings = (earnings || []).reduce((sum, r) => sum + Number(r.amount), 0);

  // Recent earnings (last 10)
  const { data: recentEarnings } = await db.from("referral_earnings")
    .select("id, amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  res.json({
    referral_code: profile.referral_code || null,
    referred_count: referredCount || 0,
    total_earnings: totalEarnings,
    recent_earnings: recentEarnings || [],
  });
});

// POST /api/referrals/apply — apply a referral code for current user
router.post("/apply", async (req, res) => {
  if (!db) { res.status(503).json({ error: "قاعدة البيانات غير متاحة" }); return; }
  const token = requireSupabaseAuth(req, res);
  if (!token) return;
  const userId = await getUserId(token);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") { res.status(400).json({ error: "الرمز مطلوب" }); return; }

  // Check if already has a referrer
  const { data: profile } = await db.from("profiles").select("referrer_id").eq("id", userId).maybeSingle();
  if (profile?.referrer_id) { res.status(400).json({ error: "لديك مُحيل بالفعل" }); return; }

  // Find referrer by code
  const { data: referrer } = await db.from("profiles").select("id").eq("referral_code", code.toUpperCase()).maybeSingle();
  if (!referrer) { res.status(404).json({ error: "رمز الإحالة غير صحيح" }); return; }
  if (referrer.id === userId) { res.status(400).json({ error: "لا يمكنك استخدام رمزك الخاص" }); return; }

  // Save referrer_id
  const { error: updErr } = await db.from("profiles").update({ referrer_id: referrer.id }).eq("id", userId);
  if (updErr) { res.status(500).json({ error: "فشل تطبيق رمز الإحالة" }); return; }

  // Record in referrals table (best effort)
  await db.from("referrals").insert({ user_id: userId, referrer_id: referrer.id })
    .then(r => { if (r.error) console.warn("[Ref] referrals insert:", r.error.message); });

  res.json({ ok: true, message: "تم تطبيق رمز الإحالة بنجاح" });
});

export default router;
