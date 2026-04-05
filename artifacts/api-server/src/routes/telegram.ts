import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { db as drizzleDb, paymentsTable, usersTable } from "@workspace/db";
import { eq, count as drizzleCount, sum as drizzleSum } from "drizzle-orm";

const router = Router();

// ─── ENV VARS ────────────────────────────────────────────────────────────────
const BOT_TOKEN    = process.env["TELEGRAM_BOT_TOKEN"] || "";
const CHAT_ID      = process.env["TELEGRAM_CHAT_ID"] || "";
const ADMIN_ID     = Number(process.env["TELEGRAM_ADMIN_ID"] || "0");
const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!BOT_TOKEN)    console.error("[TG] ❌ TELEGRAM_BOT_TOKEN not set");
if (!SUPABASE_KEY) console.warn("[TG] ⚠️  SUPABASE_SERVICE_ROLE_KEY not set (Supabase features limited)");
if (!ADMIN_ID)     console.warn("[TG] ⚠️  TELEGRAM_ADMIN_ID not set — admin check disabled");

// Admin Supabase client — bypasses RLS
const db = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ─── IN-MEMORY STATE ─────────────────────────────────────────────────────────
// Tracks multi-step conversations per Telegram user
type AdminFlow =
  | { flow: "add_balance" }
  | { flow: "edit_number"; key: "zain" | "asiacell" | "qicard"; label: string };

const userState = new Map<number, AdminFlow>();

// ─── TELEGRAM API HELPERS ────────────────────────────────────────────────────
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

async function sendMessage(
  chatId: number | string,
  text: string,
  extra?: Record<string, unknown>
) {
  return tgRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  extra?: Record<string, unknown>
) {
  return tgRequest("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function editMarkup(chatId: number | string, messageId: number, markup: object) {
  return tgRequest("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: markup,
  });
}

async function answerCallback(callbackId: string, text: string, alert = false) {
  return tgRequest("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: alert,
  });
}

// ─── SECURITY CHECK ───────────────────────────────────────────────────────────
function isAdmin(fromId: number): boolean {
  if (!ADMIN_ID) return true; // if no admin ID set, allow all (dev mode)
  return fromId === ADMIN_ID;
}

// ─── KEYBOARDS ───────────────────────────────────────────────────────────────
const PERSISTENT_KEYBOARD = {
  keyboard: [
    ["📊 الإحصائيات",      "💰 الأرباح"],
    ["📥 الطلبات المعلقة", "👥 المستخدمين"],
    ["➕ إضافة رصيد",      "⚙️ تعديل الأرقام"],
    ["🔄 تحديث"],
  ],
  resize_keyboard: true,
  persistent: true,
  is_persistent: true,
};

const MAIN_MENU = {
  inline_keyboard: [
    [
      { text: "📊 الإحصائيات",     callback_data: "stats"        },
      { text: "💰 الأرباح",        callback_data: "revenue"      },
    ],
    [
      { text: "📥 الطلبات المعلقة", callback_data: "payments"    },
      { text: "👥 المستخدمين",     callback_data: "users"        },
    ],
    [
      { text: "⚙️ تعديل الأرقام",  callback_data: "edit_numbers" },
      { text: "➕ إضافة رصيد",     callback_data: "add_balance"  },
    ],
    [
      { text: "🔄 تحديث",          callback_data: "refresh"      },
    ],
  ],
};

const EDIT_NUMBERS_MENU = {
  inline_keyboard: [
    [{ text: "📱 زين كاش",   callback_data: "edit_zain"      }],
    [{ text: "📞 آسياسيل",  callback_data: "edit_asiacell"  }],
    [{ text: "💳 QiCard",   callback_data: "edit_qicard"    }],
    [{ text: "🔙 رجوع",     callback_data: "back_main"      }],
  ],
};

// ─── ADMIN STATS (uses Drizzle for accurate counts) ──────────────────────────
async function getStats() {
  try {
    const [usersRow] = await drizzleDb.select({ total: drizzleCount() }).from(usersTable);
    const [allPayRow] = await drizzleDb.select({ total: drizzleCount() }).from(paymentsTable);
    const [pendingRow] = await drizzleDb.select({ total: drizzleCount() }).from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"));
    const [approvedRow] = await drizzleDb.select({ rev: drizzleSum(paymentsTable.amount) }).from(paymentsTable)
      .where(eq(paymentsTable.status, "approved"));
    return {
      totalUsers:    usersRow?.total    || 0,
      totalPayments: allPayRow?.total   || 0,
      pendingCount:  pendingRow?.total  || 0,
      totalRevenue:  Number(approvedRow?.rev || 0),
    };
  } catch (err) {
    console.error("[TG] getStats error:", err);
    return null;
  }
}

async function sendStats(chatId: number | string) {
  const stats = await getStats();
  if (!stats) { await sendMessage(chatId, "⚠️ تعذر الاتصال بقاعدة البيانات"); return; }
  const text = [
    "📊 <b>إحصائيات النظام</b>",
    "",
    `👥 إجمالي المستخدمين:     <b>${stats.totalUsers}</b>`,
    `📥 إجمالي طلبات الشحن:    <b>${stats.totalPayments}</b>`,
    `⏳ طلبات معلقة:           <b>${stats.pendingCount}</b>`,
    `💰 إجمالي الأرباح:         <b>${stats.totalRevenue.toLocaleString()} IQD</b>`,
    "",
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");
  await sendMessage(chatId, text, { reply_markup: MAIN_MENU });
}

// ─── REVENUE REPORT ──────────────────────────────────────────────────────────
async function sendRevenue(chatId: number | string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allPayments = await drizzleDb.select().from(paymentsTable);
    const approved  = allPayments.filter(p => p.status === "approved");
    const todayApproved = approved.filter(p => new Date(p.createdAt) >= today);
    const pending   = allPayments.filter(p => p.status === "pending");
    const rejected  = allPayments.filter(p => p.status === "rejected");

    const totalRev = approved.reduce((s, p) => s + parseFloat(p.amount), 0);
    const todayRev = todayApproved.reduce((s, p) => s + parseFloat(p.amount), 0);

    const text = [
      "💰 <b>تقرير الأرباح</b>",
      "",
      `📅 إيرادات اليوم:    <b>${todayRev.toLocaleString()} IQD</b>`,
      `📈 إجمالي الإيرادات: <b>${totalRev.toLocaleString()} IQD</b>`,
      "",
      `✅ مقبولة:  <b>${approved.length}</b>`,
      `⏳ معلقة:   <b>${pending.length}</b>`,
      `❌ مرفوضة: <b>${rejected.length}</b>`,
      "",
      `🕐 ${new Date().toLocaleString("ar-IQ")}`,
    ].join("\n");
    await sendMessage(chatId, text, { reply_markup: MAIN_MENU });
  } catch (err) {
    console.error("[TG] sendRevenue error:", err);
    await sendMessage(chatId, "⚠️ خطأ في تحميل تقرير الأرباح");
  }
}

// ─── PENDING PAYMENTS LIST ───────────────────────────────────────────────────
async function sendPaymentsList(chatId: number | string) {
  try {
    const pendingPayments = await drizzleDb.select({
      payment: paymentsTable,
      user: usersTable,
    })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .where(eq(paymentsTable.status, "pending"))
    .limit(10);

    if (pendingPayments.length === 0) {
      await sendMessage(chatId, "✅ لا توجد طلبات شحن معلقة حالياً", { reply_markup: MAIN_MENU });
      return;
    }

    const methodLabel: Record<string, string> = {
      zaincash: "زين كاش 💳", asiahawala: "آسياسيل 📱", stripe: "Stripe 💳",
    };

    await sendMessage(chatId, `📥 <b>${pendingPayments.length} طلب شحن معلق</b>\n━━━━━━━━━━━━━━━━`);

    for (const { payment: pay, user } of pendingPayments) {
      const lines = [
        `🆔 <b>طلب رقم:</b> #${pay.id}`,
        `👤 <b>المستخدم:</b> ${user?.name || user?.email || "مجهول"}`,
        `💰 <b>المبلغ:</b> ${parseFloat(pay.amount).toLocaleString()} IQD`,
        `💳 <b>الطريقة:</b> ${methodLabel[pay.method] || pay.method}`,
        pay.transactionId ? `🧾 <b>TXID:</b> <code>${pay.transactionId}</code>` : null,
        pay.receiptUrl ? `📸 <a href="${pay.receiptUrl}">إثبات الدفع</a>` : null,
        `⏱ ${new Date(pay.createdAt).toLocaleString("ar-IQ")}`,
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
  } catch (err) {
    console.error("[TG] sendPaymentsList error:", err);
    await sendMessage(chatId, "⚠️ خطأ في تحميل قائمة الطلبات");
  }
}

// ─── USERS LIST ───────────────────────────────────────────────────────────────
async function sendUsers(chatId: number | string) {
  try {
    const users = await drizzleDb.select().from(usersTable).limit(10);
    const [totalRow] = await drizzleDb.select({ total: drizzleCount() }).from(usersTable);
    const total = totalRow?.total || 0;

    const lines = [`👥 <b>المستخدمون (إجمالي: ${total})</b>\n━━━━━━━━━━━━━━━━`];
    for (const u of users) {
      lines.push(
        `👤 ${u.name || "بدون اسم"}${u.role === "admin" ? " 🛡" : ""}`,
        `📧 ${u.email || "—"}`,
        `💰 ${parseFloat(u.balance).toLocaleString()} IQD`,
        `🆔 <code>#${u.id}</code>`,
        "─────────────",
      );
    }
    if (total > 10) lines.push(`… و ${total - 10} مستخدم آخر`);
    await sendMessage(chatId, lines.join("\n"), { reply_markup: MAIN_MENU });
  } catch (err) {
    console.error("[TG] sendUsers error:", err);
    await sendMessage(chatId, "⚠️ خطأ في تحميل قائمة المستخدمين");
  }
}

// ─── EDIT NUMBER: send sub-menu ───────────────────────────────────────────────
async function sendEditNumbersMenu(chatId: number | string) {
  await sendMessage(chatId, [
    "⚙️ <b>تعديل أرقام الدفع</b>",
    "",
    "اختر طريقة الدفع التي تريد تعديل رقمها:",
  ].join("\n"), { reply_markup: EDIT_NUMBERS_MENU });
}

// ─── EDIT NUMBER: prompt after selecting which number ────────────────────────
async function promptEditNumber(
  chatId: number | string,
  fromId: number,
  key: "zain" | "asiacell" | "qicard",
) {
  const labels: Record<string, string> = { zain: "زين كاش", asiacell: "آسياسيل", qicard: "QiCard" };
  const label = labels[key];
  userState.set(fromId, { flow: "edit_number", key, label });
  await sendMessage(chatId, [
    `📝 <b>تعديل رقم ${label}</b>`,
    "",
    "أرسل الرقم الجديد:",
    "<i>(أو أرسل /cancel للإلغاء)</i>",
  ].join("\n"));
}

// ─── EDIT NUMBER: process submitted number ────────────────────────────────────
async function processEditNumber(
  chatId: number | string,
  fromId: number,
  state: { flow: "edit_number"; key: string; label: string },
  text: string,
) {
  userState.delete(fromId);
  const newNumber = text.trim();

  if (!newNumber || newNumber.length < 6) {
    await sendMessage(chatId, "❌ الرقم غير صالح. يجب أن يكون على الأقل 6 أرقام.", { reply_markup: MAIN_MENU });
    return;
  }

  if (!db) { await sendMessage(chatId, "⚠️ قاعدة البيانات غير متاحة"); return; }

  const { error } = await db
    .from("payment_settings")
    .upsert(
      { key: state.key, value: newNumber, label: state.label, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    console.error(`[TG] editNumber ${state.key} error:`, error.message);
    await sendMessage(chatId, `❌ فشل التحديث: ${error.message}`, { reply_markup: MAIN_MENU });
    return;
  }

  console.log(`[TG] ✅ Updated ${state.key} → ${newNumber}`);
  await sendMessage(chatId, [
    `✅ <b>تم تحديث رقم ${state.label} بنجاح!</b>`,
    "",
    `الرقم الجديد: <code>${newNumber}</code>`,
    "",
    "سيظهر الرقم الجديد للمستخدمين فوراً 🔄",
  ].join("\n"), { reply_markup: MAIN_MENU });
}

// ─── ADD BALANCE: prompt ──────────────────────────────────────────────────────
async function promptAddBalance(chatId: number | string, fromId: number) {
  userState.set(fromId, { flow: "add_balance" });
  await sendMessage(chatId, [
    "➕ <b>إضافة رصيد يدوياً</b>",
    "",
    "أرسل: <code>رقم_المستخدم المبلغ</code>",
    "",
    "مثال (رقم المستخدم من الجدول):",
    "<code>42 5000</code>",
    "",
    "<i>أو /cancel للإلغاء</i>",
  ].join("\n"));
}

// ─── ADD BALANCE: process (uses Drizzle) ──────────────────────────────────────
async function processAddBalance(chatId: number | string, fromId: number, text: string) {
  userState.delete(fromId);

  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendMessage(chatId, "❌ صيغة خاطئة.\nأرسل: <code>رقم_المستخدم المبلغ</code>", { reply_markup: MAIN_MENU });
    return;
  }
  const userId = parseInt(parts[0]);
  const amount = Number(parts[1]);
  if (isNaN(userId) || userId <= 0 || isNaN(amount) || amount <= 0) {
    await sendMessage(chatId, "❌ رقم المستخدم أو المبلغ غير صحيح.", { reply_markup: MAIN_MENU });
    return;
  }

  try {
    const [user] = await drizzleDb.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      await sendMessage(chatId, `❌ لم يتم إيجاد مستخدم برقم: <code>${userId}</code>`, { reply_markup: MAIN_MENU });
      return;
    }

    const oldBalance = parseFloat(user.balance);
    const newBalance = oldBalance + amount;
    await drizzleDb.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, userId));

    console.log(`[TG] ✅ Added ${amount} IQD to user #${userId}. New balance: ${newBalance}`);
    await sendMessage(chatId, [
      "✅ <b>تم إضافة الرصيد بنجاح</b>",
      "",
      `👤 ${user.name || user.email}`,
      `🆔 رقم المستخدم: #${userId}`,
      `💰 السابق: <b>${oldBalance.toLocaleString()} IQD</b>`,
      `➕ المضاف: <b>${amount.toLocaleString()} IQD</b>`,
      `💳 الجديد: <b>${newBalance.toLocaleString()} IQD</b>`,
    ].join("\n"), { reply_markup: MAIN_MENU });
  } catch (err) {
    console.error("[TG] processAddBalance error:", err);
    await sendMessage(chatId, `❌ خطأ: ${err instanceof Error ? err.message : String(err)}`, { reply_markup: MAIN_MENU });
  }
}

// ─── APPROVE / REJECT PAYMENT ────────────────────────────────────────────────
// Uses Drizzle ORM (Replit PostgreSQL) — the actual payments & users tables
async function approvePayment(paymentId: string, adminName: string): Promise<string> {
  try {
    const id = parseInt(paymentId);
    if (isNaN(id)) return `❌ معرف طلب غير صالح: ${paymentId}`;

    const [payment] = await drizzleDb.select().from(paymentsTable).where(eq(paymentsTable.id, id)).limit(1);
    if (!payment) return `❌ الطلب غير موجود (#${id})`;
    if (payment.status !== "pending") return `⚠️ الطلب معالَج مسبقاً: ${payment.status}`;

    const [user] = await drizzleDb.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
    if (!user) return `❌ المستخدم غير موجود (${payment.userId})`;

    const newBalance = parseFloat(user.balance) + parseFloat(payment.amount);
    await drizzleDb.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, payment.userId));
    await drizzleDb.update(paymentsTable).set({ status: "approved" }).where(eq(paymentsTable.id, id));

    console.log(`[TG] ✅ Approved #${id} — +${payment.amount} IQD → user ${payment.userId} (new balance: ${newBalance})`);
    return [
      `💰 <b>المبلغ المُضاف:</b> ${parseFloat(payment.amount).toLocaleString()} IQD`,
      `👤 <b>المستخدم:</b> ${user.name || user.email}`,
      `💳 <b>الرصيد الجديد:</b> ${newBalance.toLocaleString()} IQD`,
      `🆔 <b>طلب رقم:</b> #${id}`,
      `✅ <b>بواسطة:</b> ${adminName}`,
    ].join("\n");
  } catch (err) {
    console.error("[TG] approvePayment error:", err);
    return `❌ خطأ في المعالجة: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function rejectPayment(paymentId: string, adminName: string): Promise<string> {
  try {
    const id = parseInt(paymentId);
    if (isNaN(id)) return `❌ معرف طلب غير صالح: ${paymentId}`;

    const [payment] = await drizzleDb.select().from(paymentsTable).where(eq(paymentsTable.id, id)).limit(1);
    if (!payment) return `❌ الطلب غير موجود (#${id})`;
    if (payment.status !== "pending") return `⚠️ الطلب معالَج مسبقاً: ${payment.status}`;

    await drizzleDb.update(paymentsTable).set({ status: "rejected" }).where(eq(paymentsTable.id, id));

    console.log(`[TG] ❌ Rejected #${id} by ${adminName}`);
    return [
      `🆔 <b>طلب رقم:</b> #${id}`,
      `💰 <b>المبلغ:</b> ${parseFloat(payment.amount).toLocaleString()} IQD`,
      `❌ <b>تم الرفض بواسطة:</b> ${adminName}`,
    ].join("\n");
  } catch (err) {
    console.error("[TG] rejectPayment error:", err);
    return `❌ خطأ في المعالجة: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── /setnumbers COMMAND ──────────────────────────────────────────────────────
// Usage: /setnumbers [zain] [asiacell] [qicard]
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
    const { error } = await db
      .from("payment_settings")
      .upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      results.push(`❌ ${u.label}: ${error.message}`);
      hasError = true;
    } else {
      results.push(`✅ ${u.label}: <code>${u.value}</code>`);
    }
  }
  const summary = hasError ? "⚠️ <b>تم التحديث مع بعض الأخطاء</b>" : "✅ <b>تم تحديث جميع أرقام الدفع!</b>";
  await sendMessage(chatId, [summary, "", ...results, "", "🔄 الأرقام الجديدة مفعّلة فوراً."].join("\n"), { reply_markup: MAIN_MENU });
  console.log(`[TG] /setnumbers zain=${zain}, asiacell=${asiacell}, qicard=${qicard}`);
}

// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────
async function handleMessage(chatId: number, fromId: number, fromName: string, text: string) {
  // Security gate — admin only
  if (!isAdmin(fromId)) {
    await sendMessage(chatId, "❌ هذا الأمر مخصص للأدمن فقط.");
    console.warn(`[TG] ⛔ Unauthorized message from ${fromId} (${fromName})`);
    return;
  }

  const state = userState.get(fromId);

  // /cancel — abort any flow
  if (text === "/cancel") {
    userState.delete(fromId);
    await sendMessage(chatId, "✖️ تم الإلغاء", { reply_markup: MAIN_MENU });
    return;
  }

  // /start or /menu
  if (text === "/start" || text === "/menu") {
    userState.delete(fromId);
    await sendMessage(chatId,
      `👋 أهلاً <b>${fromName}</b>!\n\n🤖 <b>Boost Iraq — لوحة تحكم الأدمن</b>\n\nستظهر أزرار القائمة أدناه. اختر إجراءً:`,
      { reply_markup: PERSISTENT_KEYBOARD }
    );
    await sendStats(chatId);
    return;
  }

  // /stats
  if (text === "/stats") { await sendStats(chatId); return; }

  // /setnumbers
  if (text.startsWith("/setnumbers")) { await handleSetNumbers(chatId, text); return; }

  // ── Handle persistent keyboard button texts ────────────────────────────────
  const KEYBOARD_MAP: Record<string, () => Promise<void>> = {
    "📊 الإحصائيات":      () => sendStats(chatId),
    "💰 الأرباح":         () => sendRevenue(chatId),
    "📥 الطلبات المعلقة": () => sendPaymentsList(chatId),
    "👥 المستخدمين":      () => sendUsers(chatId),
    "🔄 تحديث":           () => sendStats(chatId),
    "➕ إضافة رصيد":      () => promptAddBalance(chatId, fromId),
    "⚙️ تعديل الأرقام":  () => sendEditNumbersMenu(chatId),
  };
  if (KEYBOARD_MAP[text]) {
    await KEYBOARD_MAP[text]();
    return;
  }

  // Multi-step flow: edit_number
  if (state?.flow === "edit_number") {
    await processEditNumber(chatId, fromId, state, text);
    return;
  }

  // Multi-step flow: add_balance
  if (state?.flow === "add_balance") {
    await processAddBalance(chatId, fromId, text);
    return;
  }

  // Default
  await sendMessage(chatId, "اختر إجراءً من القائمة:", { reply_markup: MAIN_MENU });
}

// ─── CALLBACK HANDLER ─────────────────────────────────────────────────────────
async function handleCallback(
  callbackId: string,
  from: { id: number; first_name?: string; username?: string },
  data: string,
  message?: { message_id: number; chat: { id: number } }
) {
  const chatId   = message?.chat.id ?? from.id;
  const msgId    = message?.message_id;
  const fromName = from.first_name || from.username || "المدير";

  // Security gate — admin only
  if (!isAdmin(from.id)) {
    await answerCallback(callbackId, "❌ هذا الأمر مخصص للأدمن فقط", true);
    console.warn(`[TG] ⛔ Unauthorized callback "${data}" from ${from.id}`);
    return;
  }

  console.log(`[TG] Callback: "${data}" from ${fromName} (${from.id})`);

  // ── Already processed ──────────────────────────────────────────────────────
  if (data === "done") {
    await answerCallback(callbackId, "✅ تمت المعالجة مسبقاً");
    return;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  if (data === "stats" || data === "refresh") {
    await answerCallback(callbackId, "جاري التحميل...");
    await sendStats(chatId);
    return;
  }
  if (data === "revenue") {
    await answerCallback(callbackId, "جاري التحميل...");
    await sendRevenue(chatId);
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
  if (data === "add_balance") {
    await answerCallback(callbackId, "");
    await promptAddBalance(chatId, from.id);
    return;
  }
  if (data === "back_main") {
    await answerCallback(callbackId, "");
    await sendMessage(chatId, "اختر إجراءً:", { reply_markup: MAIN_MENU });
    return;
  }

  // ── ⚙️ Edit Numbers: show sub-menu ─────────────────────────────────────────
  if (data === "edit_numbers") {
    await answerCallback(callbackId, "");
    await sendEditNumbersMenu(chatId);
    return;
  }

  // ── Edit specific number ────────────────────────────────────────────────────
  if (data === "edit_zain") {
    await answerCallback(callbackId, "");
    await promptEditNumber(chatId, from.id, "zain");
    return;
  }
  if (data === "edit_asiacell") {
    await answerCallback(callbackId, "");
    await promptEditNumber(chatId, from.id, "asiacell");
    return;
  }
  if (data === "edit_qicard") {
    await answerCallback(callbackId, "");
    await promptEditNumber(chatId, from.id, "qicard");
    return;
  }

  // ── Approve payment ─────────────────────────────────────────────────────────
  if (data.startsWith("approve_")) {
    const paymentId = data.slice("approve_".length);
    await answerCallback(callbackId, "✅ جاري القبول...");
    const result = await approvePayment(paymentId, fromName);
    // Edit the original payment message to show approved status
    if (msgId) {
      await editMessage(chatId, msgId,
        [
          "✅ <b>تم القبول بنجاح</b>",
          "",
          result,
          "",
          `🕐 ${new Date().toLocaleString("ar-IQ")}`,
        ].join("\n"),
        {
          reply_markup: {
            inline_keyboard: [[
              { text: `✅ تم القبول بواسطة ${fromName}`, callback_data: "done" },
            ]],
          },
        }
      );
    }
    return;
  }

  // ── Reject payment ──────────────────────────────────────────────────────────
  if (data.startsWith("reject_")) {
    const paymentId = data.slice("reject_".length);
    await answerCallback(callbackId, "❌ جاري الرفض...");
    const result = await rejectPayment(paymentId, fromName);
    // Edit the original payment message to show rejected status
    if (msgId) {
      await editMessage(chatId, msgId,
        [
          "❌ <b>تم الرفض</b>",
          "",
          result,
          "",
          `🕐 ${new Date().toLocaleString("ar-IQ")}`,
        ].join("\n"),
        {
          reply_markup: {
            inline_keyboard: [[
              { text: `❌ تم الرفض بواسطة ${fromName}`, callback_data: "done" },
            ]],
          },
        }
      );
    }
    return;
  }

  await answerCallback(callbackId, "⚠️ طلب غير معروف");
}

// ─── POST /api/telegram/webhook ──────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  res.json({ ok: true }); // Always respond 200 immediately

  const update = req.body as TelegramUpdate;
  console.log("[TG Webhook] Update:", JSON.stringify(update).slice(0, 400));

  try {
    // ── Handle text messages ────────────────────────────────────────────────
    if (update.message) {
      const { from, chat, text } = update.message;
      if (!from?.id || !chat?.id || !text) return;
      await handleMessage(chat.id, from.id, from.first_name || from.username || "مستخدم", text);
      return;
    }

    // ── Handle button presses ───────────────────────────────────────────────
    if (update.callback_query) {
      const { id: cbId, from, data, message } = update.callback_query;
      if (!from?.id || !data) return;
      await handleCallback(cbId, from, data, message);
      return;
    }

  } catch (err) {
    console.error("[TG Webhook] Unhandled error:", err);
    if (ADMIN_ID) {
      await sendMessage(ADMIN_ID, `⚠️ خطأ:\n<code>${err instanceof Error ? err.message : String(err)}</code>`).catch(() => {});
    }
  }
});

// ─── POST /api/telegram/payment-notify ───────────────────────────────────────
// Called by frontend when a user submits a payment request
router.post("/payment-notify", async (req, res) => {
  const { id, email, amount, method, transaction_id, proof_url, notes } = req.body as {
    id: string; email: string; amount: number; method: string;
    transaction_id?: string; proof_url?: string; notes?: string;
  };
  console.log("[TG] Payment notify:", { id, email, amount, method });

  const methodLabel: Record<string, string> = {
    zaincash: "زين كاش 💳", asiacell: "آسياسيل 📱", qicard: "QiCard 💰", manual: "يدوي 🏦",
  };
  const text = [
    "🚀 <b>طلب شحن جديد!</b>",
    "",
    `👤 <b>المستخدم:</b> ${email}`,
    `💰 <b>المبلغ:</b> <code>${Number(amount).toLocaleString()} IQD</code>`,
    `💳 <b>الطريقة:</b> ${methodLabel[method] || method}`,
    transaction_id ? `🔢 <b>TXID:</b> <code>${transaction_id}</code>` : null,
    proof_url ? `📸 <b>إثبات:</b> <a href="${proof_url}">عرض الصورة</a>` : null,
    notes ? `📝 <b>ملاحظات:</b> ${notes}` : null,
    "",
    `🆔 <code>${String(id).slice(0, 8)}…</code>`,
    `⏱ ${new Date().toLocaleString("ar-IQ")}`,
  ].filter(Boolean).join("\n");

  const markup = {
    inline_keyboard: [[
      { text: "✅ قبول",   callback_data: `approve_${id}` },
      { text: "❌ رفض",    callback_data: `reject_${id}`  },
    ]],
  };

  const notifChat = CHAT_ID || String(ADMIN_ID);
  if (notifChat) await sendMessage(notifChat, text, { reply_markup: markup });

  res.json({ ok: true });
});

// ─── POST /api/telegram/payment-approved ─────────────────────────────────────
router.post("/payment-approved", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const notifChat = CHAT_ID || String(ADMIN_ID);
  if (notifChat) {
    await sendMessage(notifChat, `✅ <b>تم قبول شحن</b>\n👤 ${email}\n💰 ${Number(amount).toLocaleString()} IQD`);
  }
  res.json({ ok: true });
});

// ─── POST /api/telegram/payment-rejected ─────────────────────────────────────
router.post("/payment-rejected", async (req, res) => {
  const { email, amount } = req.body as { email: string; amount: number };
  const notifChat = CHAT_ID || String(ADMIN_ID);
  if (notifChat) {
    await sendMessage(notifChat, `❌ <b>تم رفض شحن</b>\n👤 ${email}\n💰 ${Number(amount).toLocaleString()} IQD`);
  }
  res.json({ ok: true });
});

// ─── POST /api/telegram/setup-webhook ────────────────────────────────────────
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

// ─── GET /api/telegram/webhook-info ──────────────────────────────────────────
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

// ─── TYPES ────────────────────────────────────────────────────────────────────
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
