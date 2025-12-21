/**
 * React Query hook for fetching daily statistics
 */

import { useQuery } from "@tanstack/react-query";
import { getDailyStats, type FrontendStats } from "@/services/stats";
import { toast } from "sonner";

interface UseStatsOptions {
  date?: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export function useStats(options: UseStatsOptions = {}) {
  const { date, enabled = true, onError } = options;

  return useQuery({
    queryKey: ['dailyStats', date],
    queryFn: () => getDailyStats(date),
    enabled,
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      toast.error('Erreur lors du chargement des statistiques', {
        description: errorMessage
      });
      onError?.(error as Error);
    }
  });
}







