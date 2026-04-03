import { Router } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const router = Router();

// ─── CONFIG (server-only — never exposed to frontend) ────────────────────────
const FOLLOWIZ_URL = "https://followiz.com/api/v2";
const FOLLOWIZ_KEY = "7df9c35df34ad299ded4d7e2177cc6cc";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("[SMM] ⚠️  Supabase credentials missing — SMM routes will fail");
}

// Admin client (bypasses RLS)
const adminDb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TYPES ────────────────────────────────────────────────────────────────────
type FollowizService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  refill?: boolean;
  cancel?: boolean;
};

// ─── FOLLOWIZ API WRAPPER ─────────────────────────────────────────────────────
async function followizRequest(params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams({ key: FOLLOWIZ_KEY, ...params });
  try {
    const res = await fetch(FOLLOWIZ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("[SMM] Followiz request error:", err);
    throw err;
  }
}

// ─── SERVICES CACHE (5 min) ───────────────────────────────────────────────────
let servicesCache: FollowizService[] | null = null;
let servicesCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── AUTH HELPER: verify Supabase JWT and return user_id ─────────────────────
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

// ─── GET /api/smm/services ────────────────────────────────────────────────────
router.get("/services", async (_req, res) => {
  try {
    if (servicesCache && Date.now() - servicesCacheTime < CACHE_TTL_MS) {
      res.json({ ok: true, data: servicesCache, cached: true });
      return;
    }
    const data = await followizRequest({ action: "services" });
    if (!Array.isArray(data)) {
      console.warn("[SMM] Unexpected services response:", typeof data);
      res.status(502).json({ ok: false, error: "استجابة غير متوقعة من المزود" });
      return;
    }
    servicesCache = data as FollowizService[];
    servicesCacheTime = Date.now();
    console.log(`[SMM] ✅ Fetched ${servicesCache.length} services from Followiz`);
    res.json({ ok: true, data: servicesCache });
  } catch (err) {
    console.error("[SMM] /services error:", err);
    res.status(502).json({ ok: false, error: "تعذر الاتصال بالمزود" });
  }
});

// ─── POST /api/smm/orders ─────────────────────────────────────────────────────
// Body: { provider_service_id, link, quantity, price_per_1000 }
// Header: Authorization: Bearer <supabase_access_token>
router.post("/orders", async (req, res) => {
  // 1. Verify user auth
  const userId = await verifyToken(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ ok: false, error: "يجب تسجيل الدخول أولاً" });
    return;
  }

  const { provider_service_id, link, quantity, price_per_1000 } = req.body as {
    provider_service_id: number | string;
    link: string;
    quantity: number | string;
    price_per_1000: number | string;
  };

  if (!provider_service_id || !link || !quantity) {
    res.status(400).json({ ok: false, error: "بيانات ناقصة" });
    return;
  }

  const qty = Number(quantity);
  const pricePerK = Number(price_per_1000);
  const totalPrice = Math.ceil((qty * pricePerK) / 1000);

  // 2. Check user balance
  const { data: profile, error: profErr } = await adminDb
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile) {
    res.status(404).json({ ok: false, error: "لم يتم إيجاد الحساب" });
    return;
  }

  const currentBalance = Number(profile.balance);
  if (currentBalance < totalPrice) {
    res.status(400).json({
      ok: false,
      error: `رصيدك غير كافٍ. رصيدك: ${currentBalance.toLocaleString()} IQD، المطلوب: ${totalPrice.toLocaleString()} IQD`,
    });
    return;
  }

  // 3. Place order with Followiz
  console.log(`[SMM] Placing order: service=${provider_service_id}, qty=${qty}, link=${link}`);
  let followizResult: Record<string, unknown>;
  try {
    followizResult = await followizRequest({
      action: "add",
      service: String(provider_service_id),
      link,
      quantity: String(qty),
    }) as Record<string, unknown>;
  } catch (err) {
    console.error("[SMM] Followiz order error:", err);
    res.status(502).json({ ok: false, error: "تعذر إرسال الطلب للمزود" });
    return;
  }

  if (!followizResult.order) {
    console.error("[SMM] Followiz rejected order:", followizResult);
    res.status(400).json({
      ok: false,
      error: String(followizResult.error || "رفض المزود الطلب، تحقق من البيانات"),
    });
    return;
  }

  const providerOrderId = String(followizResult.order);

  // 4. Deduct balance (atomic — use RPC if available, else direct update)
  const { error: rpcErr } = await adminDb.rpc("decrement_balance", {
    uid: userId,
    amount: totalPrice,
  });
  if (rpcErr) {
    // Fallback: direct update
    const newBalance = currentBalance - totalPrice;
    const { error: updateErr } = await adminDb
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);
    if (updateErr) {
      console.error("[SMM] Balance deduction failed:", updateErr.message);
      res.status(500).json({ ok: false, error: "فشل خصم الرصيد" });
      return;
    }
  }

  // 5. Save order to Supabase
  const { data: order, error: orderErr } = await adminDb
    .from("orders")
    .insert({
      user_id: userId,
      service_id: null,
      link,
      quantity: qty,
      total_price: totalPrice,
      status: "pending",
      provider_order_id: providerOrderId,
      provider_service_id: String(provider_service_id),
    })
    .select()
    .single();

  if (orderErr) {
    console.error("[SMM] Save order error:", orderErr.message);
    res.status(500).json({ ok: false, error: "تم إرسال الطلب ولكن فشل الحفظ في قاعدة البيانات" });
    return;
  }

  console.log(`[SMM] ✅ Order created: provider_order_id=${providerOrderId}, local_id=${order.id}`);
  res.status(201).json({ ok: true, order, followiz_order_id: providerOrderId });
});

// ─── GET /api/smm/orders/status ──────────────────────────────────────────────
// Manual status sync for a single order (optional, for testing)
router.get("/orders/:orderId/status", async (req, res) => {
  const userId = await verifyToken(req.headers.authorization);
  if (!userId) { res.status(401).json({ ok: false, error: "يجب تسجيل الدخول" }); return; }

  const { orderId } = req.params;
  const { data: order } = await adminDb
    .from("orders")
    .select("id, provider_order_id, status")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!order?.provider_order_id) {
    res.json({ ok: true, status: order?.status || "unknown" });
    return;
  }

  const result = await followizRequest({ action: "status", order: order.provider_order_id }) as Record<string, string>;
  res.json({ ok: true, status: result.status, followiz: result });
});

// ─── AUTO STATUS POLLING ──────────────────────────────────────────────────────
// Runs every 30 seconds — checks all pending orders and updates their status
const STATUS_MAP: Record<string, string> = {
  Pending: "pending",
  Processing: "processing",
  "In progress": "processing",
  Partial: "processing",
  Completed: "completed",
  Canceled: "cancelled",
  Cancelled: "cancelled",
  Failed: "failed",
};

async function syncPendingOrders() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    // Get all pending/processing orders that have a provider_order_id
    const { data: orders, error } = await adminDb
      .from("orders")
      .select("id, provider_order_id, status")
      .in("status", ["pending", "processing"])
      .not("provider_order_id", "is", null)
      .limit(50);

    if (error || !orders?.length) return;

    console.log(`[SMM] Syncing ${orders.length} pending orders...`);

    // Check all orders in parallel (batch of max 10)
    const batches = [];
    for (let i = 0; i < orders.length; i += 10) {
      batches.push(orders.slice(i, i + 10));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (order) => {
          try {
            const result = await followizRequest({
              action: "status",
              order: order.provider_order_id!,
            }) as Record<string, string>;

            const newStatus = STATUS_MAP[result.status] || null;
            if (newStatus && newStatus !== order.status) {
              await adminDb
                .from("orders")
                .update({ status: newStatus })
                .eq("id", order.id);
              console.log(`[SMM] Order ${order.id}: ${order.status} → ${newStatus}`);
            }
          } catch (err) {
            console.warn(`[SMM] Status check failed for order ${order.id}:`, err);
          }
        })
      );
    }
  } catch (err) {
    console.error("[SMM] syncPendingOrders error:", err);
  }
}

// Start the polling interval
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startSmmPoller() {
  if (pollInterval) return; // Already running
  console.log("[SMM] 🔄 Starting auto-status polling every 30s...");
  pollInterval = setInterval(syncPendingOrders, POLL_INTERVAL_MS);
  // Also run once immediately on start (after 5s delay)
  setTimeout(syncPendingOrders, 5000);
}

export function stopSmmPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[SMM] ⏹️  Stopped auto-status polling");
  }
}

export default router;
