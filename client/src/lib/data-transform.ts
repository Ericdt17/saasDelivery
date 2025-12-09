/**
 * Data Transformation Utilities
 * Maps backend API data format to frontend display format and vice versa
 */

// Re-export types from types directory for backward compatibility
export type {
  BackendDelivery,
  BackendHistory,
  FrontendDelivery,
  FrontendHistory,
  StatutLivraison,
  TypeLivraison,
  BackendStatus,
  ModificationType,
  FrontendModification,
} from '@/types/delivery';

// Import types for use in this file
import type {
  BackendDelivery,
  BackendHistory,
  FrontendDelivery,
  FrontendHistory,
  StatutLivraison,
} from '@/types/delivery';

/**
 * Map backend status to frontend status
 */
function mapStatusToFrontend(backendStatus: string): StatutLivraison {
  const statusMap: Record<string, StatutLivraison> = {
    'pending': 'en_cours',
    'delivered': 'livré',
    'failed': 'échec',
    'pickup': 'pickup',
    'expedition': 'expedition',
  };
  
  return statusMap[backendStatus.toLowerCase()] || 'en_cours';
}

/**
 * Map frontend status to backend status
 */
export function mapStatusToBackend(frontendStatus: StatutLivraison): string {
  const statusMap: Record<StatutLivraison, string> = {
    'en_cours': 'pending',
    'livré': 'delivered',
    'échec': 'failed',
    'pickup': 'pickup',
    'expedition': 'expedition',
  };
  
  return statusMap[frontendStatus] || 'pending';
}

/**
 * Derive type from backend delivery data
 * - If carrier exists and status is expedition, type is "expedition"
 * - If status is pickup, type is "pickup"
 * - Otherwise type is "livraison"
 */
function deriveType(backendDelivery: BackendDelivery): TypeLivraison {
  const status = backendDelivery.status.toLowerCase();
  
  if (status === 'expedition' || (backendDelivery.carrier && status !== 'pending' && status !== 'delivered' && status !== 'failed')) {
    return 'expedition';
  }
  
  if (status === 'pickup') {
    return 'pickup';
  }
  
  return 'livraison';
}

/**
 * Transform backend delivery to frontend format
 */
export function transformDeliveryToFrontend(backend: BackendDelivery): FrontendDelivery {
  const restant = Math.max(0, backend.amount_due - backend.amount_paid);
  
  return {
    id: backend.id,
    telephone: backend.phone || '',
    quartier: backend.quartier || '',
    produits: backend.items || '',
    montant_total: backend.amount_due || 0,
    montant_encaisse: backend.amount_paid || 0,
    restant: restant,
    statut: mapStatusToFrontend(backend.status),
    type: deriveType(backend),
    instructions: backend.notes || '',
    date_creation: backend.created_at || '',
    date_mise_a_jour: backend.updated_at || backend.created_at || '',
    carrier: backend.carrier || null, // Preserve carrier field
  };
}

/**
 * Transform frontend delivery to backend format (for create/update)
 */
export function transformDeliveryToBackend(frontend: Partial<FrontendDelivery>): Partial<BackendDelivery> {
  const backend: Partial<BackendDelivery> = {};
  
  if (frontend.telephone !== undefined) {
    backend.phone = frontend.telephone;
  }
  
  if (frontend.produits !== undefined) {
    backend.items = frontend.produits;
  }
  
  if (frontend.montant_total !== undefined) {
    backend.amount_due = frontend.montant_total;
  }
  
  if (frontend.montant_encaisse !== undefined) {
    backend.amount_paid = frontend.montant_encaisse;
  }
  
  if (frontend.statut !== undefined) {
    backend.status = mapStatusToBackend(frontend.statut);
  }
  
  if (frontend.quartier !== undefined) {
    backend.quartier = frontend.quartier;
  }
  
  if (frontend.instructions !== undefined) {
    backend.notes = frontend.instructions;
  }
  
  // If type is expedition, we might want to set carrier
  // For now, we'll leave carrier as-is if not provided
  // This can be enhanced later if needed
  
  return backend;
}

/**
 * Transform backend history to frontend format
 */
export function transformHistoryToFrontend(backend: BackendHistory): FrontendHistory {
  return {
    id: backend.id,
    livraison_id: backend.delivery_id,
    action: backend.action || '',
    details: backend.details || '',
    date: backend.created_at || '',
  };
}

/**
 * Transform array of backend deliveries to frontend format
 */
export function transformDeliveriesToFrontend(backends: BackendDelivery[]): FrontendDelivery[] {
  return backends.map(transformDeliveryToFrontend);
}

/**
 * Transform array of backend history to frontend format
 */
export function transformHistoriesToFrontend(backends: BackendHistory[]): FrontendHistory[] {
  return backends.map(transformHistoryToFrontend);
}

