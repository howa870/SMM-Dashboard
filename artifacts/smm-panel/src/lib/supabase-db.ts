import { supabase } from "./supabase";

export type Platform = {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
};

export type Service = {
  id: number;
  platform_id: number;
  name: string;
  description: string | null;
  price: number;
  min_order: number;
  max_order: number;
  status: string;
  platforms?: { name: string };
};

export type SupabaseOrder = {
  id: number;
  user_id: string;
  service_id: number;
  link: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  services?: { name: string };
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  balance: number;
  role: string;
};

export async function getPlatforms(): Promise<Platform[]> {
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name, icon, color")
    .eq("status", "active")
    .order("id");
  if (error) throw error;
  return data as Platform[];
}

export async function getServices(platformId?: number): Promise<Service[]> {
  let query = supabase
    .from("services")
    .select("*, platforms(name)")
    .eq("status", "active");
  if (platformId) query = query.eq("platform_id", platformId);
  const { data, error } = await query.order("id");
  if (error) throw error;
  return data as Service[];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });
  if (error) throw error;
}

export async function getUserOrders(userId: string): Promise<SupabaseOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, services(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SupabaseOrder[];
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
  if (error) throw error;
  return data as SupabaseOrder;
}

export async function deductBalance(userId: string, newBalance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (error) throw error;
}
