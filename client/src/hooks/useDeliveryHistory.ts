/**
 * React Query hook for delivery history
 */

import { useQuery } from "@tanstack/react-query";
import { getDeliveryHistory, type FrontendHistory } from "@/services/deliveries";
import { toast } from "sonner";

interface UseDeliveryHistoryOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

/**
 * Hook for fetching delivery history
 */
export function useDeliveryHistory(
  deliveryId: number | string | undefined,
  options: UseDeliveryHistoryOptions = {}
) {
  const { enabled = true, onError } = options;

  return useQuery({
    queryKey: ['deliveryHistory', deliveryId],
    queryFn: () => getDeliveryHistory(deliveryId!),
    enabled: enabled && !!deliveryId,
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error('Erreur lors du chargement de l\'historique', {
        description: errorMessage
      });
      onError?.(error as Error);
    }
  });
}







