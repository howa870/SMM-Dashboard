import { setCors, sbGetUser, SUPABASE_URL, SERVICE_KEY } from "../_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const { jwt } = req.body || {};
  if (!jwt) return res.status(400).json({ ok: false, error: "JWT مطلوب" });

  try {
    const user = await sbGetUser(jwt);
    if (!user?.id) return res.status(401).json({ ok: false, error: "JWT غير صالح" });

    return res.json({ ok: true, token: jwt, user_id: user.id, email: user.email });
  } catch (err) {
    console.error("[jwt-sync]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
