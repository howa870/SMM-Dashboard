import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const BOT_TOKEN    = process.env["TELEGRAM_BOT_TOKEN"] || "";
const CHAT_ID      = process.env["TELEGRAM_CHAT_ID"] || "";
const ADMIN_ID     = Number(process.env["TELEGRAM_ADMIN_ID"] || "0");
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!BOT_TOKEN)    console.error("[TG] ❌ TELEGRAM_BOT_TOKEN not set");
if (!SUPABASE_KEY) console.error("[TG] ❌ SUPABASE_SERVICE_ROLE_KEY not set");
if (!ADMIN_ID)     console.warn("[TG] ⚠️  TELEGRAM_ADMIN_ID not set — admin check disabled");

const db = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const userState = new Map<number, { flow: "edit_number"; key: "zain" | "asiacell" | "qicard"; label: string }>();

async function tgRequest(method: string, body: Record<string, unknown>): Promise<unknown> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok: boolean; description?: string; result?: unknown };
    if (!json.ok) console.warn(`[TG] ${method} failed:`, json.description);
    return json.result ?? null;
  } catch (err) {
    console.error(`[TG] ${method} error:`, err);
    return null;
  }
}

async function sendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>) {
  return tgRequest("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra,
  });
}

async function editMessage(chatId: number | string, messageId: number, text: string, extra?: Record<string, unknown>) {
  return tgRequest("editMessageText", {
    chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra,
  });
}

async function answerCallback(callbackId: string, text: string, alert = false) {
  return tgRequest("answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: alert });
}

function isAdmin(fromId: number): boolean {
  if (!ADMIN_ID) return true;
  return fromId === ADMIN_ID;
}

const MAIN_MENU = {
  inline_keyboard: [
    [{ text: "📥 الطلبات المعلقة", callback_data: "pending_payments" }],
    [{ text: "⚙️ أرقام الدفع",    callback_data: "payment_numbers"  }],
  ],
};

const EDIT_NUMBERS_MENU = {
  inline_keyboard: [
    [{ text: "📱 زين كاش",  callback_data: "edit_zain"     }],
    [{ text: "📞 آسياسيل", callback_data: "edit_asiacell" }],
    [{ text: "💳 QiCard",  callback_data: "edit_qicard"   }],
    [{ text: "🔙 رجوع",    callback_data: "back_main"     }],
  ],
};

async function sendPaymentsList(chatId: number | string) {
  if (!db) { await sendMessage(chatId, "⚠️ تعذر الاتصال بقاعدة البيانات"); return; }
  const { data, error } = await db
    .from("payments")
    .select("id, amount, method, status, created_at, user_id, transaction_id, proof_url")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) { await sendMessage(chatId, `⚠️ خطأ: ${error.message}`); return; }
  if (!data || data.length === 0) {
    await sendMessage(chatId, "✅ لا توجد طلبات شحن معلقة حالياً", { reply_markup: MAIN_MENU });
    return;
  }

  const methodLabel: Record<string, string> = {
    zaincash: "زين كاش 💳", asiacell: "آسياسيل 📱", qicard: "QiCard 💰", manual: "يدوي 🏦",
  };

  await sendMessage(chatId, `📥 <b>آخر ${data.length} طلب شحن معلق</b>\n━━━━━━━━━━━━━━━━`);

  for (const pay of data) {
    const shortId = String(pay.id).slice(0, 8);
    const lines = [
      `🆔 <code>${shortId}…</code>`,
      `💰 <b>${Number(pay.amount).toLocaleString()} IQD</b>`,
      `💳 ${methodLabel[pay.method] || pay.method}`,
      pay.transaction_id ? `🔢 TXID: <code>${pay.transaction_id}</code>` : null,
      pay.proof_url ? `📸 <a href="${pay.proof_url}">إثبات الدفع</a>` : null,
      `⏱ ${new Date(pay.created_at).toLocaleString("ar-IQ")}`,
    ].filter(Boolean).join("\n");

    await sendMessage(chatId, lines, {
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ قبول", callback_data: `approve_${pay.id}` },
          { text: "❌ رفض",  callback_data: `reject_${pay.id}`  },
        ]],
      },
    });
  }
  await sendMessage(chatId, "━━━━━━━━━━━━━━━━", { reply_markup: MAIN_MENU });
}

async function approvePayment(paymentId: string, adminName: string): Promise<string> {
  if (!db) return "❌ قاعدة البيانات غير متاحة";

  const { data: payment, error: fetchErr } = await db
    .from("payments")
    .select("id, user_id, amount, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (fetchErr || !payment) return `❌ الطلب غير موجود (${paymentId.slice(0, 8)}…)`;
  if (payment.status !== "pending") return `⚠️ الطلب معالَج مسبقاً: ${payment.status}`;

  const { error: rpcErr } = await db.rpc("increment_balance_by_user", {
    uid: payment.user_id,
    amount_input: Number(payment.amount),
  });
  if (rpcErr) {
    const { data: profile } = await db.from("profiles").select("balance").eq("id", payment.user_id).maybeSingle();
    const newBal = Number(profile?.balance || 0) + Number(payment.amount);
    const { error: fallErr } = await db.from("profiles").update({ balance: newBal }).eq("id", payment.user_id);
    if (fallErr) return `❌ فشل تحديث الرصيد: ${fallErr.message}`;
  }

  const { error: payErr } = await db.from("payments").update({ status: "approved" }).eq("id", paymentId);
  if (payErr) return `❌ فشل تحديث الطلب: ${payErr.message}`;

  await db.from("notifications").insert({
    user_id: payment.user_id,
    title: "✅ تم شحن رصيدك",
    message: `تم إضافة ${Number(payment.amount).toLocaleString()} IQD إلى حسابك بنجاح.`,
    is_read: false,
  }).then(r => { if (r.error) console.warn("[TG] approve notif:", r.error.message); });

  console.log(`[TG] ✅ Approved ${paymentId} — +${payment.amount} IQD → ${payment.user_id}`);
  return `✅ <b>تمت الموافقة</b>\n💰 <b>${Number(payment.amount).toLocaleString()} IQD</b>\n🆔 <code>${String(paymentId).slice(0, 8)}…</code>\n👤 ${adminName}`;
}

async function rejectPayment(paymentId: string, adminName: string): Promise<string> {
  if (!db) return "❌ قاعدة البيانات غير متاحة";

  const { data: payment, error } = await db
    .from("payments")
    .select("id, user_id, amount, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !payment) return `❌ الطلب غير موجود (${paymentId.slice(0, 8)}…)`;
  if (payment.status !== "pending") return `⚠️ الطلب معالَج مسبقاً: ${payment.status}`;

  const { error: updErr } = await db.from("payments").update({ status: "rejected" }).eq("id", paymentId);
  if (updErr) return `❌ فشل تحديث الطلب: ${updErr.message}`;

  await db.from("notifications").insert({
    user_id: payment.user_id,
    title: "❌ تم رفض طلب الشحن",
    message: `تم رفض طلب شحن بمبلغ ${Number(payment.amount).toLocaleString()} IQD. يرجى التواصل مع الدعم.`,
    is_read: false,
  }).then(r => { if (r.error) console.warn("[TG] reject notif:", r.error.message); });

  console.log(`[TG] ❌ Rejected ${paymentId} by ${adminName}`);
  return `❌ <b>تم الرفض</b>\n🆔 <code>${String(paymentId).slice(0, 8)}…</code>\n👤 ${adminName}`;
}

async function handleSetNumbers(chatId: number | string, text: string) {
  if (!db) { await sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة"); return; }
  const parts = text.trim().split(/\s+/).slice(1);
  if (parts.length < 3) {
    await sendMessage(chatId, [
      "❌ صيغة خاطئة!\n",
      "الصيغة الصحيحة:",
      "<code>/setnumbers [رقم_زين] [رقم_آسياسيل] [رقم_qicard]</code>\n",
      "مثال:",
      "<code>/setnumbers 07881457896 07769079777 1234021689</code>",
    ].join("\n"));
    return;
  }
  const [zain, asiacell, qicard] = parts;
  const updates = [
    { key: "zain",     value: zain,     label: "زين كاش" },
    { key: "asiacell", value: asiacell, label: "آسياسيل" },
    { key: "qicard",   value: qicard,   label: "QiCard"  },
  ];
  const results: string[] = [];
  let hasError = false;
  for (const u of updates) {
    const { error } = await db.from("payment_settings").upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) { results.push(`❌ ${u.label}: ${error.message}`); hasError = true; }
    else results.push(`✅ ${u.label}: <code>${u.value}</code>`);
  }
  const status = hasError ? "⚠️ بعض التحديثات فشلت:" : "✅ تم تحديث جميع الأرقام:";
  await sendMessage(chatId, `${status}\n\n${results.join("\n")}`, { reply_markup: MAIN_MENU });
}

router.post("/notify-payment", async (req, res) => {
  if (!BOT_TOKEN || !CHAT_ID) { res.json({ ok: false, reason: "bot not configured" }); return; }
  const { user_id, amount, method } = req.body || {};
  if (!user_id || !amount) { res.status(400).json({ error: "user_id and amount required" }); return; }

  const methodLabel: Record<string, string> = {
    zaincash: "زين كاش 💳", asiacell: "آسياسيل 📱", qicard: "QiCard 💰", manual: "يدوي 🏦",
  };

  const text = [
    "💰 <b>طلب شحن جديد</b>",
    "",
    `👤 User ID: <code>${user_id}</code>`,
    `💵 Amount: <b>${Number(amount).toLocaleString()} IQD</b>`,
    `💳 Method: ${methodLabel[method] || method || "غير محدد"}`,
    "",
    `⏱ ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");

  await tgRequest("sendMessage", {
    chat_id: CHAT_ID,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[
      { text: "📥 عرض الطلبات المعلقة", callback_data: "pending_payments" },
    ]] },
  });
  res.json({ ok: true });
});

router.post("/setup-webhook", async (req, res) => {
  if (!BOT_TOKEN) { res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" }); return; }
  const host = req.headers.host || req.body?.host;
  const webhookUrl = req.body?.url || `https://${host}/api/telegram/webhook`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
    });
    const json = await r.json();
    console.log("[TG] Webhook set:", JSON.stringify(json));
    res.json({ ok: true, webhookUrl, telegramResponse: json });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/webhook-info", async (_req, res) => {
  if (!BOT_TOKEN) { res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" }); return; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const json = await r.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
};

router.post("/webhook", async (req, res) => {
  res.json({ ok: true });

  const update = req.body as TelegramUpdate;

  if (update.callback_query) {
    const cb   = update.callback_query;
    const from = cb.from;
    const chatId = cb.message?.chat.id ?? from.id;
    const msgId  = cb.message?.message_id ?? 0;
    const data   = cb.data ?? "";
    const adminName = from.first_name || from.username || String(from.id);

    if (!isAdmin(from.id)) {
      await answerCallback(cb.id, "❌ غير مصرح", true);
      return;
    }

    if (data === "pending_payments") {
      await answerCallback(cb.id, "🔄 جاري التحميل…");
      await sendPaymentsList(chatId);
      return;
    }

    if (data === "payment_numbers") {
      await answerCallback(cb.id, "");
      await sendMessage(chatId, "⚙️ <b>أرقام الدفع</b>\n\nاختر الرقم الذي تريد تعديله:", { reply_markup: EDIT_NUMBERS_MENU });
      return;
    }

    if (data === "back_main") {
      await answerCallback(cb.id, "");
      await sendMessage(chatId, "🏠 القائمة الرئيسية — اختر:", { reply_markup: MAIN_MENU });
      return;
    }

    if (data === "edit_zain" || data === "edit_asiacell" || data === "edit_qicard") {
      const keyMap = { edit_zain: "zain", edit_asiacell: "asiacell", edit_qicard: "qicard" } as const;
      const labelMap = { edit_zain: "زين كاش", edit_asiacell: "آسياسيل", edit_qicard: "QiCard" };
      const key = keyMap[data as keyof typeof keyMap];
      const label = labelMap[data as keyof typeof labelMap];
      await answerCallback(cb.id, "");
      userState.set(from.id, { flow: "edit_number", key, label });
      await sendMessage(chatId, `✏️ أدخل الرقم الجديد لـ <b>${label}</b>:\n\n<i>مثال: 07881457896</i>`);
      return;
    }

    if (data.startsWith("approve_")) {
      const paymentId = data.slice("approve_".length);
      await answerCallback(cb.id, "⏳ جاري المعالجة…");
      const result = await approvePayment(paymentId, adminName);
      if (msgId) {
        await editMessage(chatId, msgId, result, {
          reply_markup: { inline_keyboard: [[{ text: "✅ تمت الموافقة", callback_data: "noop" }]] },
        });
      } else {
        await sendMessage(chatId, result, { reply_markup: MAIN_MENU });
      }
      return;
    }

    if (data.startsWith("reject_")) {
      const paymentId = data.slice("reject_".length);
      await answerCallback(cb.id, "⏳ جاري المعالجة…");
      const result = await rejectPayment(paymentId, adminName);
      if (msgId) {
        await editMessage(chatId, msgId, result, {
          reply_markup: { inline_keyboard: [[{ text: "❌ تم الرفض", callback_data: "noop" }]] },
        });
      } else {
        await sendMessage(chatId, result, { reply_markup: MAIN_MENU });
      }
      return;
    }

    await answerCallback(cb.id, "");
    return;
  }

  if (update.message) {
    const msg    = update.message;
    const from   = msg.from;
    const chatId = msg.chat.id;
    const text   = msg.text?.trim() ?? "";

    if (!from || !isAdmin(from.id)) return;

    const state = userState.get(from.id);
    if (state?.flow === "edit_number") {
      userState.delete(from.id);
      const value = text.trim();
      if (!value || !/^[\d\w]+$/.test(value)) {
        await sendMessage(chatId, "❌ رقم غير صالح. يرجى إدخال أرقام وأحرف فقط.", { reply_markup: EDIT_NUMBERS_MENU });
        return;
      }
      if (!db) { await sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة"); return; }
      const { error } = await db.from("payment_settings").upsert(
        { key: state.key, value, label: state.label, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) {
        await sendMessage(chatId, `❌ فشل التحديث: ${error.message}`, { reply_markup: EDIT_NUMBERS_MENU });
      } else {
        await sendMessage(chatId, `✅ تم تحديث رقم <b>${state.label}</b>:\n<code>${value}</code>`, { reply_markup: MAIN_MENU });
      }
      return;
    }

    if (text === "/start" || text === "/menu") {
      await sendMessage(chatId, "🤖 <b>لوحة تحكم البوت</b>\n\nاختر:", { reply_markup: MAIN_MENU });
      return;
    }

    if (text === "/payments") {
      await sendPaymentsList(chatId);
      return;
    }

    if (text.startsWith("/setnumbers")) {
      await handleSetNumbers(chatId, text);
      return;
    }

    await sendMessage(chatId, "اختر من القائمة:", { reply_markup: MAIN_MENU });
  }
});

export default router;
