// ─── Frontend SMM API client ───────────────────────────────────────────────────
// All calls go to our Vercel serverless /api/* functions.
// On Vercel:    VITE_API_URL is empty → paths are relative (/api/services)
// On local dev: VITE_API_URL=http://localhost:3000 → http://localhost:3000/api/services

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type FollowizService = {
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

// ─── GET /api/services ────────────────────────────────────────────────────────
export async function getFollowizServices(): Promise<FollowizService[]> {
  const res = await fetch(`${BASE}/api/services`);
  if (!res.ok) throw new Error("تعذر تحميل الخدمات");
  const json = await res.json() as { ok: boolean; data: FollowizService[]; error?: string };
  if (!json.ok) throw new Error(json.error || "خطأ في تحميل الخدمات");
  return json.data;
}

// ─── POST /api/order ──────────────────────────────────────────────────────────
export async function createFollowizOrder(params: {
  provider_service_id: number;
  link: string;
  quantity: number;
  price_per_1000: number;
  token: string;
}): Promise<{ ok: boolean; order: unknown; followiz_order_id: string }> {
  const res = await fetch(`${BASE}/api/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      provider_service_id: params.provider_service_id,
      service:             params.provider_service_id,
      link:                params.link,
      quantity:            params.quantity,
      price_per_1000:      params.price_per_1000,
    }),
  });
  const json = await res.json() as { ok: boolean; order: unknown; followiz_order_id: string; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error || "فشل إنشاء الطلب");
  return json;
}

// ─── GET /api/balance ─────────────────────────────────────────────────────────
export async function getBalance(token: string): Promise<number> {
  const res = await fetch(`${BASE}/api/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("تعذر جلب الرصيد");
  const json = await res.json() as { ok: boolean; balance: number; error?: string };
  if (!json.ok) throw new Error(json.error || "خطأ في جلب الرصيد");
  return json.balance;
}
