import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserPayments,
  getAllPayments,
  createPayment,
  approvePayment,
  rejectPayment,
  type Payment,
} from "@/lib/supabase-db";
import { useSupabaseAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const PAYMENTS_KEY = ["supabase", "payments"];
export const ADMIN_PAYMENTS_KEY = ["supabase", "admin", "payments"];

export function useUserPayments() {
  const { supabaseUser } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...PAYMENTS_KEY, supabaseUser?.id],
    queryFn: () => getUserPayments(supabaseUser!.id),
    enabled: !!supabaseUser,
    retry: 1,
  });

  useEffect(() => {
    if (!supabaseUser) return;
    const channel = supabase
      .channel(`payments:${supabaseUser.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "payments",
        filter: `user_id=eq.${supabaseUser.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: [...PAYMENTS_KEY, supabaseUser.id] });
      })
      .subscribe((status, err) => {
        if (err) console.warn("[Realtime] payments channel error:", err);
        else console.log("[Realtime] payments:", status);
      });
    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser?.id, queryClient]);

  return query;
}

export function useAllPayments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_PAYMENTS_KEY,
    queryFn: getAllPayments,
    refetchInterval: 30 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-payments")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "payments",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
      })
      .subscribe((status, err) => {
        if (err) console.warn("[Realtime] admin-payments channel error:", err);
        else console.log("[Realtime] admin-payments:", status);
      });
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { supabaseUser } = useSupabaseAuth();
  return useMutation({
    mutationFn: (params: Omit<Parameters<typeof createPayment>[0], "user_id">) =>
      createPayment({ ...params, user_id: supabaseUser!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
    },
  });
}

export function useApprovePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, userId, amount }: { paymentId: number; userId: string; amount: number }) =>
      approvePayment(paymentId, userId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["supabase", "profile"] });
    },
  });
}

export function useRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, userId }: { paymentId: number; userId: string }) =>
      rejectPayment(paymentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
    },
  });
}
