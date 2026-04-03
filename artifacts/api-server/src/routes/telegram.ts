import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

// ─── ENV VARS ───────────────────────────────────────────────────────────────
const BOT_TOKEN      = process.env["TELEGRAM_BOT_TOKEN"] || "";
const CHAT_ID        = process.env["TELEGRAM_CHAT_ID"] || "";
const ADMIN_ID       = Number(process.env["TELEGRAM_ADMIN_ID"] || "0");
const SUPABASE_URL   = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY   = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!BOT_TOKEN)    console.error("[TG] TELEGRAM_BOT_TOKEN not set");
if (!SUPABASE_KEY) console.error("[TG] SUPABASE_SERVICE_ROLE_KEY not set");
if (!ADMIN_ID)     console.warn("[TG] TELEGRAM_ADMIN_ID not set — all access allowed!");

// Admin Supabase client — bypasses RLS
const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ─── MULTI-STEP FLOW STATE (in-memory) ─────────────────────────────────────
// Tracks what the admin is currently doing
const adminState = new Map<number, { flow: string; data: Record<string, unknown> }>();

// ─── TELEGRAM API HELPERS ───────────────────────────────────────────────────

async function tgRequest(method: string, body: Record<string, unknown>): Promise<unknown> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok: boolean; result?: unknown; description?: string };
    if (!json.ok) console.warn(`[TG] ${method} failed:`, json.description);
    return json.result;
  } catch (err) {
    console.error(`[TG] ${method} error:`, err);
    return null;
  }
}

async function sendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>) {
  return tgRequest("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}

async function editMessage(chatId: number | string, messageId: number, text: string, extra?: Record<string, unknown>) {
  return tgRequest("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
}

async function answerCallback(callbackId: string, text: string, alert = false) {
  return tgRequest("answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: alert });
}

async function editMarkup(chatId: number | string, messageId: number, markup: object) {
  return tgRequest("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: markup });
}

// ─── MAIN MENU KEYBOARD ─────────────────────────────────────────────────────
const MAIN_MENU = {
  inline_keyboard: [
    [
      { text: "📊 الإحصائيات", callback_data: "stats" },
      { text: "💰 الأرباح",    callback_data: "revenue" },
    ],
    [
      { text: "📥 الطلبات المعلقة", callback_data: "payments" },
      { text: "👥 المستخدمين",      callback_data: "users" },
    ],
    [
      { text: "➕ إضافة رصيد", callback_data: "add_balance" },
      { text: "🔄 تحديث",      callback_data: "refresh" },
    ],
  ],
};

// ─── SEND MAIN MENU ──────────────────────────────────────────────────────────
async function sendMainMenu(chatId: number | string, text?: string) {
  await sendMessage(chatId, text || "🎛 <b>لوحة تحكم Perfect Follow</b>\n\nاختر إجراءً:", {
    reply_markup: MAIN_MENU,
  });
}

// ─── STATS ───────────────────────────────────────────────────────────────────
async function getStats() {
  if (!db) return null;
  const [users, payments, revenue] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("payments").select("id", { count: "exact", head: true }),
    db.from("payments").select("amount").eq("status", "approved"),
  ]);
  const totalRevenue = (revenue.data || []).reduce((s, p) => s + Number(p.amount), 0);
  const pending = await db.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending");
  return {
    totalUsers: users.count || 0,
    totalPayments: payments.count || 0,
    totalRevenue,
    pendingPayments: pending.count || 0,
  };
}

async function sendStats(chatId: number | string) {
  const stats = await getStats();
  if (!stats) { await sendMessage(chatId, "⚠️ تعذر الاتصال بقاعدة البيانات"); return; }
  const text = [
    "📊 <b>إحصائيات النظام</b>",
    "",
    `👥 إجمالي المستخدمين: <b>${stats.totalUsers}</b>`,
    `📥 إجمالي طلبات الشحن: <b>${stats.totalPayments}</b>`,
    `⏳ طلبات معلقة: <b>${stats.pendingPayments}</b>`,
    `💰 إجمالي الأرباح: <b>${stats.totalRevenue.toLocaleString()} IQD</b>`,
    "",
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");
  await sendMessage(chatId, text, { reply_markup: MAIN_MENU });
}

// ─── REVENUE ─────────────────────────────────────────────────────────────────
async function sendRevenue(chatId: number | string) {
  if (!db) { await sendMessage(chatId, "⚠️ تعذر الاتصال بقاعدة البيانات"); return; }
  const today = new Date().toISOString().slice(0, 10);
  const [all, todayData, approved, pending, rejected] = await Promise.all([
    db.from("payments").select("amount").eq("status", "approved"),
    db.from("payments").select("amount").eq("status", "approved").gte("created_at", today),
    db.from("payments").select("id", { count: "exact", head: true }).eq("status", "approved"),
    db.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("payments").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);
  const totalRev  = (all.data || []).reduce((s, p) => s + Number(p.amount), 0);
  const todayRev  = (todayData.data || []).reduce((s, p) => s + Number(p.amount), 0);
  const text = [
    "💰 <b>تقرير الأرباح</b>",
    "",
    `📅 إيرادات اليوم: <b>${todayRev.toLocaleString()} IQD</b>`,
    `📈 إجمالي الإيرادات: <b>${totalRev.toLocaleString()} IQD</b>`,
    "",
    `✅ طلبات مقبولة: <b>${approved.count || 0}</b>`,
    `⏳ طلبات معلقة: <b>${pending.count || 0}</b>`,
    `❌ طلبات مرفوضة: <b>${rejected.count || 0}</b>`,
    "",
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");
  await sendMessage(chatId, text, { reply_markup: MAIN_MENU });
}

// ─── PENDING PAYMENTS LIST ───────────────────────────────────────────────────
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

  await sendMessage(chatId, `📥 <b>آخر ${data.length} طلب شحن معلق</b>\n━━━━━━━━━━━━━━━━`);

  const methodLabels: Record<string, string> = {
    zaincash: "زين كاش 💳",
    qicard: "QiCard 💰",
    manual: "حوالة يدوية 🏦",
  };

  for (const pay of data) {
    const shortId = String(pay.id).slice(0, 8);
    const text = [
      `🆔 <code>${shortId}...</code>`,
      `💰 <b>${Number(pay.amount).toLocaleString()} IQD</b>`,
      `💳 ${methodLabels[pay.method] || pay.method}`,
      pay.transaction_id ? `🔢 TXID: <code>${pay.transaction_id}</code>` : null,
      pay.proof_url ? `📸 <a href="${pay.proof_url}">إثبات الدفع</a>` : null,
      `⏱ ${new Date(pay.created_at).toLocaleString("ar-IQ")}`,
    ].filter(Boolean).join("\n");

    await sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ قبول", callback_data: `approve_${pay.id}` },
          { text: "❌ رفض", callback_data: `reject_${pay.id}` },
        ]],
      },
    });
  }
  await sendMessage(chatId, "━━━━━━━━━━━━━━━━\nاختر إجراءً:", { reply_markup: MAIN_MENU });
}

// ─── USERS ───────────────────────────────────────────────────────────────────
async function sendUsers(chatId: number | string) {
  if (!db) { await sendMessage(chatId, "⚠️ تعذر الاتصال بقاعدة البيانات"); return; }
  const { data: users, count, error } = await db
    .from("profiles")
    .select("id, name, email, balance, role, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) { await sendMessage(chatId, `⚠️ خطأ: ${error.message}`); return; }

  const lines = [`👥 <b>المستخدمون (إجمالي: ${count || 0})</b>\n━━━━━━━━━━━━━━━━`];
  for (const u of (users || [])) {
    lines.push(
      `👤 ${u.name || "بدون اسم"} ${u.role === "admin" ? "🛡 (مدير)" : ""}`,
      `📧 ${u.email || "—"}`,
      `💰 ${Number(u.balance).toLocaleString()} IQD`,
      `🆔 <code>${String(u.id).slice(0, 8)}...</code>`,
      "─────────────",
    );
  }
  if ((count || 0) > 5) lines.push(`... و ${(count || 0) - 5} مستخدم آخر`);

  await sendMessage(chatId, lines.join("\n"), { reply_markup: MAIN_MENU });
}

// ─── ADD BALANCE (STEP 1: prompt) ────────────────────────────────────────────
async function promptAddBalance(chatId: number | string, fromId: number) {
  adminState.set(fromId, { flow: "add_balance", data: {} });
  await sendMessage(chatId,
    "➕ <b>إضافة رصيد يدوياً</b>\n\nأرسل رسالة بالصيغة:\n<code>user_id المبلغ</code>\n\nمثال:\n<code>1d8203d5-a95c-42c8-883d-84920c2e5ab7 5000</code>\n\nأو أرسل /cancel للإلغاء"
  );
}

// ─── ADD BALANCE (STEP 2: process) ──────────────────────────────────────────
async function processAddBalance(chatId: number | string, fromId: number, text: string) {
  adminState.delete(fromId);
  if (!db) { await sendMessage(chatId, "⚠️ تعذر الاتصال بقاعدة البيانات"); return; }

  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendMessage(chatId, "❌ صيغة خاطئة. المثال:\n<code>user_id المبلغ</code>");
    return;
  }
  const userId = parts[0];
  const amount = Number(parts[1]);
  if (!userId || isNaN(amount) || amount <= 0) {
    await sendMessage(chatId, "❌ user_id أو المبلغ غير صحيح");
    return;
  }

  // Fetch current profile
  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("id, name, email, balance")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    await sendMessage(chatId, `❌ لم يتم إيجاد مستخدم بهذا ID:\n<code>${userId}</code>`);
    return;
  }

  const oldBalance = Number(profile.balance);
  const newBalance = oldBalance + amount;

  const { error: updateErr } = await db
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);

  if (updateErr) {
    await sendMessage(chatId, `❌ فشل التحديث: ${updateErr.message}`);
    return;
  }

  // Insert notification
  await db.from("notifications").insert({
    user_id: userId,
    title: "💰 تم إضافة رصيد",
    message: `تم إضافة ${amount.toLocaleString()} IQD إلى حسابك من قِبل الإدارة.`,
    is_read: false,
  }).then(r => { if (r.error) console.warn("[TG] addBalance notif:", r.error.message); });

  const confirmText = [
    "✅ <b>تم إضافة الرصيد بنجاح</b>",
    "",
    `👤 المستخدم: ${profile.name || profile.email || userId}`,
    `💰 الرصيد السابق: <b>${oldBalance.toLocaleString()} IQD</b>`,
    `➕ المضاف: <b>${amount.toLocaleString()} IQD</b>`,
    `💳 الرصيد الجديد: <b>${newBalance.toLocaleString()} IQD</b>`,
  ].join("\n");

  console.log(`[TG] Added ${amount} IQD to ${userId} (${profile.email}). New balance: ${newBalance}`);
  await sendMessage(chatId, confirmText, { reply_markup: MAIN_MENU });
}

// ─── APPROVE / REJECT PAYMENT ────────────────────────────────────────────────
async function approvePayment(paymentId: string, fromName: string): Promise<string> {
  if (!db) return "❌ قاعدة البيانات غير متاحة";

  const { data: payment, error: fetchErr } = await db
    .from("payments")
    .select("id, user_id, amount, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (fetchErr || !payment) {
    console.error("[TG] approvePayment: not found:", paymentId, fetchErr?.message);
    return `❌ الطلب غير موجود (${paymentId.slice(0, 8)}...)`;
  }
  if (payment.status !== "pending") {
    return `⚠️ الطلب تمت معالجته مسبقاً: ${payment.status}`;
  }

  // Fetch user balance
  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("balance")
    .eq("id", payment.user_id)
    .maybeSingle();

  if (profErr || !profile) {
    console.error("[TG] approvePayment: profile not found:", payment.user_id);
    return "❌ لم يتم إيجاد حساب المستخدم";
  }

  // Use increment_balance RPC for atomic balance update
  const { error: balErr } = await db.rpc("increment_balance", {
    uid: payment.user_id,
    amount: Number(payment.amount),
  });
  if (balErr) {
    // Fallback: manual update if rpc not available
    console.warn("[TG] rpc increment_balance failed, using fallback:", balErr.message);
    const newBalance = Number(profile.balance) + Number(payment.amount);
    const { error: fallbackErr } = await db.from("profiles").update({ balance: newBalance }).eq("id", payment.user_id);
    if (fallbackErr) { return `❌ فشل تحديث الرصيد: ${fallbackErr.message}`; }
  }

  // Update payment status
  const { error: payErr } = await db
    .from("payments")
    .update({ status: "approved" })
    .eq("id", paymentId);
  if (payErr) { console.error("[TG] approvePayment: payment err:", payErr.message); return `❌ فشل تحديث الطلب: ${payErr.message}`; }

  // Insert notification
  await db.from("notifications").insert({
    user_id: payment.user_id,
    title: "✅ تم شحن رصيدك",
    message: `تم إضافة ${Number(payment.amount).toLocaleString()} IQD إلى حسابك بنجاح.`,
    is_read: false,
  }).then(r => { if (r.error) console.warn("[TG] approve notif:", r.error.message); });

  console.log(`[TG] ✅ Approved ${paymentId} — +${payment.amount} IQD → user ${payment.user_id}`);
  return `✅ تم قبول الطلب\n💰 تم إضافة ${Number(payment.amount).toLocaleString()} IQD للمستخدم\nبواسطة: ${fromName}`;
}

async function rejectPayment(paymentId: string, fromName: string): Promise<string> {
  if (!db) return "❌ قاعدة البيانات غير متاحة";

  const { data: payment, error: fetchErr } = await db
    .from("payments")
    .select("id, user_id, amount, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (fetchErr || !payment) {
    return `❌ الطلب غير موجود (${paymentId.slice(0, 8)}...)`;
  }
  if (payment.status !== "pending") {
    return `⚠️ الطلب تمت معالجته مسبقاً: ${payment.status}`;
  }

  const { error } = await db
    .from("payments")
    .update({ status: "rejected" })
    .eq("id", paymentId);
  if (error) { return `❌ فشل تحديث الطلب: ${error.message}`; }

  // Insert notification
  await db.from("notifications").insert({
    user_id: payment.user_id,
    title: "❌ تم رفض طلب الشحن",
    message: `تم رفض طلب شحن بمبلغ ${Number(payment.amount).toLocaleString()} IQD. يرجى التواصل مع الدعم.`,
    is_read: false,
  }).then(r => { if (r.error) console.warn("[TG] reject notif:", r.error.message); });

  console.log(`[TG] ❌ Rejected ${paymentId} by ${fromName}`);
  return `❌ تم رفض الطلب\nبواسطة: ${fromName}`;
}

// ─── /setnumbers COMMAND ─────────────────────────────────────────────────────
// Usage: /setnumbers [zain_number] [asiacell_number] [qicard_number]
// Example: /setnumbers 07881457896 07769079777 1234021689
async function handleSetNumbers(chatId: number | string, text: string) {
  if (!db) { await sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة"); return; }

  const parts = text.trim().split(/\s+/).slice(1); // remove /setnumbers

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
    { key: "zain",     value: zain,     label: "زين كاش"  },
    { key: "asiacell", value: asiacell, label: "آسياسيل" },
    { key: "qicard",   value: qicard,   label: "QiCard"   },
  ];

  const results: string[] = [];
  let hasError = false;

  for (const u of updates) {
    const { error } = await db
      .from("payment_settings")
      .upsert({ key: u.key, value: u.value, label: u.label, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      console.error(`[TG] setNumbers ${u.key} error:`, error.message);
      results.push(`❌ ${u.label}: فشل — ${error.message}`);
      hasError = true;
    } else {
      results.push(`✅ ${u.label}: <code>${u.value}</code>`);
    }
  }

  const summary = hasError
    ? "⚠️ <b>تم التحديث مع بعض الأخطاء</b>"
    : "✅ <b>تم تحديث جميع أرقام الدفع بنجاح!</b>";

  await sendMessage(chatId, [
    summary,
    "",
    ...results,
    "",
    "🔄 ستظهر الأرقام الجديدة للمستخدمين فوراً.",
  ].join("\n"), { reply_markup: MAIN_MENU });

  console.log(`[TG] /setnumbers → zain=${zain}, asiacell=${asiacell}, qicard=${qicard}`);
}

// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────
async function handleMessage(chatId: number, fromId: number, text: string) {
  const state = adminState.get(fromId);

  // /cancel
  if (text === "/cancel") {
    adminState.delete(fromId);
    await sendMessage(chatId, "✖️ تم الإلغاء", { reply_markup: MAIN_MENU });
    return;
  }

  // /start
  if (text === "/start" || text === "/menu") {
    adminState.delete(fromId);
    await sendMainMenu(chatId, `👋 أهلاً بك في لوحة التحكم!\n\n🤖 <b>Perfect Follow Admin Bot</b>`);
    return;
  }

  // /stats
  if (text === "/stats") {
    await sendStats(chatId);
    return;
  }

  // /setnumbers zain asiacell qicard
  if (text.startsWith("/setnumbers")) {
    await handleSetNumbers(chatId, text);
    return;
  }

  // Pending flow: add_balance
  if (state?.flow === "add_balance") {
    await processAddBalance(chatId, fromId, text);
    return;
  }

  // Default
  await sendMainMenu(chatId, "اختر إجراءً من القائمة:");
}

// ─── CALLBACK HANDLER ────────────────────────────────────────────────────────
async function handleCallback(callbackId: string, from: { id: number; first_name?: string }, data: string, message: { message_id: number; chat: { id: number } } | undefined) {
  const chatId  = message?.chat.id || ADMIN_ID;
  const msgId   = message?.message_id;
  const fromName = from.first_name || "المدير";

  console.log(`[TG] Callback: "${data}" from ${fromName} (${from.id})`);

  // ── Already processed ──
  if (data === "done") {
    await answerCallback(callbackId, "✅ تمت المعالجة مسبقاً");
    return;
  }

  // ── Navigation buttons ──
  if (data === "stats" || data === "refresh") {
    await answerCallback(callbackId, "جاري التحميل...");
    await sendStats(chatId);
    return;
  }

  if (data === "payments") {
    await answerCallback(callbackId, "جاري التحميل...");
    await sendPaymentsList(chatId);
    return;
  }

  if (data === "users") {
    await answerCallback(callbackId, "جاري التحميل...");
    await sendUsers(chatId);
    return;
  }

  if (data === "revenue") {
    await answerCallback(callbackId, "جاري التحميل...");
    await sendRevenue(chatId);
    return;
  }

  if (data === "add_balance") {
    await answerCallback(callbackId, "");
    await promptAddBalance(chatId, from.id);
    return;
  }

  // ── Approve / Reject ──
  if (data.startsWith("approve_")) {
    const paymentId = data.replace("approve_", "");
    await answerCallback(callbackId, "جاري القبول...");
    const result = await approvePayment(paymentId, fromName);
    await sendMessage(chatId, result, { reply_markup: MAIN_MENU });
    // Update the button to show processed
    if (msgId) {
      await editMarkup(chatId, msgId, {
        inline_keyboard: [[{ text: `✅ تم القبول بواسطة ${fromName}`, callback_data: "done" }]],
      });
    }
    return;
  }

  if (data.startsWith("reject_")) {
    const paymentId = data.replace("reject_", "");
    await answerCallback(callbackId, "جاري الرفض...");
    const result = await rejectPayment(paymentId, fromName);
    await sendMessage(chatId, result, { reply_markup: MAIN_MENU });
    if (msgId) {
      await editMarkup(chatId, msgId, {
        inline_keyboard: [[{ text: `❌ تم الرفض بواسطة ${fromName}`, callback_data: "done" }]],
      });
    }
    return;
  }

  await answerCallback(callbackId, "⚠️ طلب غير معروف");
}

// ─── POST /api/telegram/webhook ─────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  res.json({ ok: true }); // Always respond 200 immediately

  const update = req.body as TelegramUpdate;
  console.log("[TG Webhook] Update:", JSON.stringify(update).slice(0, 300));

  try {
    // ── Handle message (text commands) ──
    if (update.message) {
      const { from, chat, text } = update.message;
      const fromId = from?.id;
      const chatId = chat?.id;
      if (!fromId || !chatId || !text) return;

      // Security check
      if (ADMIN_ID && fromId !== ADMIN_ID) {
        await sendMessage(chatId, "❌ غير مصرح. هذا البوت للمدير فقط.");
        console.warn(`[TG] Unauthorized access from ${fromId}`);
        return;
      }

      await handleMessage(chatId, fromId, text);
      return;
    }

    // ── Handle callback_query (button presses) ──
    if (update.callback_query) {
      const { id: callbackId, from, data, message } = update.callback_query;
      if (!from || !data) return;

      // Security check
      if (ADMIN_ID && from.id !== ADMIN_ID) {
        await answerCallback(callbackId, "❌ غير مصرح");
        console.warn(`[TG] Unauthorized callback from ${from.id}`);
        return;
      }

      await handleCallback(callbackId, from, data, message);
      return;
    }

  } catch (err) {
    console.error("[TG Webhook] Error:", err);
    // Try to notify admin of error
    if (ADMIN_ID) {
      await sendMessage(ADMIN_ID, `⚠️ خطأ في البوت:\n<code>${err instanceof Error ? err.message : String(err)}</code>`).catch(() => {});
    }
  }
});

// ─── POST /api/telegram/payment-notify ──────────────────────────────────────
// Called by frontend when user submits a payment request
router.post("/payment-notify", async (req, res) => {
  const { id, email, amount, method, transaction_id, proof_url, notes } = req.body as {
    id: string;
    email: string;
    amount: number;
    method: string;
    transaction_id?: string;
    proof_url?: string;
    notes?: string;
  };

  console.log("[TG] Payment notify:", { id, email, amount, method });

  const methodLabels: Record<string, string> = {
    zaincash: "زين كاش 💳",
    qicard: "QiCard 💰",
    manual: "حوالة يدوية 🏦",
  };

  const text = [
    "🚀 <b>طلب شحن جديد!</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> <code>${Number(amount).toLocaleString()} IQD</code>`,
    `💳 <b>الطريقة:</b> ${methodLabels[method] || method}`,
    transaction_id ? `🔢 <b>TXID:</b> <code>${transaction_id}</code>` : null,
    proof_url ? `📸 <b>إثبات الدفع:</b> <a href="${proof_url}">عرض الصورة</a>` : null,
    notes ? `📝 <b>ملاحظات:</b> ${notes}` : null,
    "",
    `🆔 <b>رقم الطلب:</b> <code>${String(id).slice(0, 8)}...</code>`,
    `⏱ ${new Date().toLocaleString("ar-IQ")}`,
  ].filter(Boolean).join("\n");

  const adminPanelUrl = `https://${req.headers.host}/#/admin/payments`;
  const markup = {
    inline_keyboard: [[
      { text: "✅ قبول الطلب", callback_data: `approve_${id}` },
      { text: "❌ رفض الطلب", callback_data: `reject_${id}` },
    ], [
      { text: "🔍 لوحة الإدارة", url: adminPanelUrl },
    ]],
  };

  // Send to admin chat
  const notifChatId = CHAT_ID || String(ADMIN_ID);
  if (notifChatId) {
    await sendMessage(notifChatId, text, { reply_markup: markup });
  }
  res.json({ ok: true });
});

// ─── POST /api/telegram/payment-approved (manual approval from web panel) ───
router.post("/payment-approved", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const text = [
    "✅ <b>تم قبول طلب شحن</b>",
    `👤 ${email}`,
    `💰 ${Number(amount).toLocaleString()} IQD`,
  ].join("\n");
  const notifChatId = CHAT_ID || String(ADMIN_ID);
  if (notifChatId) await sendMessage(notifChatId, text);
  res.json({ ok: true });
});

// ─── POST /api/telegram/payment-rejected (manual rejection from web panel) ──
router.post("/payment-rejected", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const text = [
    "❌ <b>تم رفض طلب شحن</b>",
    `👤 ${email}`,
    `💰 ${Number(amount).toLocaleString()} IQD`,
  ].join("\n");
  const notifChatId = CHAT_ID || String(ADMIN_ID);
  if (notifChatId) await sendMessage(notifChatId, text);
  res.json({ ok: true });
});

// ─── POST /api/telegram/setup-webhook ───────────────────────────────────────
router.post("/setup-webhook", async (req, res) => {
  if (!BOT_TOKEN) { res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" }); return; }
  const host = req.headers.host || req.body?.host;
  const webhookUrl = req.body?.url || `https://${host}/api/telegram/webhook`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });
    const json = await r.json();
    console.log("[TG] Webhook set:", JSON.stringify(json));
    res.json({ ok: true, webhookUrl, telegramResponse: json });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/telegram/webhook-info ─────────────────────────────────────────
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

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────
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

export default router;
