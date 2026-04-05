import { setCors, supabaseAdmin } from "../_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "الاسم والبريد وكلمة المرور مطلوبة" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "إعدادات Supabase غير مكتملة (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) {
      console.error("[auth/register] Supabase error:", error.message);
      const msg = (error.message.includes("already") || error.message.includes("registered"))
        ? "هذا البريد الإلكتروني مسجّل مسبقاً"
        : error.message;
      return res.status(400).json({ error: msg });
    }

    res.status(201).json({ success: true, userId: data.user?.id });

  } catch (err) {
    console.error("[auth/register] unexpected:", err.message);
    res.status(500).json({ error: err.message ?? "خطأ في إنشاء الحساب" });
  }
}
