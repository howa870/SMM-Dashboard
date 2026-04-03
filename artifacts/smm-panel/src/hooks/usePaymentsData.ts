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

export const PAYMENTS_KEY = ["supabase", "payments"];
export const ADMIN_PAYMENTS_KEY = ["supabase", "admin", "payments"];

export function useUserPayments() {
  const { supabaseUser } = useSupabaseAuth();
  return useQuery({
    queryKey: [...PAYMENTS_KEY, supabaseUser?.id],
    queryFn: () => getUserPayments(supabaseUser!.id),
    enabled: !!supabaseUser,
  });
}

export function useAllPayments() {
  return useQuery({
    queryKey: ADMIN_PAYMENTS_KEY,
    queryFn: getAllPayments,
    refetchInterval: 30 * 1000,
  });
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
    mutationFn: (paymentId: number) => rejectPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PAYMENTS_KEY });
    },
  });
}
