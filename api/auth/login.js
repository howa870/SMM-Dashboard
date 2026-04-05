import { setCors, SUPABASE_URL, ANON_KEY } from "../_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "البريد وكلمة المرور مطلوبان" });
  }

  if (!SUPABASE_URL || !ANON_KEY) {
    return res.status(500).json({ ok: false, error: "إعدادات الخادم ناقصة" });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        apikey:         ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const json = await r.json();

    if (!r.ok || json.error) {
      const msg = json.error_description || json.error || json.msg || "بيانات خاطئة";
      const arabicMsg = (msg.includes("Invalid login") || msg.includes("credentials"))
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
        : msg;
      return res.status(401).json({ ok: false, error: arabicMsg });
    }

    return res.json({
      ok:           true,
      success:      true,
      access_token: json.access_token,
      token:        json.access_token,
      user:         json.user,
    });

  } catch (err) {
    console.error("[auth/login]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
