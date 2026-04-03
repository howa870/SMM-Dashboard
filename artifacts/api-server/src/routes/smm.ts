import { Router } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const router = Router();

// ─── CONFIG — keys come from environment, never hardcoded ──────────────────
const FOLLOWIZ_URL = "https://followiz.com/api/v2";
const FOLLOWIZ_KEY = process.env["FOLLOWIZ_KEY"] || "";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!FOLLOWIZ_KEY) console.warn("[SMM] ⚠️  FOLLOWIZ_KEY env variable not set!");
if (!SUPABASE_URL || !SUPABASE_KEY) console.warn("[SMM] ⚠️  Supabase credentials missing");

// Admin Supabase client (bypasses RLS)
const adminDb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TYPES ────────────────────────────────────────────────────────────────────
type FollowizService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string | number;
  max: string | number;
  refill?: boolean;
  cancel?: boolean;
};

// ─── FOLLOWIZ WRAPPER ─────────────────────────────────────────────────────────
async function followizRequest(params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams({ key: FOLLOWIZ_KEY, ...params });
  console.log(`[SMM] → Followiz action=${params.action}`);
  try {
    const res = await fetch(FOLLOWIZ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = await res.json();
    console.log(`[SMM] ← Followiz response (action=${params.action}):`, JSON.stringify(json).slice(0, 200));
    return json;
  } catch (err) {
    console.error("[SMM] Followiz request failed:", err);
    throw err;
  }
}

// ─── IN-MEMORY CACHE (5 min) ──────────────────────────────────────────────────
let servicesCache: FollowizService[] | null = null;
let servicesCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchFollowizServices(): Promise<FollowizService[]> {
  if (servicesCache && Date.now() - servicesCacheTime < CACHE_TTL_MS) {
    console.log("[SMM] ✅ Returning cached services");
    return servicesCache;
  }
  const data = await followizRequest({ action: "services" });
  if (!Array.isArray(data)) throw new Error("Unexpected Followiz response for services");
  servicesCache = data as FollowizService[];
  servicesCacheTime = Date.now();
  console.log(`[SMM] ✅ Fetched ${servicesCache.length} services from Followiz`);
  return servicesCache;
}

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM DETECTION — auto-classify Followiz service by name/category
// ══════════════════════════════════════════════════════════════════════════════
const PLATFORM_RULES: Array<{ keywords: string[]; platform: string }> = [
  { keywords: ["instagram"],           platform: "Instagram"   },
  { keywords: ["tiktok", "tik tok"],   platform: "TikTok"      },
  { keywords: ["telegram"],            platform: "Telegram"    },
  { keywords: ["youtube", "yt "],      platform: "YouTube"     },
  { keywords: ["facebook", "fb "],     platform: "Facebook"    },
  { keywords: ["twitter", " x "],      platform: "Twitter"     },
  { keywords: ["snapchat"],            platform: "Snapchat"    },
  { keywords: ["twitch"],              platform: "Twitch"      },
  { keywords: ["spotify"],             platform: "Spotify"     },
  { keywords: ["soundcloud"],          platform: "SoundCloud"  },
  { keywords: ["linkedin"],            platform: "LinkedIn"    },
  { keywords: ["pinterest"],           platform: "Pinterest"   },
  { keywords: ["discord"],             platform: "Discord"     },
  { keywords: ["threads"],             platform: "Threads"     },
];

function detectPlatform(name: string, category: string): string {
  const haystack = (name + " " + category).toLowerCase();
  for (const rule of PLATFORM_RULES) {
    if (rule.keywords.some(kw => haystack.includes(kw))) {
      return rule.platform;
    }
  }
  return "Other";
}

// ─── AUTH HELPER ──────────────────────────────────────────────────────────────
async function verifyToken(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { data, error } = await adminDb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/smm/services
// Returns Followiz services (cached 5 min) — shown on services page Provider tab
// ══════════════════════════════════════════════════════════════════════════════
router.get("/services", async (_req, res) => {
  console.log("[SMM] GET /services");
  try {
    const data = await fetchFollowizServices();
    res.json({ ok: true, data, cached: servicesCache !== null });
  } catch (err) {
    console.error("[SMM] /services error:", err);
    res.status(502).json({ ok: false, error: "تعذر الاتصال بالمزود" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/smm/sync-services     (Admin only — requires Bearer token)
// Pulls ALL services from Followiz and upserts them into Supabase services table
// Price = rate * 1500 * 1.3  (IQD conversion + 30% profit margin)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/sync-services", async (req, res) => {
  console.log("[SMM] POST /sync-services — starting...");

  const userId = await verifyToken(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ ok: false, error: "يجب تسجيل الدخول" });
    return;
  }

  // Verify admin role
  const { data: profile } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role !== "admin") {
    res.status(403).json({ ok: false, error: "هذا الإجراء للمشرفين فقط" });
    return;
  }

  try {
    // 1. Fetch from Followiz (bypass cache to get fresh data)
    servicesCache = null; // bust cache
    const followizServices = await fetchFollowizServices();
    console.log(`[SMM] sync-services: got ${followizServices.length} services from Followiz`);

    // 2. Build upsert payload — detect platform from name/category
    const rows = followizServices.map(svc => ({
      provider:            "followiz",
      provider_service_id: String(svc.service),
      name:                svc.name,
      category:            svc.category,
      platform:            detectPlatform(svc.name, svc.category),
      // price per 1000 in IQD: rate (USD/1000) × 1500 IQD/USD × 1.3 profit
      price:               Math.ceil(Number(svc.rate) * 1500 * 1.3),
      min_order:           Number(svc.min),
      max_order:           Number(svc.max),
      description:         svc.type || null,
    }));

    // 3. Upsert in batches of 100
    let inserted = 0;
    let updated  = 0;
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await adminDb
        .from("services")
        .upsert(batch, { onConflict: "provider_service_id" })
        .select("id");

      if (error) {
        console.error("[SMM] upsert error:", error.message);
        res.status(500).json({ ok: false, error: `خطأ في قاعدة البيانات: ${error.message}` });
        return;
      }
      inserted += data?.length || 0;
      console.log(`[SMM] sync-services: batch ${i / BATCH + 1} — upserted ${data?.length || 0} rows`);
    }

    console.log(`[SMM] ✅ sync-services complete: total ${inserted} services upserted`);
    res.json({
      ok: true,
      synced: inserted,
      total: rows.length,
      message: `تم مزامنة ${rows.length} خدمة بنجاح`,
    });
  } catch (err) {
    console.error("[SMM] sync-services error:", err);
    res.status(500).json({ ok: false, error: "فشل المزامنة" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/smm/platforms
// Returns distinct platforms from Supabase services table with service counts
// No auth required — public data
// ══════════════════════════════════════════════════════════════════════════════
router.get("/platforms", async (_req, res) => {
  console.log("[SMM] GET /platforms");
  try {
    // Pull all active followiz services, group by platform
    const { data, error } = await adminDb
      .from("services")
      .select("platform")
      .eq("provider", "followiz")
      .eq("status",   "active");

    if (error) {
      // Likely missing columns (SQL migration not run yet) — return empty gracefully
      console.warn("[SMM] /platforms DB error (columns may not exist yet):", error.message);
      res.json({ ok: true, data: [], total: 0, hint: "run SQL migrations first" });
      return;
    }

    // Count per platform
    const countMap: Record<string, number> = {};
    for (const row of data || []) {
      const p = row.platform || "Other";
      countMap[p] = (countMap[p] || 0) + 1;
    }

    const platforms = Object.entries(countMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // most services first

    console.log(`[SMM] /platforms: ${platforms.length} platforms found`);
    res.json({ ok: true, data: platforms, total: platforms.length });
  } catch (err) {
    console.error("[SMM] /platforms error:", err);
    res.status(500).json({ ok: false, error: "خطأ داخلي" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/smm/order              (Authenticated)
// Body: { service_id, link, quantity }
// 1. Load service from Supabase → get provider_service_id + price
// 2. Calculate total = price * quantity / 1000
// 3. Call decrement_balance RPC
// 4. Send order to Followiz action=add
// 5. Insert into orders table
// ══════════════════════════════════════════════════════════════════════════════
router.post("/order", async (req, res) => {
  console.log("[SMM] POST /order — body:", JSON.stringify(req.body));

  const userId = await verifyToken(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ ok: false, error: "يجب تسجيل الدخول أولاً" });
    return;
  }

  const { service_id, link, quantity } = req.body as {
    service_id: number | string;
    link: string;
    quantity: number | string;
  };

  if (!service_id || !link || !quantity) {
    res.status(400).json({ ok: false, error: "بيانات ناقصة: service_id, link, quantity مطلوبة" });
    return;
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    res.status(400).json({ ok: false, error: "الكمية يجب أن تكون عدداً صحيحاً موجباً" });
    return;
  }

  // 1. Load service from Supabase
  console.log(`[SMM] Loading service #${service_id} from Supabase`);
  const { data: svc, error: svcErr } = await adminDb
    .from("services")
    .select("id, name, price, min_order, max_order, provider, provider_service_id")
    .eq("id", Number(service_id))
    .maybeSingle();

  if (svcErr || !svc) {
    console.error("[SMM] service not found:", svcErr?.message);
    res.status(404).json({ ok: false, error: "الخدمة غير موجودة" });
    return;
  }

  console.log(`[SMM] Service found: ${svc.name} | price=${svc.price}/1000 | provider=${svc.provider}`);

  // Validate quantity range
  if (qty < svc.min_order) {
    res.status(400).json({ ok: false, error: `أقل كمية هي ${svc.min_order.toLocaleString()}` });
    return;
  }
  if (qty > svc.max_order) {
    res.status(400).json({ ok: false, error: `أقصى كمية هي ${svc.max_order.toLocaleString()}` });
    return;
  }

  // 2. Calculate total price (price is per 1000)
  const totalPrice = Math.ceil((qty * Number(svc.price)) / 1000);
  console.log(`[SMM] Total price: ${qty} × ${svc.price}/1000 = IQD ${totalPrice}`);

  // 3. Check and deduct balance via RPC
  console.log(`[SMM] Calling decrement_balance RPC for user ${userId}, amount=${totalPrice}`);
  const { error: rpcErr } = await adminDb.rpc("decrement_balance", {
    uid: userId,
    amount: totalPrice,
  });

  if (rpcErr) {
    console.warn("[SMM] decrement_balance RPC failed, trying direct update:", rpcErr.message);

    // Fallback: check balance manually then update
    const { data: profile } = await adminDb
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .maybeSingle();

    const currentBalance = Number(profile?.balance || 0);
    if (currentBalance < totalPrice) {
      res.status(400).json({
        ok: false,
        error: `رصيدك غير كافٍ. رصيدك: ${currentBalance.toLocaleString()} IQD، المطلوب: ${totalPrice.toLocaleString()} IQD`,
      });
      return;
    }

    const { error: updErr } = await adminDb
      .from("profiles")
      .update({ balance: currentBalance - totalPrice })
      .eq("id", userId);

    if (updErr) {
      console.error("[SMM] Balance deduction failed:", updErr.message);
      res.status(500).json({ ok: false, error: "فشل خصم الرصيد" });
      return;
    }
  }

  console.log(`[SMM] ✅ Balance deducted: IQD ${totalPrice}`);

  // 4. Place order with Followiz (if provider service)
  let providerOrderId: string | null = null;

  if (svc.provider === "followiz" && svc.provider_service_id) {
    console.log(`[SMM] Sending order to Followiz: service=${svc.provider_service_id}, qty=${qty}, link=${link}`);
    try {
      const followizResult = await followizRequest({
        action:   "add",
        service:  String(svc.provider_service_id),
        link,
        quantity: String(qty),
      }) as Record<string, unknown>;

      if (followizResult.order) {
        providerOrderId = String(followizResult.order);
        console.log(`[SMM] ✅ Followiz order placed: provider_order_id=${providerOrderId}`);
      } else {
        // Followiz rejected — refund balance before returning error
        console.error("[SMM] Followiz rejected order:", followizResult);
        await adminDb.rpc("increment_balance", { uid: userId, amount: totalPrice }).catch(() => {
          adminDb.from("profiles")
            .select("balance")
            .eq("id", userId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                adminDb.from("profiles")
                  .update({ balance: Number(data.balance) + totalPrice })
                  .eq("id", userId);
              }
            });
        });
        res.status(400).json({
          ok: false,
          error: String(followizResult.error || "رفض المزود الطلب، تحقق من الرابط والكمية"),
          followiz: followizResult,
        });
        return;
      }
    } catch (err) {
      console.error("[SMM] Followiz API error:", err);
      // Refund
      await adminDb.rpc("increment_balance", { uid: userId, amount: totalPrice }).catch(() => null);
      res.status(502).json({ ok: false, error: "تعذر الاتصال بمزود الخدمة" });
      return;
    }
  } else {
    console.log("[SMM] Local service — skipping Followiz API call");
  }

  // 5. Save order to Supabase
  const { data: order, error: orderErr } = await adminDb
    .from("orders")
    .insert({
      user_id:             userId,
      service_id:          svc.id,
      link,
      quantity:            qty,
      total_price:         totalPrice,
      status:              "pending",
      provider_order_id:   providerOrderId,
      provider_service_id: svc.provider_service_id || null,
    })
    .select()
    .single();

  if (orderErr) {
    console.error("[SMM] Order insert failed:", orderErr.message);
    res.status(500).json({ ok: false, error: "فشل حفظ الطلب في قاعدة البيانات" });
    return;
  }

  console.log(`[SMM] ✅ Order saved: id=${order.id}, provider_order_id=${providerOrderId}`);
  res.status(201).json({
    ok: true,
    order,
    provider_order_id: providerOrderId,
    service: { id: svc.id, name: svc.name, price: svc.price },
    total_price: totalPrice,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// OLD /api/smm/orders endpoint — kept for backwards compatibility
// Accepts provider_service_id + price directly (no DB lookup)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/orders", async (req, res) => {
  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول أولاً" }); return; }

  const { provider_service_id, link, quantity, price_per_1000 } = req.body as {
    provider_service_id: number | string;
    link: string;
    quantity: number | string;
    price_per_1000: number | string;
  };

  if (!provider_service_id || !link || !quantity) {
    res.status(400).json({ ok: false, error: "بيانات ناقصة" }); return;
  }

  const qty = Number(quantity);
  const pricePerK = Number(price_per_1000);
  const totalPrice = Math.ceil((qty * pricePerK) / 1000);

  const { data: profile } = await adminDb.from("profiles").select("balance").eq("id", userId).maybeSingle();
  const currentBalance = Number(profile?.balance || 0);
  if (currentBalance < totalPrice) {
    res.status(400).json({ ok: false, error: `رصيدك غير كافٍ. رصيدك: ${currentBalance.toLocaleString()} IQD، المطلوب: ${totalPrice.toLocaleString()} IQD` });
    return;
  }

  let followizResult: Record<string, unknown>;
  try {
    followizResult = await followizRequest({ action: "add", service: String(provider_service_id), link, quantity: String(qty) }) as Record<string, unknown>;
  } catch {
    res.status(502).json({ ok: false, error: "تعذر إرسال الطلب للمزود" }); return;
  }

  if (!followizResult.order) {
    res.status(400).json({ ok: false, error: String(followizResult.error || "رفض المزود الطلب") }); return;
  }

  const providerOrderId = String(followizResult.order);

  const { error: rpcErr } = await adminDb.rpc("decrement_balance", { uid: userId, amount: totalPrice });
  if (rpcErr) {
    await adminDb.from("profiles").update({ balance: currentBalance - totalPrice }).eq("id", userId);
  }

  const { data: order, error: orderErr } = await adminDb.from("orders").insert({
    user_id: userId, service_id: null, link, quantity: qty, total_price: totalPrice,
    status: "pending", provider_order_id: providerOrderId, provider_service_id: String(provider_service_id),
  }).select().single();

  if (orderErr) { res.status(500).json({ ok: false, error: "تم إرسال الطلب ولكن فشل الحفظ" }); return; }

  console.log(`[SMM] ✅ Order via /orders: provider_order_id=${providerOrderId}`);
  res.status(201).json({ ok: true, order, followiz_order_id: providerOrderId });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/smm/orders/:orderId/status  (manual check for single order)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/orders/:orderId/status", async (req, res) => {
  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول" }); return; }

  const { orderId } = req.params;
  const { data: order } = await adminDb.from("orders").select("id, provider_order_id, status")
    .eq("id", orderId).eq("user_id", userId).maybeSingle();

  if (!order?.provider_order_id) {
    res.json({ ok: true, status: order?.status || "unknown" }); return;
  }

  const result = await followizRequest({ action: "status", order: order.provider_order_id }) as Record<string, string>;
  res.json({ ok: true, status: result.status, followiz: result });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTO STATUS POLLING — every 30 seconds
// ══════════════════════════════════════════════════════════════════════════════
const STATUS_MAP: Record<string, string> = {
  Pending:       "pending",
  Processing:    "processing",
  "In progress": "processing",
  Partial:       "processing",
  Completed:     "completed",
  Canceled:      "cancelled",
  Cancelled:     "cancelled",
  Failed:        "failed",
};

async function syncPendingOrders() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const { data: orders, error } = await adminDb
      .from("orders")
      .select("id, provider_order_id, status")
      .in("status", ["pending", "processing"])
      .not("provider_order_id", "is", null)
      .limit(50);

    if (error || !orders?.length) return;
    console.log(`[SMM] 🔄 Syncing ${orders.length} pending orders...`);

    const batches: typeof orders[] = [];
    for (let i = 0; i < orders.length; i += 10) batches.push(orders.slice(i, i + 10));

    for (const batch of batches) {
      await Promise.all(batch.map(async (order) => {
        try {
          const result = await followizRequest({ action: "status", order: order.provider_order_id! }) as Record<string, string>;
          const newStatus = STATUS_MAP[result.status] || null;
          if (newStatus && newStatus !== order.status) {
            await adminDb.from("orders").update({ status: newStatus }).eq("id", order.id);
            console.log(`[SMM] Order ${order.id}: ${order.status} → ${newStatus}`);
          }
        } catch (err) {
          console.warn(`[SMM] Status check failed for order ${order.id}:`, err);
        }
      }));
    }
  } catch (err) {
    console.error("[SMM] syncPendingOrders error:", err);
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startSmmPoller() {
  if (pollInterval) return;
  console.log("[SMM] 🔄 Starting auto-status polling every 30s...");
  pollInterval = setInterval(syncPendingOrders, 30_000);
  setTimeout(syncPendingOrders, 5_000); // first run after 5s
}

export function stopSmmPoller() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; console.log("[SMM] ⏹️  Stopped"); }
}

export default router;
