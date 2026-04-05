import { setCors, sbCreateUser, sbInsert, SERVICE_KEY } from "../_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: "الاسم والبريد وكلمة المرور مطلوبة" });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
  }

  try {
    const data   = await sbCreateUser({ email, password, name });
    const userId = data?.user?.id ?? data?.id;

    // ── Ensure profile row exists (fallback if trigger not set up) ────────────
    if (userId && SERVICE_KEY) {
      sbInsert("profiles", { id: userId, email, balance: 0 })
        .catch(() => {}); // ignore if trigger already created it
    }

    res.status(201).json({ ok: true, success: true, userId });

  } catch (err) {
    console.error("[auth/register]", err.message, err.body);
    const body      = err.body || {};
    const rawMsg    = body.msg || body.error || err.message || "";
    const arabicMsg = (rawMsg.includes("already") || rawMsg.includes("registered"))
      ? "هذا البريد الإلكتروني مسجّل مسبقاً"
      : rawMsg || "خطأ في إنشاء الحساب";
    res.status(err.status || 400).json({ ok: false, error: arabicMsg });
  }
}
