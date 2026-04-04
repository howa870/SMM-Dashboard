// Vercel Serverless Function
// POST /api/auth/supabase-register
// Creates a Supabase user with email auto-confirmed (no email verification required)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "الاسم والبريد وكلمة المرور مطلوبة" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "إعدادات الخادم غير مكتملة" });
  }

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = (data.msg || data.message || data.error || "خطأ في إنشاء الحساب")
        .replace("User already registered", "هذا البريد الإلكتروني مسجّل مسبقاً");
      return res.status(resp.status >= 500 ? 500 : 400).json({ error: msg });
    }

    return res.status(201).json({ success: true, userId: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || "خطأ في الخادم" });
  }
}
