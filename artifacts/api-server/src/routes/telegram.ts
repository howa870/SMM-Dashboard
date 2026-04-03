import { Router } from "express";

const router = Router();

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const CHAT_ID = process.env["TELEGRAM_CHAT_ID"];
const ADMIN_URL = process.env["ADMIN_URL"] || "";

async function sendTelegramMessage(text: string, replyMarkup?: object): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping.");
    return false;
  }
  try {
    const body: Record<string, unknown> = {
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok: boolean };
    return json.ok;
  } catch (err) {
    console.error("[Telegram] Failed to send message:", err);
    return false;
  }
}

router.post("/payment-notify", async (req, res) => {
  const { id, email, amount, method, transaction_id, proof_url, notes } = req.body as {
    id: number;
    email: string;
    amount: number;
    method: string;
    transaction_id?: string;
    proof_url?: string;
    notes?: string;
  };

  const methodLabels: Record<string, string> = {
    zaincash: "زين كاش 💳",
    qicard: "QiCard 💰",
    manual: "حوالة يدوية 🏦",
  };

  const text = [
    "🚀 <b>طلب شحن جديد</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> ${Number(amount).toLocaleString()} IQD`,
    `💳 <b>الطريقة:</b> ${methodLabels[method] || method}`,
    transaction_id ? `🔢 <b>TXID:</b> <code>${transaction_id}</code>` : null,
    proof_url ? `📸 <b>إثبات الدفع:</b> <a href="${proof_url}">عرض الصورة</a>` : null,
    notes ? `📝 <b>ملاحظات:</b> ${notes}` : null,
    "",
    `🆔 <b>ID:</b> #${id}`,
    "",
    `⏱ ${new Date().toLocaleString("ar-IQ")}`,
  ].filter(Boolean).join("\n");

  const adminPanelUrl = ADMIN_URL || `https://${req.headers.host}/#/admin/payments`;

  const replyMarkup = {
    inline_keyboard: [[
      { text: "🔍 فتح لوحة الإدارة", url: adminPanelUrl },
    ]],
  };

  await sendTelegramMessage(text, replyMarkup);
  res.json({ ok: true });
});

router.post("/payment-approved", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const text = [
    "✅ <b>تم قبول طلب شحن</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> ${Number(amount).toLocaleString()} IQD`,
    "",
    "تم إضافة الرصيد بنجاح.",
  ].join("\n");
  await sendTelegramMessage(text);
  res.json({ ok: true });
});

router.post("/payment-rejected", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const text = [
    "❌ <b>تم رفض طلب شحن</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> ${Number(amount).toLocaleString()} IQD`,
  ].join("\n");
  await sendTelegramMessage(text);
  res.json({ ok: true });
});

export default router;
