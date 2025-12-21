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
  montantEncaisse: number; // Montant brut (amount_paid + delivery_fee pour delivered)
  montantRestant: number; // Reste à payer (0 pour delivered car complètement payé)
  chiffreAffaires: number;
  totalTarifs?: number; // Somme des frais_livraison des livraisons "livré"
  montantNetEncaisse?: number; // Montant net = montantEncaisse - totalTarifs (à reverser au groupe)
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

  // Calculate total tariffs (sum of delivery_fee for "delivered" deliveries)
  const totalTarifs = deliveries
    .filter((d) => d.statut === "livré")
    .reduce((sum, d) => {
      const fee = Number(d.frais_livraison) || 0;
      return sum + fee;
    }, 0);

  // Calculate montantEncaisse (brut amount):
  // - For "delivered": amount_paid + delivery_fee (brut amount collected)
  // - For "failed": 0 (no amount to collect or reverse)
  // - For others: amount_paid only
  const encaisse = deliveries.reduce((sum, d) => {
    const amountPaid = Number(d.montant_encaisse) || 0;
    const deliveryFee = Number(d.frais_livraison) || 0;
    
    if (d.statut === "livré") {
      // For delivered: brut = amount_paid + delivery_fee
      return sum + amountPaid + deliveryFee;
    } else if (d.statut === "échec") {
      // For failed: no amount collected or to reverse
      return sum + 0;
    } else {
      // For others: amount_paid only
      return sum + amountPaid;
    }
  }, 0);

  // Calculate montantRestant:
  // - For "delivered": 0 (completely paid)
  // - For "failed": 0 (cannot collect anymore, considered lost)
  // - For others: restant as calculated (amount_due - amount_paid)
  const restant = deliveries.reduce((sum, d) => {
    if (d.statut === "livré") {
      // Delivered deliveries are completely paid, no remaining amount
      return sum + 0;
    } else if (d.statut === "échec") {
      // Failed deliveries: cannot collect anymore, restant = 0
      return sum + 0;
    } else {
      const remaining = Number(d.restant) || 0;
      return sum + remaining;
    }
  }, 0);

  // Calculate montantNetEncaisse (amount to reverse to group)
  // Only "delivered" deliveries contribute to this amount
  // = sum(amount_paid) for "delivered" deliveries only
  // This represents the net amount after deducting delivery fees for delivered items
  const montantNetEncaisse = deliveries.reduce((sum, d) => {
    if (d.statut === "livré") {
      // Only delivered deliveries contribute to amount to reverse
      // Net amount = amount_paid (after tariff deduction)
      const amountPaid = Number(d.montant_encaisse) || 0;
      return sum + amountPaid;
    } else {
      // Other statuses (en_cours, échec, etc.) don't contribute
      return sum + 0;
    }
  }, 0);

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
    totalTarifs,
    montantNetEncaisse,
  };
}




