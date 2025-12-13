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
  agency_id: number;
  whatsapp_group_id?: string;
  name: string;
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
 * Create new group (super admin only)
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
  const response = await apiPut<Group>(`/api/v1/groups/${id}`, data);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Delete group (soft delete, super admin only)
 */
export async function deleteGroup(id: number): Promise<boolean> {
  const response = await apiDelete(`/api/v1/groups/${id}`);
  return response.success;
}



