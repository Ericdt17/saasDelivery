/**
 * React Query hook for searching deliveries
 */

import { useQuery } from "@tanstack/react-query";
import { searchDeliveries, type FrontendDelivery } from "@/services/search";
import { toast } from "sonner";

interface UseSearchOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

/**
 * Hook for searching deliveries
 */
export function useSearch(
  query: string,
  options: UseSearchOptions = {}
) {
  const { enabled = true, onError } = options;

  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchDeliveries(query),
    enabled: enabled && !!query && query.trim().length > 0,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error('Erreur lors de la recherche', {
        description: errorMessage
      });
      onError?.(error as Error);
    }
  });
}















