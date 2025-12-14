/**
 * Statistics calculation utilities
 * Centralized functions for calculating statistics from deliveries data
 */

import type { FrontendDelivery } from "@/types/delivery";

/**
 * Statistics result structure
 */
export interface CalculatedStats {
  totalLivraisons: number;
  livreesReussies: number;
  echecs: number;
  enCours: number;
  pickups: number;
  expeditions: number;
  montantEncaisse: number;
  montantRestant: number;
  chiffreAffaires: number;
}

/**
 * Calculate statistics from an array of deliveries
 * @param deliveries - Array of frontend delivery objects
 * @returns Calculated statistics object
 */
export function calculateStatsFromDeliveries(
  deliveries: FrontendDelivery[]
): CalculatedStats {
  const total = deliveries.length;
  const livrees = deliveries.filter((d) => d.statut === "livré").length;
  const echecs = deliveries.filter((d) => d.statut === "échec").length;
  const pickups = deliveries.filter((d) => d.statut === "pickup").length;
  const expeditions = deliveries.filter(
    (d) => d.statut === "expedition"
  ).length;
  const enCours = deliveries.filter((d) => d.statut === "en_cours").length;

  const encaisse = deliveries.reduce(
    (sum, d) => sum + (d.montant_encaisse || 0),
    0
  );
  const restant = deliveries.reduce((sum, d) => sum + (d.restant || 0), 0);

  return {
    totalLivraisons: total,
    livreesReussies: livrees,
    echecs,
    enCours,
    pickups,
    expeditions,
    montantEncaisse: encaisse,
    montantRestant: restant,
    chiffreAffaires: encaisse + restant,
  };
}




