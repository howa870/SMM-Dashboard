import { useQuery } from "@tanstack/react-query";
import { getUserOrders } from "@/lib/supabase-db";
import { useSupabaseAuth } from "@/context/AuthContext";

export function useUserOrders() {
  const { supabaseUser } = useSupabaseAuth();
  return useQuery({
    queryKey: ["supabase", "orders", supabaseUser?.id],
    queryFn: () => getUserOrders(supabaseUser!.id),
    enabled: !!supabaseUser,
    staleTime: 0,
  });
}
