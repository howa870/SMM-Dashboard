import { supabase } from "./supabase";

export type Platform = {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
};

export type ServiceType = "Followers" | "Likes" | "Views" | "Comments" | "Other";

export type Service = {
  id: number;
  platform_id: number | null;
  name: string;
  description: string | null;
  category: string | null;
  platform: string | null;
  service_type: ServiceType | null;
  price: number;
  min_order: number;
  max_order: number;
  status: string;
  provider: string | null;
  provider_service_id: string | null;
  platforms?: { name: string };
};

export type SupabaseOrder = {
  id: number;
  user_id: string;
  service_id: number | null;
  link: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  provider_order_id?: string | null;
  provider_service_id?: string | null;
  services?: { name: string };
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  balance: number;
  role: string;
};

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  method: "zaincash" | "asiacell" | "qicard" | "manual";
  transaction_id: string | null;
  proof_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles?: { name: string | null; email: string | null };
};

export type PaymentSettings = {
  key: string;       // 'zain' | 'asiacell' | 'qicard'
  value: string;     // phone/account number
  label: string;     // display name
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

// Convert any Supabase error into a proper JS Error with message
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object" && "message" in err) {
    const e = new Error(String((err as { message: unknown }).message));
    e.name = "SupabaseError";
    return e;
  }
  return new Error(String(err));
}

// ─── BACKEND API HELPER (bypasses Supabase RLS entirely) ──────
const API_BASE = (typeof import.meta !== "undefined" ? (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "" : "").replace(/\/$/, "");

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("pf_session_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `API ${path} returned ${res.status}`);
  }
  return res.json();
}

// ─── PLATFORMS ─────────────────────────────────────────────────
// Routes through backend API to avoid Supabase RLS issues

export async function getPlatforms(): Promise<Platform[]> {
  try {
    type ApiPlatform = { id: number; name: string; icon: string | null; color: string | null };
    const data = await apiFetch<ApiPlatform[]>("/api/platforms");
    return data.map(p => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }));
  } catch (err) {
    console.error("[DB] getPlatforms:", (err as Error).message);
    return [];
  }
}

// ─── SERVICES ─────────────────────────────────────────────────
// Routes through backend API to avoid Supabase RLS issues

export async function getServices(platformId?: number): Promise<Service[]> {
  try {
    type ApiService = { id: number; platformId: number; platformName: string; name: string; description: string | null; price: number; minOrder: number; maxOrder: number; status: string };
    const path = platformId ? `/api/services?platformId=${platformId}` : "/api/services";
    const raw = await apiFetch<ApiService[] | { services?: ApiService[]; data?: ApiService[] }>(path);
    // Unwrap envelope formats ({ services: [...] } or { data: [...] }) or plain arrays
    const data: ApiService[] = Array.isArray(raw)
      ? raw
      : (Array.isArray((raw as { services?: ApiService[] }).services) ? (raw as { services: ApiService[] }).services
        : Array.isArray((raw as { data?: ApiService[] }).data) ? (raw as { data: ApiService[] }).data
        : []);
    return data.map(s => ({
      id: s.id,
      platform_id: s.platformId,
      name: s.name,
      description: s.description,
      category: null,
      platform: s.platformName,
      service_type: null,
      price: s.price,
      min_order: s.minOrder,
      max_order: s.maxOrder,
      status: s.status,
      provider: null,
      provider_service_id: null,
    }));
  } catch (err) {
    console.error("[DB] getServices:", (err as Error).message);
    return [];
  }
}

// ─── PROFILES ─────────────────────────────────────────────────
// Routes through backend API to avoid Supabase RLS infinite recursion

export async function getProfile(_userId: string): Promise<Profile | null> {
  try {
    type ApiUser = { id: number; name: string | null; email: string | null; balance: number; role: string };
    const data = await apiFetch<ApiUser>("/api/auth/me");
    return { id: String(data.id), name: data.name, email: data.email, balance: data.balance, role: data.role };
  } catch (err) {
    console.error("[DB] getProfile:", (err as Error).message);
    return null;
  }
}

export async function upsertProfile(_profile: Partial<Profile> & { id: string }): Promise<void> {
  // User is created/synced in Drizzle via backend login — no-op here
}

export async function getAdminStats(): Promise<{
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingPayments: number;
  approvedPayments: number;
}> {
  const [profiles, orders, payments] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id,total_price"),
    supabase.from("payments").select("id,amount,status"),
  ]);
  // Log errors but don't throw — dashboard should show partial data
  if (profiles.error) console.warn("[DB] getAdminStats profiles:", profiles.error.message);
  if (orders.error) console.warn("[DB] getAdminStats orders:", orders.error.message);
  if (payments.error) console.warn("[DB] getAdminStats payments:", payments.error.message);

  const totalUsers = profiles.count || 0;
  const totalOrders = orders.data?.length || 0;
  const totalRevenue = (payments.data || [])
    .filter(p => p.status === "approved")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const pendingPayments = (payments.data || []).filter(p => p.status === "pending").length;
  const approvedPayments = (payments.data || []).filter(p => p.status === "approved").length;
  return { totalUsers, totalOrders, totalRevenue, pendingPayments, approvedPayments };
}

export async function getDailyPaymentStats(): Promise<{ date: string; amount: number; count: number }[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("amount, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[DB] getDailyPaymentStats:", error.message);
    return [];
  }
  const byDay: Record<string, { amount: number; count: number }> = {};
  (data || []).forEach(p => {
    const day = p.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { amount: 0, count: 0 };
    byDay[day].amount += Number(p.amount);
    byDay[day].count += 1;
  });
  return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
}

// ─── ORDERS ───────────────────────────────────────────────────

export async function getUserOrders(_userId: string): Promise<SupabaseOrder[]> {
  try {
    type ApiOrder = { id: number; userId: number; serviceId: number; serviceName: string; link: string; quantity: number; totalPrice: number; status: string; createdAt: string };
    const data = await apiFetch<ApiOrder[]>("/api/orders");
    return data.map(o => ({
      id: o.id,
      user_id: String(o.userId),
      service_id: o.serviceId,
      link: o.link,
      quantity: o.quantity,
      total_price: o.totalPrice,
      status: o.status,
      created_at: o.createdAt,
      services: { name: o.serviceName },
    }));
  } catch (err) {
    console.error("[DB] getUserOrders:", (err as Error).message);
    return [];
  }
}

export async function submitOrder(params: {
  user_id: string;
  service_id: number;
  link: string;
  quantity: number;
  total_price: number;
}): Promise<SupabaseOrder> {
  const { data, error } = await supabase
    .from("orders")
    .insert({ ...params, status: "pending" })
    .select()
    .single();
  if (error) {
    console.error("[DB] submitOrder:", error.message, error.code);
    throw toError(error);
  }
  return data as SupabaseOrder;
}

export async function deductBalance(userId: string, newBalance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (error) {
    console.error("[DB] deductBalance:", error.message);
    throw toError(error);
  }
}

// ─── PAYMENTS ─────────────────────────────────────────────────

export async function getUserPayments(userId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[DB] getUserPayments:", error.message, error.code);
    throw toError(error);
  }
  return data as Payment[];
}

export async function createPayment(params: {
  user_id: string;
  amount: number;
  method: Payment["method"];
  transaction_id?: string;
  proof_url?: string;
  notes?: string;
}): Promise<Payment> {
  console.log("[DB] createPayment →", params);
  const { data, error } = await supabase
    .from("payments")
    .insert({ ...params, status: "pending" })
    .select()
    .single();
  if (error) {
    console.error("[DB] createPayment failed:", error.message, error.code, error.details);
    throw toError(error);
  }
  console.log("[DB] createPayment ✅ →", data);
  return data as Payment;
}

export async function getAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*, profiles(name, email)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[DB] getAllPayments:", error.message, error.code);
    throw toError(error);
  }
  return data as Payment[];
}

export async function approvePayment(paymentId: string, userId: string, amount: number): Promise<void> {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .single();
  if (profileError) throw toError(profileError);

  const newBalance = Number(profileData.balance) + Number(amount);

  const { error: balanceError } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (balanceError) throw toError(balanceError);

  const { error: paymentError } = await supabase
    .from("payments")
    .update({ status: "approved" })
    .eq("id", paymentId);
  if (paymentError) throw toError(paymentError);

  await createNotification({
    user_id: userId,
    title: "✅ تم شحن رصيدك",
    message: `تم إضافة ${Number(amount).toLocaleString()} IQD إلى حسابك بنجاح.`,
  });
}

export async function rejectPayment(paymentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ status: "rejected" })
    .eq("id", paymentId);
  if (error) throw toError(error);

  await createNotification({
    user_id: userId,
    title: "❌ تم رفض طلب الشحن",
    message: "تم رفض طلب شحن الرصيد. يرجى التواصل مع الدعم.",
  });
}

// ─── PROOF IMAGE UPLOAD ────────────────────────────────────────

export async function uploadProofImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${userId}/${Date.now()}.${ext}`;
  console.log("[DB] uploadProofImage →", fileName, "size:", file.size);
  const { data, error } = await supabase.storage
    .from("payment_proofs")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) {
    console.error("[DB] uploadProofImage failed:", error.message);
    throw new Error(`رفع الصورة فشل: ${error.message}`);
  }
  const { data: urlData } = supabase.storage.from("payment_proofs").getPublicUrl(data.path);
  console.log("[DB] uploadProofImage ✅ →", urlData.publicUrl);
  return urlData.publicUrl;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────

export async function createNotification(params: {
  user_id: string;
  title: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .insert({ ...params, is_read: false });
  if (error) console.warn("[DB] createNotification failed:", error.message);
}

export async function getUserNotifications(_userId: string): Promise<Notification[]> {
  // Notifications are in Supabase which has broken RLS — return empty until migrated
  return [];
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw toError(error);
}

// ─── PAYMENT SETTINGS ──────────────────────────────────────────

export async function getPaymentSettings(): Promise<PaymentSettings[]> {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("*")
    .order("key");
  if (error) {
    console.warn("[DB] getPaymentSettings:", error.message);
    return [];
  }
  return data as PaymentSettings[];
}

export async function updatePaymentSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("payment_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) {
    console.error("[DB] updatePaymentSetting:", error.message);
    throw toError(error);
  }
}

export async function upsertPaymentSettings(settings: { key: string; value: string; label: string }[]): Promise<void> {
  const { error } = await supabase
    .from("payment_settings")
    .upsert(settings.map(s => ({ ...s, updated_at: new Date().toISOString() })), { onConflict: "key" });
  if (error) {
    console.error("[DB] upsertPaymentSettings:", error.message);
    throw toError(error);
  }
}
