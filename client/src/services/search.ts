/**
 * Search API Service
 * Functions for searching deliveries
 */

import { apiGet } from './api';
import { API_ENDPOINTS } from '@/lib/api-config';
import {
  transformDeliveriesToFrontend,
  type BackendDelivery,
  type FrontendDelivery,
} from '@/lib/data-transform';

/**
 * Search deliveries by query string
 * @param query - Search query (searches in phone, items, quartier, etc.)
 */
export async function searchDeliveries(query: string): Promise<FrontendDelivery[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const response = await apiGet<BackendDelivery[]>(API_ENDPOINTS.SEARCH, { q: query });
  
  if (!response.data) {
    return [];
  }

  return transformDeliveriesToFrontend(response.data);
}





