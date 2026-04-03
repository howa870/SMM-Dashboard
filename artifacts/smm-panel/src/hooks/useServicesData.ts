import { useQuery } from "@tanstack/react-query";
import { getPlatforms, getServices } from "@/lib/supabase-db";

export function usePlatforms() {
  return useQuery({
    queryKey: ["supabase", "platforms"],
    queryFn: () => getPlatforms(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useServices(platformId?: number) {
  return useQuery({
    queryKey: ["supabase", "services", platformId],
    queryFn: () => getServices(platformId),
    staleTime: 5 * 60 * 1000,
  });
}
