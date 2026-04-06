import { setCors, TELEGRAM_TOKEN } from "./_utils.js";

export const config = { api: { bodyParser: true } };

/**
 * Detects if a URL is a Vercel preview deployment URL.
 * Preview URLs look like: https://project-hash-team.vercel.app
 * Production URLs look like: https://project.vercel.app or custom domains.
 *
 * ⚠️  Vercel preview deployments have "Deployment Protection" enabled by default.
 * Telegram cannot authenticate through this protection → 401 Unauthorized error.
 * ALWAYS use the production URL or the Replit domain for the webhook.
 */
function isVercelPreviewUrl(url) {
  if (!url) return false;
  // Preview URLs contain a random hash segment before the team identifier
  // Pattern: project-name-HASH-team.vercel.app
  return /\.vercel\.app/.test(url) && /vercel\.app/.test(url) &&
         url.split(".vercel.app")[0].split("-").length > 2;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!TELEGRAM_TOKEN) {
    return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" });
  }

  try {
    // GET — return current webhook info
    if (req.method === "GET") {
      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`);
      const json = await r.json();
      const info = json.result || {};
      const warning = isVercelPreviewUrl(info.url)
        ? "⚠️ Webhook is set to a Vercel PREVIEW URL — this causes 401 errors! Use production URL instead."
        : null;
      return res.status(200).json({ ok: true, info, warning });
    }

    // POST — set or delete webhook
    if (req.method === "POST") {
      const { url, delete: shouldDelete } = req.body || {};

      // Delete webhook
      if (shouldDelete) {
        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drop_pending_updates: true }),
        });
        const json = await r.json();
        return res.status(200).json({ ok: json.ok, deleted: true, result: json });
      }

      // Determine webhook URL
      let webhookUrl = url;
      if (!webhookUrl) {
        // Auto-detect from request headers
        const host  = req.headers["x-forwarded-host"] || req.headers.host || "";
        const proto = req.headers["x-forwarded-proto"] || "https";
        webhookUrl  = `${proto}://${host}/api/telegram`;
      }

      // ⚠️ CRITICAL: block preview URLs — they always cause 401
      if (isVercelPreviewUrl(webhookUrl)) {
        return res.status(400).json({
          ok: false,
          error: "❌ Cannot set webhook to a Vercel PREVIEW URL",
          reason: "Vercel preview deployments have Deployment Protection enabled. Telegram cannot authenticate → 401 Unauthorized.",
          fix: "Use your PRODUCTION Vercel URL (e.g. https://boost-iraq2.vercel.app/api/telegram) or your custom domain.",
          provided_url: webhookUrl,
        });
      }

      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url:             webhookUrl,
          max_connections: 40,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        }),
      });
      const json = await r.json();

      return res.status(200).json({
        ok:          json.ok,
        webhook_url: webhookUrl,
        result:      json,
        note:        json.ok
          ? "✅ Webhook set successfully. Test with GET /api/setup-webhook to verify."
          : `❌ Telegram rejected: ${json.description}`,
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });

  } catch (err) {
    console.error("[setup-webhook] Error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
