import { setCors, TELEGRAM_TOKEN } from "./_utils.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!TELEGRAM_TOKEN) {
    return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN غير مضبوط" });
  }

  try {
    // Get current webhook info
    if (req.method === "GET") {
      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`);
      const json = await r.json();
      return res.json({ ok: true, info: json.result });
    }

    // Set webhook
    if (req.method === "POST") {
      const { url } = req.body || {};
      if (!url) {
        // Auto-detect from request
        const host = req.headers["x-forwarded-host"] || req.headers.host || "";
        const proto = req.headers["x-forwarded-proto"] || "https";
        const webhookUrl = `${proto}://${host}/api/telegram`;

        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            url:              webhookUrl,
            max_connections:  10,
            allowed_updates:  ["message", "callback_query"],
          }),
        });
        const json = await r.json();
        return res.json({ ok: json.ok, webhook_url: webhookUrl, result: json });
      }

      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          url:             url,
          max_connections: 10,
          allowed_updates: ["message", "callback_query"],
        }),
      });
      const json = await r.json();
      return res.json({ ok: json.ok, webhook_url: url, result: json });
    }

    return res.status(405).json({ ok: false });
  } catch (err) {
    console.error("[setup-webhook]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
