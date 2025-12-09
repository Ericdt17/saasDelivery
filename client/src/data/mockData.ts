/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * 
 * All components have been migrated to use the API instead of mock data.
 * 
 * If you need types, import them from:
 * - @/types/delivery - For delivery-related types
 * - @/types/stats - For statistics types
 * - @/types/api - For API-related types
 * 
 * This file is kept temporarily for reference only.
 * DO NOT import from this file in new code.
 */

// Re-export types for backward compatibility (deprecated)
export type { StatutLivraison, TypeLivraison } from "@/types/delivery";

// All mock data has been removed - use API endpoints instead:
// - GET /api/v1/deliveries - For deliveries list
// - GET /api/v1/deliveries/:id - For single delivery
// - GET /api/v1/stats/daily - For daily statistics
// - GET /api/v1/search?q=... - For searching deliveries

// Chart data placeholders are now defined inline in chart components
// TODO: Add API endpoints for weekly performance and encaissements data
