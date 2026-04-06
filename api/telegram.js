/**
 * ═══════════════════════════════════════════════════════════════
 *  Boost Iraq — Admin Telegram Bot  (Vercel Serverless)
 * ═══════════════════════════════════════════════════════════════
 *
 *  ⚠️  IMPORTANT: Webhook URL MUST be your PRODUCTION Vercel URL:
 *     https://your-project.vercel.app/api/telegram
 *
 *  NEVER use preview URLs (with hash like ek9v5josz) — Vercel
 *  adds Deployment Protection to previews → Telegram gets 401!
 *
 *  Set webhook (one time):
 *  curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://YOUR_PRODUCTION_DOMAIN/api/telegram"
 *
 *  Commands:
 *    /start                         — Main menu
 *    /pending                       — Pending payments
 *    /approve {payment_id}          — Approve payment
 *    /reject  {payment_id}          — Reject payment
 *    /balance {user_id}             — Check balance
 *    /addbalance {user_id} {amount} — Add balance
 *    /deduct  {user_id} {amount}    — Deduct balance
 *    /setnumber zain|asiacell|qicard {number} — Edit payment numbers
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Vercel config: enable body parser, allow 30s for async work ──────────────
export const config = {
  api: {
    bodyParser: true,
  },
  maxDuration: 30,
};

import {
  setCors, sbSelect, sbUpdate, sbInsert, sbCount,
  TELEGRAM_TOKEN, SERVICE_KEY, SUPABASE_URL, followizCall,
} from "./_utils.js";

// ─── Config ──────────────────────────────────────────────────────────────────
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_ID || "6460074022")
  .split(",").map(s => String(s.trim()).replace(/\D/g, "")).filter(Boolean);

// ─── Telegram API ─────────────────────────────────────────────────────────────
async function tg(method, body) {
  if (!TELEGRAM_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) console.warn(`[TG] ${method} failed:`, json.description?.slice(0, 100));
    return json.result ?? null;
  } catch (e) {
    console.error(`[TG] ${method} error:`, e.message);
    return null;
  }
}

const send = (chatId, text, kb) =>
  tg("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(kb ? { reply_markup: kb } : {}),
  });

const edit = (chatId, msgId, text, kb) =>
  tg("editMessageText", {
    chat_id: chatId, message_id: msgId, text, parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(kb ? { reply_markup: kb } : {}),
  });

const answer = (cbId, text = "", alert = false) =>
  tg("answerCallbackQuery", { callback_query_id: cbId, text, show_alert: alert });

const editKb = (chatId, msgId, kb) =>
  tg("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: kb });

// ─── Keyboards ────────────────────────────────────────────────────────────────
const MAIN_KB = {
  inline_keyboard: [
    [
      { text: "📊 الإحصائيات",      callback_data: "stats"        },
      { text: "💰 الأرباح",         callback_data: "revenue"      },
    ],
    [
      { text: "📥 الطلبات المعلقة", callback_data: "payments"     },
      { text: "👥 المستخدمين",      callback_data: "users"        },
    ],
    [
      { text: "⚙️ أرقام الدفع",     callback_data: "numbers"      },
      { text: "📈 نسبة الربح",      callback_data: "markup_view"  },
    ],
    [
      { text: "➕ إضافة رصيد",      callback_data: "add_help"     },
      { text: "📢 إشعار عام",       callback_data: "broadcast"    },
    ],
    [{ text: "🔄 تحديث",            callback_data: "refresh"      }],
  ],
};

const BACK_KB = { inline_keyboard: [[{ text: "🔙 القائمة الرئيسية", callback_data: "main" }]] };

const REPLY_KB = {
  keyboard: [
    [{ text: "📊 الإحصائيات" }, { text: "💰 الأرباح" }],
    [{ text: "📥 الطلبات المعلقة" }, { text: "👥 المستخدمين" }],
    [{ text: "📈 نسبة الربح" }, { text: "⚙️ أرقام الدفع" }],
    [{ text: "➕ إضافة رصيد" }, { text: "📢 إشعار عام" }],
    [{ text: "🔄 تحديث" }],
  ],
  resize_keyboard: true,
  persistent: true,
};

// ─── Markup Picker Keyboard ───────────────────────────────────────────────────
const MARKUP_KB = {
  inline_keyboard: [
    [
      { text: "20%",  callback_data: "mk_20"  },
      { text: "30%",  callback_data: "mk_30"  },
      { text: "40%",  callback_data: "mk_40"  },
    ],
    [
      { text: "50%",  callback_data: "mk_50"  },
      { text: "60%",  callback_data: "mk_60"  },
      { text: "75%",  callback_data: "mk_75"  },
    ],
    [
      { text: "100%", callback_data: "mk_100" },
      { text: "150%", callback_data: "mk_150" },
      { text: "200%", callback_data: "mk_200" },
    ],
    [{ text: "✏️ رقم مخصص — أرسل: /setmarkup 45", callback_data: "mk_custom_help" }],
    [{ text: "🔙 رجوع", callback_data: "markup_view" }],
  ],
};

const NUMBERS_KB = {
  inline_keyboard: [
    [{ text: "📱 زين كاش",  callback_data: "num_zain"      }],
    [{ text: "📞 آسياسيل",  callback_data: "num_asiacell"  }],
    [{ text: "💳 QiCard",   callback_data: "num_qicard"    }],
    [{ text: "🔙 رجوع",     callback_data: "main"          }],
  ],
};

// ─── Supabase Helpers ─────────────────────────────────────────────────────────

/** رصيد مستخدم من profiles */
async function getBalance(userId) {
  const rows = await sbSelect("profiles", `id=eq.${userId}&select=balance,name,email`);
  return rows?.[0] ?? null;
}

/** تحديث الرصيد (قراءة ثم كتابة — آمن للعمليات الإدارية) */
async function updateBalance(userId, delta) {
  const profile = await getBalance(userId);
  if (!profile) throw new Error(`لم أجد المستخدم: ${userId.slice(0, 8)}…`);
  const newBalance = Math.max(0, Number(profile.balance ?? 0) + delta);
  await sbUpdate("profiles", `id=eq.${userId}`, { balance: newBalance });
  return { oldBalance: Number(profile.balance ?? 0), newBalance, profile };
}

/** إضافة إشعار (يتجاهل الخطأ إن كان الجدول غير موجود) */
async function tryNotify(userId, title, message) {
  try {
    await sbInsert("notifications", { user_id: userId, title, message, is_read: false });
  } catch (e) {
    console.warn("[TG] notify skip:", e.message.slice(0, 80));
  }
}

/** إحصائيات عامة */
async function fetchStats() {
  const [users, all, pending, approved] = await Promise.all([
    sbCount("profiles"),
    sbCount("payments"),
    sbCount("payments", "status=eq.pending"),
    sbSelect("payments", "status=eq.approved&select=amount").catch(() => []),
  ]);
  const revenue = (Array.isArray(approved) ? approved : [])
    .reduce((s, p) => s + Number(p.amount), 0);
  return { users, all, pending, revenue };
}

/** قائمة الطلبات المعلقة */
async function fetchPending() {
  return sbSelect(
    "payments",
    "status=eq.pending&select=id,amount,method,transaction_id,proof_url,notes,user_id,created_at&order=created_at.desc&limit=10"
  ).catch(() => []);
}

/** قائمة المستخدمين الأحدث */
async function fetchUsers() {
  return sbSelect(
    "profiles",
    "select=id,name,email,balance,role,created_at&order=created_at.desc&limit=10"
  ).catch(() => []);
}

/** إيرادات مفصّلة */
async function fetchRevenue() {
  const today = new Date().toISOString().slice(0, 10);
  const [allApproved, todayRows, pending, rejected] = await Promise.all([
    sbSelect("payments", "status=eq.approved&select=amount").catch(() => []),
    sbSelect("payments", `status=eq.approved&created_at=gte.${today}&select=amount`).catch(() => []),
    sbSelect("payments", "status=eq.pending&select=id&limit=1").then(r => r?.length ?? 0).catch(() => 0),
    sbSelect("payments", "status=eq.rejected&select=id&limit=1").then(r => r?.length ?? 0).catch(() => 0),
  ]);
  const total   = allApproved.reduce((s, p) => s + Number(p.amount), 0);
  const todayRev= todayRows.reduce((s, p)   => s + Number(p.amount), 0);
  return { total, todayRev, approvedCount: allApproved.length, pending, rejected };
}

/** أرقام الدفع الحالية */
async function fetchNumbers() {
  return sbSelect("payment_settings", "select=key,value").catch(() => []);
}

// ─── Show Screens ─────────────────────────────────────────────────────────────

async function showMain(chatId, msgId = null) {
  const text = [
    "🚀 <b>لوحة إدارة Boost Iraq</b>",
    "",
    "اختر من القائمة أدناه:",
  ].join("\n");
  if (msgId) {
    await edit(chatId, msgId, text, MAIN_KB);
  } else {
    // إرسال الكيبورد الثابت أولاً ثم القائمة الـ inline
    await send(chatId, "⌨️ جاهز!", REPLY_KB);
    await send(chatId, text, MAIN_KB);
  }
}

async function showStats(chatId, msgId = null) {
  const s = await fetchStats();
  const text = [
    "📊 <b>إحصائيات النظام</b>",
    "═══════════════════",
    `👥 المستخدمون:        <b>${s.users}</b>`,
    `📥 إجمالي الطلبات:   <b>${s.all}</b>`,
    `⏳ طلبات معلقة:      <b>${s.pending}</b>`,
    `💰 إجمالي الأرباح:   <b>${s.revenue.toLocaleString("ar-IQ")} IQD</b>`,
    "",
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");
  const kb = { inline_keyboard: [[{ text: "🔄 تحديث", callback_data: "stats" }], [{ text: "🔙 رجوع", callback_data: "main" }]] };
  if (msgId) await edit(chatId, msgId, text, kb);
  else        await send(chatId, text, kb);
}

async function showRevenue(chatId, msgId = null) {
  const r = await fetchRevenue();
  const text = [
    "💰 <b>تقرير الأرباح</b>",
    "═══════════════════",
    `📅 اليوم:            <b>${r.todayRev.toLocaleString("ar-IQ")} IQD</b>`,
    `📈 الإجمالي:         <b>${r.total.toLocaleString("ar-IQ")} IQD</b>`,
    "",
    `✅ مقبولة:           <b>${r.approvedCount}</b>`,
    `⏳ معلقة:            <b>${r.pending}</b>`,
    `❌ مرفوضة:          <b>${r.rejected}</b>`,
    "",
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");
  const kb = { inline_keyboard: [[{ text: "🔄 تحديث", callback_data: "revenue" }], [{ text: "🔙 رجوع", callback_data: "main" }]] };
  if (msgId) await edit(chatId, msgId, text, kb);
  else        await send(chatId, text, kb);
}

async function showPending(chatId, msgId = null) {
  const rows = await fetchPending();
  if (!rows.length) {
    const text = "✅ <b>لا توجد طلبات معلقة</b>";
    const kb = { inline_keyboard: [[{ text: "🔄 تحديث", callback_data: "payments" }], [{ text: "🔙 رجوع", callback_data: "main" }]] };
    if (msgId) await edit(chatId, msgId, text, kb);
    else        await send(chatId, text, kb);
    return;
  }

  const header = `📥 <b>الطلبات المعلقة (${rows.length})</b>\n═══════════════════`;
  const kb = {
    inline_keyboard: [
      ...rows.map(p => [
        { text: `💵 ${Number(p.amount).toLocaleString()} IQD — ${p.method}`, callback_data: `pinfo:${p.id}` },
      ]),
      [{ text: "🔄 تحديث", callback_data: "payments" }, { text: "🔙 رجوع", callback_data: "main" }],
    ],
  };
  if (msgId) await edit(chatId, msgId, header, kb);
  else        await send(chatId, header, kb);
}

async function showPaymentDetail(chatId, msgId, paymentId) {
  const rows = await sbSelect("payments", `id=eq.${paymentId}&select=*`).catch(() => []);
  const p = rows?.[0];
  if (!p) {
    await answer(null, "❌ الطلب غير موجود");
    return;
  }
  const text = [
    `💳 <b>تفاصيل طلب الشحن</b>`,
    "═══════════════════",
    `🆔 <code>${p.id}</code>`,
    `💵 المبلغ:     <b>${Number(p.amount).toLocaleString()} IQD</b>`,
    `📲 الطريقة:    <b>${p.method}</b>`,
    p.transaction_id ? `🔖 العملية:   <code>${p.transaction_id}</code>` : null,
    p.notes ? `📝 ملاحظة:   ${p.notes}` : null,
    p.proof_url ? `🖼 <a href="${p.proof_url}">صورة الإثبات</a>` : null,
    `📅 التاريخ:   ${new Date(p.created_at).toLocaleString("ar-IQ")}`,
    `⚡ الحالة:    <b>${p.status}</b>`,
  ].filter(Boolean).join("\n");

  const kb = p.status === "pending" ? {
    inline_keyboard: [
      [
        { text: "✅ قبول",            callback_data: `approve:${p.id}` },
        { text: "❌ رفض",             callback_data: `reject:${p.id}`  },
      ],
      [
        { text: "🔙 الطلبات المعلقة", callback_data: "payments"       },
      ],
    ],
  } : BACK_KB;

  if (msgId) await edit(chatId, msgId, text, kb);
  else        await send(chatId, text, kb);
}

async function showUsers(chatId, msgId = null) {
  const users = await fetchUsers();
  if (!users.length) {
    const text = "👥 لا يوجد مستخدمون حتى الآن.";
    if (msgId) await edit(chatId, msgId, text, BACK_KB);
    else        await send(chatId, text, BACK_KB);
    return;
  }
  const text = [
    `👥 <b>المستخدمون الأخيرون (${users.length})</b>`,
    "═══════════════════",
    ...users.map((u, i) =>
      `${i + 1}. ${u.name || u.email || "مجهول"} — 💰 <b>${Number(u.balance || 0).toLocaleString()} IQD</b>`
    ),
    "",
    "لعرض رصيد مستخدم بعينه:\n<code>/balance {user_id}</code>",
    "لإضافة رصيد:\n<code>/addbalance {user_id} {amount}</code>",
  ].join("\n");
  const kb = { inline_keyboard: [[{ text: "🔄 تحديث", callback_data: "users" }, { text: "🔙 رجوع", callback_data: "main" }]] };
  if (msgId) await edit(chatId, msgId, text, kb);
  else        await send(chatId, text, kb);
}

async function showNumbers(chatId, msgId = null) {
  const settings = await fetchNumbers();
  const map = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
  const text = [
    "⚙️ <b>أرقام الدفع الحالية</b>",
    "═══════════════════",
    `📱 زين كاش:   <code>${map.zaincash_number || map.zain || "—"}</code>`,
    `📞 آسياسيل:   <code>${map.asiacell_number || map.asiacell || "—"}</code>`,
    `💳 QiCard:    <code>${map.qicard_number   || map.qicard  || "—"}</code>`,
    "",
    "لتعديل رقم:",
    "<code>/setnumber zain 07XX XXX XXXX</code>",
    "<code>/setnumber asiacell 07XX XXX XXXX</code>",
    "<code>/setnumber qicard 1234 5678 9012</code>",
  ].join("\n");
  if (msgId) await edit(chatId, msgId, text, BACK_KB);
  else        await send(chatId, text, BACK_KB);
}

// ─── Profit Markup ────────────────────────────────────────────────────────────

async function getCurrentMarkup() {
  try {
    const rows = await sbSelect("payment_settings", "key=eq.profit_markup");
    if (rows?.length) return parseFloat(rows[0].value) || 1.5;
    return 1.5;
  } catch { return 1.5; }
}

async function saveMarkup(m) {
  try {
    await sbUpdate("payment_settings", "key=eq.profit_markup", { value: String(m) });
  } catch {
    try {
      await sbInsert("payment_settings", { key: "profit_markup", value: String(m) });
    } catch (e) { console.error("[TG] saveMarkup:", e.message); }
  }
}

async function showMarkup(chatId, msgId = null) {
  const m   = await getCurrentMarkup();
  const pct = ((m - 1) * 100).toFixed(0);
  const kb  = { inline_keyboard: [
    [{ text: "⚙️ تغيير نسبة الربح", callback_data: "markup_picker" }],
    [{ text: "🔄 تحديث",            callback_data: "markup_view"   }],
    [{ text: "🔙 رجوع",             callback_data: "main"          }],
  ]};
  const text = [
    `📈 <b>نسبة الربح الحالية: ${pct}%</b>`,
    ``,
    `مثال على الأسعار:`,
    `  $0.10 → <code>${Math.ceil(0.10 * m * 1300).toLocaleString()} IQD</code>`,
    `  $0.50 → <code>${Math.ceil(0.50 * m * 1300).toLocaleString()} IQD</code>`,
    `  $1.00 → <code>${Math.ceil(1.00 * m * 1300).toLocaleString()} IQD</code>`,
    `  $5.00 → <code>${Math.ceil(5.00 * m * 1300).toLocaleString()} IQD</code>`,
  ].join("\n");
  if (msgId) await edit(chatId, msgId, text, kb);
  else        await send(chatId, text, kb);
}

async function showMarkupPicker(chatId, msgId = null) {
  const m   = await getCurrentMarkup();
  const pct = ((m - 1) * 100).toFixed(0);
  const text = [
    `⚙️ <b>تغيير نسبة الربح</b>`,
    ``,
    `الحالية: <b>${pct}%</b>`,
    `اختر النسبة الجديدة — سيتم تحديث جميع الأسعار فوراً:`,
  ].join("\n");
  if (msgId) await edit(chatId, msgId, text, MARKUP_KB);
  else        await send(chatId, text, MARKUP_KB);
}

async function applyMarkupBot(pct, chatId) {
  const newMarkup = Math.round((1 + pct / 100) * 1000) / 1000;
  const oldMarkup = await getCurrentMarkup();
  const oldPct    = ((oldMarkup - 1) * 100).toFixed(0);

  await send(chatId, `⏳ جاري تحديث الأسعار بنسبة <b>${pct}%</b>...\nيرجى الانتظار`);

  // حفظ النسبة الجديدة في Supabase
  await saveMarkup(newMarkup);

  // تحديث أسعار الخدمات عبر Followiz API
  let updated = 0, failed = 0;
  try {
    const services = await followizCall({ action: "services" });
    if (Array.isArray(services) && services.length > 0) {
      const BATCH = 20;
      for (let i = 0; i < services.length; i += BATCH) {
        const batch = services.slice(i, i + BATCH);
        await Promise.all(batch.map(async (svc) => {
          try {
            const newPrice = Math.ceil(Number(svc.rate) * newMarkup * 1300);
            await sbUpdate("services",
              `provider_service_id=eq.${svc.service}&provider=eq.followiz`,
              { price: newPrice }
            );
            updated++;
          } catch { failed++; }
        }));
      }
    }
  } catch (e) {
    console.error("[TG] markup Followiz error:", e.message);
  }

  const arrow = pct > parseFloat(oldPct) ? "📈" : "📉";
  await send(chatId, [
    `✅ <b>تم تحديث الأسعار!</b>`,
    ``,
    `${arrow} نسبة الربح: <code>${oldPct}%</code> → <code>${pct}%</code>`,
    updated > 0 ? `📦 خدمات مُحدّثة: <b>${updated}</b>` : `⚠️ لم يتم تحديث خدمات (تحقق من FOLLOWIZ_KEY)`,
    failed  > 0 ? `⚠️ فشل: <b>${failed}</b>` : "",
    ``,
    `مثال الأسعار الجديدة:`,
    `  $0.50 → <code>${Math.ceil(0.5 * newMarkup * 1300).toLocaleString()} IQD</code>`,
    `  $1.00 → <code>${Math.ceil(1.0 * newMarkup * 1300).toLocaleString()} IQD</code>`,
    `  $5.00 → <code>${Math.ceil(5.0 * newMarkup * 1300).toLocaleString()} IQD</code>`,
  ].filter(l => l !== "").join("\n"), BACK_KB);
}

// ─── Broadcast Notification ───────────────────────────────────────────────────

async function showBroadcast(chatId, msgId = null) {
  const text = [
    `📢 <b>إشعار عام للمستخدمين</b>`,
    ``,
    `يمكنك إرسال إشعار داخلي لجميع المستخدمين.`,
    ``,
    `أرسل الأمر بالشكل التالي:`,
    `<code>/broadcast العنوان | نص الرسالة</code>`,
    ``,
    `مثال:`,
    `<code>/broadcast تحديث الأسعار | تم تحديث أسعار جميع الخدمات بخصم 10%</code>`,
  ].join("\n");
  if (msgId) await edit(chatId, msgId, text, BACK_KB);
  else        await send(chatId, text, BACK_KB);
}

async function doBroadcast(title, message, chatId) {
  await send(chatId, `⏳ جاري إرسال الإشعار لجميع المستخدمين...`);
  try {
    const users = await sbSelect("profiles", "id=not.is.null&select=id");
    let sent = 0, failed = 0;
    const BATCH = 30;
    for (let i = 0; i < (users || []).length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      await Promise.all(batch.map(async (u) => {
        try {
          await sbInsert("notifications", {
            user_id: u.id, title, message, is_read: false,
          });
          sent++;
        } catch { failed++; }
      }));
    }
    await send(chatId, [
      `✅ <b>تم الإرسال!</b>`,
      ``,
      `📢 العنوان: <b>${title}</b>`,
      `📝 الرسالة: ${message}`,
      ``,
      `👥 أُرسل لـ <b>${sent}</b> مستخدم${failed > 0 ? `\n⚠️ فشل: ${failed}` : ""}`,
    ].join("\n"), BACK_KB);
  } catch (e) {
    await send(chatId, `❌ فشل الإرسال: ${e.message}`, BACK_KB);
  }
}

// ─── Action: Approve Payment ──────────────────────────────────────────────────
async function doApprove(paymentId, chatId, msgId, adminName) {
  const rows = await sbSelect("payments", `id=eq.${paymentId}&select=*`).catch(() => []);
  const payment = rows?.[0];

  if (!payment) {
    await send(chatId, `❌ الطلب غير موجود: <code>${paymentId?.slice(0, 8)}…</code>`);
    return false;
  }
  if (payment.status !== "pending") {
    await send(chatId, `⚠️ الطلب معالَج مسبقاً — الحالة: <b>${payment.status}</b>`);
    return false;
  }
  if (!payment.user_id) {
    await send(chatId, `❌ الطلب لا يحتوي على user_id`);
    return false;
  }

  // تحديث الرصيد (قراءة ثم كتابة)
  let updateRes;
  try {
    updateRes = await updateBalance(payment.user_id, Number(payment.amount));
  } catch (e) {
    await send(chatId, `❌ فشل تحديث الرصيد:\n${e.message}`);
    return false;
  }

  // تحديث حالة الدفعة
  await sbUpdate("payments", `id=eq.${paymentId}`, { status: "approved" }).catch(e =>
    console.error("[TG] approve payment update:", e.message)
  );

  // إشعار المستخدم
  await tryNotify(
    payment.user_id,
    "✅ تم شحن رصيدك",
    `تم إضافة ${Number(payment.amount).toLocaleString()} IQD. رصيدك الجديد: ${updateRes.newBalance.toLocaleString()} IQD`
  );

  const successText = [
    "✅ <b>تم القبول بنجاح</b>",
    "═══════════════════",
    `💵 المبلغ:       <b>${Number(payment.amount).toLocaleString()} IQD</b>`,
    `💰 الرصيد القديم: ${updateRes.oldBalance.toLocaleString()} IQD`,
    `💰 الرصيد الجديد: <b>${updateRes.newBalance.toLocaleString()} IQD</b>`,
    `🆔 <code>${paymentId.slice(0, 8)}…</code>`,
    `👤 بواسطة: ${adminName}`,
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");

  const doneKb = {
    inline_keyboard: [[
      { text: `✅ مقبول — ${adminName}`, callback_data: "done" },
    ]],
  };

  if (msgId) await edit(chatId, msgId, successText, doneKb);
  else        await send(chatId, successText, doneKb);
  console.log(`[TG] ✅ Approved ${paymentId} +${payment.amount} IQD → ${payment.user_id}`);
  return true;
}

// ─── Action: Reject Payment ───────────────────────────────────────────────────
async function doReject(paymentId, chatId, msgId, adminName) {
  const rows = await sbSelect("payments", `id=eq.${paymentId}&select=*`).catch(() => []);
  const payment = rows?.[0];

  if (!payment) {
    await send(chatId, `❌ الطلب غير موجود: <code>${paymentId?.slice(0, 8)}…</code>`);
    return false;
  }
  if (payment.status !== "pending") {
    await send(chatId, `⚠️ الطلب معالَج مسبقاً — الحالة: <b>${payment.status}</b>`);
    return false;
  }

  await sbUpdate("payments", `id=eq.${paymentId}`, { status: "rejected" }).catch(e =>
    console.error("[TG] reject payment update:", e.message)
  );

  if (payment.user_id) {
    await tryNotify(
      payment.user_id,
      "❌ تم رفض طلب الشحن",
      `تم رفض طلب شحن بمبلغ ${Number(payment.amount).toLocaleString()} IQD. تواصل مع الدعم.`
    );
  }

  const rejectText = [
    "❌ <b>تم الرفض</b>",
    "═══════════════════",
    `💵 المبلغ: ${Number(payment.amount).toLocaleString()} IQD`,
    `🆔 <code>${paymentId.slice(0, 8)}…</code>`,
    `👤 بواسطة: ${adminName}`,
    `🕐 ${new Date().toLocaleString("ar-IQ")}`,
  ].join("\n");

  const doneKb = {
    inline_keyboard: [[
      { text: `❌ مرفوض — ${adminName}`, callback_data: "done" },
    ]],
  };

  if (msgId) await edit(chatId, msgId, rejectText, doneKb);
  else        await send(chatId, rejectText, doneKb);
  console.log(`[TG] ❌ Rejected ${paymentId} by ${adminName}`);
  return true;
}

// ─── Callback Handler ─────────────────────────────────────────────────────────
async function handleCallback(cb) {
  const chatId   = cb.message?.chat?.id;
  const msgId    = cb.message?.message_id;
  const data     = cb.data || "";
  const fromId   = String(cb.from?.id);
  const fromName = cb.from?.first_name || "أدمن";

  await answer(cb.id);

  if (!ADMIN_IDS.includes(fromId)) {
    await answer(cb.id, "⛔ غير مصرح", true);
    return;
  }

  // ── Approve ──────────────────────────────────────────────────────────────
  if (data.startsWith("approve:")) {
    const paymentId = data.slice("approve:".length);
    await doApprove(paymentId, chatId, msgId, fromName);
    return;
  }

  // ── Reject ───────────────────────────────────────────────────────────────
  if (data.startsWith("reject:")) {
    const paymentId = data.slice("reject:".length);
    await doReject(paymentId, chatId, msgId, fromName);
    return;
  }

  // ── Payment detail ───────────────────────────────────────────────────────
  if (data.startsWith("pinfo:")) {
    const paymentId = data.slice("pinfo:".length);
    await showPaymentDetail(chatId, msgId, paymentId);
    return;
  }

  // ── نسبة الربح — mk_20, mk_50 ... ──────────────────────────────────────────
  if (data.startsWith("mk_")) {
    const pct = parseInt(data.replace("mk_", ""), 10);
    if (!isNaN(pct) && pct > 0 && pct <= 500) {
      await tg("answerCallbackQuery", { callback_query_id: callbackId, text: `⏳ جاري ضبط ${pct}%...` });
      await applyMarkupBot(pct, chatId);
      return;
    }
  }

  // ── Menu screens ─────────────────────────────────────────────────────────
  switch (data) {
    case "main":          await showMain(chatId, msgId);         break;
    case "stats":         await showStats(chatId, msgId);        break;
    case "revenue":       await showRevenue(chatId, msgId);      break;
    case "payments":      await showPending(chatId, msgId);      break;
    case "users":         await showUsers(chatId, msgId);        break;
    case "numbers":       await showNumbers(chatId, msgId);      break;
    case "refresh":       await showStats(chatId, msgId);        break;
    case "markup_view":   await showMarkup(chatId, msgId);       break;
    case "markup_picker": await showMarkupPicker(chatId, msgId); break;
    case "broadcast":     await showBroadcast(chatId, msgId);    break;

    case "mk_custom_help":
      await edit(chatId, msgId,
        "✏️ <b>رقم مخصص</b>\n\nأرسل الأمر بالشكل التالي:\n<code>/setmarkup 45</code>\n\nمثال: 45 = نسبة ربح 45%",
        BACK_KB
      );
      break;

    case "add_help":
      await edit(chatId, msgId,
        [
          "➕ <b>إضافة رصيد يدوياً</b>",
          "",
          "أرسل الأمر بالصيغة التالية:",
          "<code>/addbalance {user_id} {amount}</code>",
          "",
          "مثال:",
          "<code>/addbalance 55a2a099-3695-4a4a-bdac-e91bfe4e1765 10000</code>",
          "",
          "لمعرفة user_id اضغط على المستخدم في قائمة 👥",
        ].join("\n"),
        BACK_KB
      );
      break;

    case "done":
      // مجرد زر عرض — لا إجراء
      break;

    default:
      await send(chatId, "⚠️ أمر غير معروف.");
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────
async function handleMessage(msg) {
  const chatId  = msg.chat?.id;
  const fromId  = String(msg.from?.id);
  const text    = (msg.text || "").trim();
  const from    = msg.from?.first_name || "مستخدم";

  if (!ADMIN_IDS.includes(fromId)) {
    await send(chatId, "⛔ هذا البوت خاص بالإدارة فقط.");
    return;
  }

  // /start
  if (text === "/start" || text.startsWith("/start ")) {
    await showMain(chatId);
    return;
  }

  // /pending
  if (text === "/pending") {
    await showPending(chatId);
    return;
  }

  // /stats
  if (text === "/stats") {
    await showStats(chatId);
    return;
  }

  // /approve {payment_id}
  if (text.startsWith("/approve")) {
    const id = text.split(/\s+/)[1]?.trim();
    if (!id) { await send(chatId, "⚠️ الاستخدام: <code>/approve {payment_id}</code>"); return; }
    await doApprove(id, chatId, null, from);
    return;
  }

  // /reject {payment_id}
  if (text.startsWith("/reject")) {
    const id = text.split(/\s+/)[1]?.trim();
    if (!id) { await send(chatId, "⚠️ الاستخدام: <code>/reject {payment_id}</code>"); return; }
    await doReject(id, chatId, null, from);
    return;
  }

  // /balance {user_id}
  if (text.startsWith("/balance")) {
    const uid = text.split(/\s+/)[1]?.trim();
    if (!uid) { await send(chatId, "⚠️ الاستخدام: <code>/balance {user_id}</code>"); return; }
    try {
      const p = await getBalance(uid);
      if (!p) { await send(chatId, `❌ لم أجد المستخدم: <code>${uid}</code>`); return; }
      await send(chatId, [
        `👤 <b>${p.name || p.email || "مجهول"}</b>`,
        `💰 الرصيد: <b>${Number(p.balance || 0).toLocaleString()} IQD</b>`,
        `🆔 <code>${uid}</code>`,
      ].join("\n"));
    } catch (e) {
      await send(chatId, `❌ خطأ: ${e.message}`);
    }
    return;
  }

  // /addbalance {user_id} {amount}
  if (text.startsWith("/addbalance")) {
    const parts = text.split(/\s+/);
    const uid   = parts[1]?.trim();
    const amt   = Number(parts[2]);
    if (!uid || !amt || isNaN(amt) || amt <= 0) {
      await send(chatId, "⚠️ الاستخدام: <code>/addbalance {user_id} {amount}</code>"); return;
    }
    try {
      const { oldBalance, newBalance, profile } = await updateBalance(uid, amt);
      await tryNotify(uid, "💰 تم إضافة رصيد",
        `تم إضافة ${amt.toLocaleString()} IQD إلى حسابك من قِبل الإدارة.`);
      await send(chatId, [
        "✅ <b>تم إضافة الرصيد</b>",
        `👤 ${profile.name || profile.email || uid}`,
        `💰 السابق: ${oldBalance.toLocaleString()} IQD`,
        `➕ المضاف: <b>${amt.toLocaleString()} IQD</b>`,
        `💳 الجديد: <b>${newBalance.toLocaleString()} IQD</b>`,
      ].join("\n"), MAIN_KB);
      console.log(`[TG] ➕ addbalance ${uid} +${amt} IQD`);
    } catch (e) {
      await send(chatId, `❌ فشل: ${e.message}`);
    }
    return;
  }

  // /deduct {user_id} {amount}
  if (text.startsWith("/deduct")) {
    const parts = text.split(/\s+/);
    const uid   = parts[1]?.trim();
    const amt   = Number(parts[2]);
    if (!uid || !amt || isNaN(amt) || amt <= 0) {
      await send(chatId, "⚠️ الاستخدام: <code>/deduct {user_id} {amount}</code>"); return;
    }
    try {
      const { oldBalance, newBalance, profile } = await updateBalance(uid, -amt);
      await send(chatId, [
        "✅ <b>تم خصم الرصيد</b>",
        `👤 ${profile.name || profile.email || uid}`,
        `💰 السابق: ${oldBalance.toLocaleString()} IQD`,
        `➖ المخصوم: <b>${amt.toLocaleString()} IQD</b>`,
        `💳 الجديد: <b>${newBalance.toLocaleString()} IQD</b>`,
      ].join("\n"), MAIN_KB);
      console.log(`[TG] ➖ deduct ${uid} -${amt} IQD`);
    } catch (e) {
      await send(chatId, `❌ فشل: ${e.message}`);
    }
    return;
  }

  // /setnumber {zain|asiacell|qicard} {value}
  if (text.startsWith("/setnumber")) {
    const parts = text.split(/\s+/);
    const key   = parts[1]?.toLowerCase()?.trim();
    const value = parts.slice(2).join(" ").trim();
    const keyMap = {
      zain: "zaincash_number", asiacell: "asiacell_number", qicard: "qicard_number",
    };
    const dbKey = keyMap[key];
    if (!dbKey || !value) {
      await send(chatId, [
        "⚠️ الاستخدام:",
        "<code>/setnumber zain 07XX XXX XXXX</code>",
        "<code>/setnumber asiacell 07XX XXX XXXX</code>",
        "<code>/setnumber qicard 1234 5678 9012</code>",
      ].join("\n")); return;
    }
    try {
      await sbUpdate("payment_settings", `key=eq.${dbKey}`, { value });
      await send(chatId, `✅ تم تحديث <b>${key}</b>:\n<code>${value}</code>`, MAIN_KB);
    } catch (e) {
      await send(chatId, `❌ فشل: ${e.message}`);
    }
    return;
  }

  // ─── أزرار الكيبورد الثابت ─────────────────────────────────────────────────
  if (text === "📊 الإحصائيات") { await showStats(chatId);   return; }
  if (text === "💰 الأرباح")    { await showRevenue(chatId); return; }
  if (text === "📥 الطلبات المعلقة") { await showPending(chatId); return; }
  if (text === "👥 المستخدمين") { await showUsers(chatId);   return; }
  if (text === "⚙️ أرقام الدفع" || text === "⚙️ تعديل الأرقام") {
    await showNumbers(chatId);  return;
  }
  if (text === "📈 نسبة الربح") { await showMarkup(chatId); return; }
  if (text === "📢 إشعار عام")  { await showBroadcast(chatId); return; }
  if (text === "🔄 تحديث") { await showStats(chatId); return; }
  if (text === "➕ إضافة رصيد") {
    await send(chatId, [
      "➕ <b>إضافة رصيد يدوياً</b>",
      "",
      "أرسل الأمر بالشكل التالي:",
      "<code>/addbalance {user_id} {amount}</code>",
      "",
      "مثال:",
      "<code>/addbalance abc-123 15000</code>",
    ].join("\n"));
    return;
  }

  // /setmarkup {n}
  if (text.startsWith("/setmarkup")) {
    const val = text.split(/\s+/)[1]?.trim();
    const pct = parseFloat(val);
    if (!val || isNaN(pct) || pct < 1 || pct > 500) {
      await send(chatId, "⚠️ الاستخدام: <code>/setmarkup 50</code>\n\nمثال: 50 = نسبة ربح 50%");
      return;
    }
    await applyMarkupBot(pct, chatId);
    return;
  }

  // /broadcast {title} | {message}
  if (text.startsWith("/broadcast")) {
    const body = text.slice("/broadcast".length).trim();
    const sep  = body.indexOf("|");
    if (!body || sep === -1) {
      await send(chatId, [
        "⚠️ الاستخدام:",
        "<code>/broadcast العنوان | نص الرسالة</code>",
        "",
        "مثال:",
        "<code>/broadcast تحديث | تم تحديث أسعار الخدمات</code>",
      ].join("\n"));
      return;
    }
    const title   = body.slice(0, sep).trim();
    const message = body.slice(sep + 1).trim();
    await doBroadcast(title, message, chatId);
    return;
  }

  // Unknown
  await send(chatId,
    "❓ أمر غير معروف. أرسل /start للقائمة الرئيسية.",
    { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main" }]] }
  );
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Always set CORS headers first (Telegram doesn't need them but browsers do)
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET — health check / webhook info
  if (req.method === "GET") {
    return res.status(200).json({
      ok:      true,
      bot:     "Boost Iraq Admin Bot 🚀",
      admins:  ADMIN_IDS,
      supabase: !!SUPABASE_URL,
      token:   !!TELEGRAM_TOKEN,
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false });

  // ── CRITICAL: In Vercel serverless, the function is killed once res.end()
  //    is called. We must complete all async work BEFORE responding.
  //    Telegram allows up to 60s — our maxDuration is 30s, plenty of time.
  const update = req.body || {};

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error("[TG] Unhandled error:", err.message);
    // Still return 200 — Telegram must not retry
  }

  return res.status(200).json({ ok: true });
}
