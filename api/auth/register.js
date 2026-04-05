import { setCors, sbCreateUser } from "../_utils.js";

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

  try {
    const data = await sbCreateUser({ email, password, name });
    res.status(201).json({ success: true, userId: data?.user?.id ?? data?.id });

  } catch (err) {
    console.error("[auth/register]", err.message, err.body);
    const body    = err.body || {};
    const rawMsg  = body.msg || body.error || err.message || "";
    const arabicMsg = (rawMsg.includes("already") || rawMsg.includes("registered"))
      ? "هذا البريد الإلكتروني مسجّل مسبقاً"
      : rawMsg || "خطأ في إنشاء الحساب";
    res.status(err.status || 400).json({ error: arabicMsg });
  }
}
