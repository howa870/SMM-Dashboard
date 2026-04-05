import { setCors, sbSelect, sbGetUser, SERVICE_KEY } from "../_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authHeader = req.headers["authorization"] || "";
  const token      = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return res.status(401).json({ ok: false, error: "مطلوب تسجيل الدخول" });

  try {
    const user = await sbGetUser(token);
    if (!user?.id) return res.status(401).json({ ok: false, error: "جلسة غير صالحة" });

    if (!SERVICE_KEY) return res.status(500).json({ ok: false, error: "إعدادات الخادم ناقصة" });

    const orders = await sbSelect(
      "orders",
      `user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=50`
    );

    return res.json({ ok: true, data: orders || [], count: orders?.length || 0 });

  } catch (err) {
    console.error("[smm/orders]", err.message);
    return res.status(500).json({ ok: false, error: err.message, data: [] });
  }
}
