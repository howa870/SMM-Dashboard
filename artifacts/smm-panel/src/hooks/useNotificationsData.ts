import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserNotifications, markNotificationsRead } from "@/lib/supabase-db";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const NOTIF_KEY = ["supabase", "notifications"];

function useNotificationsQuery() {
  const { supabaseUser } = useSupabaseAuth();
  return useQuery({
    queryKey: [...NOTIF_KEY, supabaseUser?.id],
    queryFn: () => getUserNotifications(supabaseUser!.id),
    enabled: !!supabaseUser,
    refetchInterval: 30_000,
    retry: 1,
  });
}

function useNotificationsSubscription() {
  const { supabaseUser } = useSupabaseAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabaseUser) return;
    const channel = supabase
      .channel(`realtime:notifications:${supabaseUser.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${supabaseUser.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: [...NOTIF_KEY, supabaseUser.id] });
      })
      .subscribe((status, err) => {
        if (err) console.warn("[Realtime] notifications channel error:", err);
        else console.log("[Realtime] notifications:", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser?.id, queryClient]);
}

export function useNotifications() {
  useNotificationsSubscription();
  return useNotificationsQuery();
}

export function useMarkNotificationsRead() {
  const { supabaseUser } = useSupabaseAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markNotificationsRead(supabaseUser!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...NOTIF_KEY, supabaseUser?.id] });
    },
  });
}

export function useUnreadCount() {
  const { data: notifications } = useNotificationsQuery();
  return notifications?.filter(n => !n.is_read).length || 0;
}
