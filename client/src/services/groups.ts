/**
 * Groups Service
 * API calls for group management
 */

import { apiGet, apiPost, apiPut, apiDelete } from "./api";

export interface Group {
  id: number;
  agency_id: number;
  whatsapp_group_id: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agency_name?: string;
}

export interface CreateGroupRequest {
  agency_id?: number; // Optional - required for super admin, auto-set for agency admin
  whatsapp_group_id: string; // Required
  name: string; // Required
  is_active?: boolean;
}

export interface UpdateGroupRequest {
  name?: string;
  is_active?: boolean;
}

/**
 * Get all groups (filtered by agency for agency admins)
 */
export async function getGroups(): Promise<Group[]> {
  const response = await apiGet<Group[]>("/api/v1/groups");
  if (response.success && response.data) {
    return Array.isArray(response.data) ? response.data : [];
  }
  return [];
}

/**
 * Get group by ID
 */
export async function getGroupById(id: number): Promise<Group | null> {
  const response = await apiGet<Group>(`/api/v1/groups/${id}`);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Create new group
 * - Agency admins can create groups for their own agency
 * - Super admins can create groups for any agency
 */
export async function createGroup(data: CreateGroupRequest): Promise<Group | null> {
  const response = await apiPost<Group>("/api/v1/groups", data);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Update group
 */
export async function updateGroup(
  id: number,
  data: UpdateGroupRequest
): Promise<Group | null> {
  console.log('[updateGroup] Called with:', { id, data });
  console.log('[updateGroup] Making PUT request to:', `/api/v1/groups/${id}`);
  const response = await apiPut<Group>(`/api/v1/groups/${id}`, data);
  console.log('[updateGroup] Response:', response);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Delete group (soft delete - sets is_active to false)
 * - Agency admins can delete their own groups
 * - Super admins can delete any group
 */
export async function deleteGroup(id: number, permanent: boolean = false): Promise<boolean> {
  const endpoint = permanent 
    ? `/api/v1/groups/${id}?permanent=true`
    : `/api/v1/groups/${id}`;
  const response = await apiDelete(endpoint);
  return response.success;
}

/**
 * Hard delete group (permanently remove from database)
 * - Agency admins can hard delete their own groups
 * - Super admins can hard delete any group
 */
export async function hardDeleteGroup(id: number): Promise<boolean> {
  console.log('[hardDeleteGroup] Called with id:', id);
  console.log('[hardDeleteGroup] Making DELETE request to:', `/api/v1/groups/${id}?permanent=true`);
  return deleteGroup(id, true);
}



