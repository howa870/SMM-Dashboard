import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile, upsertProfile } from "@/lib/supabase-db";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export function useProfile() {
  const { supabaseUser } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["supabase", "profile", supabaseUser?.id],
    queryFn: () => getProfile(supabaseUser!.id),
    enabled: !!supabaseUser,
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000, // auto-refetch كل 5 ثوان
  });

  useEffect(() => {
    if (supabaseUser && query.data === null) {
      upsertProfile({
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "مستخدم",
        email: supabaseUser.email || "",
        balance: 0,
        role: "user",
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["supabase", "profile"] }))
        .catch((err) => console.warn("[useProfile] upsertProfile failed:", err?.message || err));
    }
  }, [supabaseUser, query.data]);

  return query;
}

export function useProfileQueryKey(userId?: string) {
  return ["supabase", "profile", userId];
}
