/**
 * Authentication Service
 * Handles login, logout, and token management
 */

import { apiPost, apiGet } from "./api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      role: "agency" | "super_admin";
      agencyId: number | null;
    };
  };
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: "agency" | "super_admin";
  agencyId: number | null;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    const response = await apiPost<LoginResponse["data"]>("/api/v1/auth/login", {
      email,
      password,
    });

    if (response.success && response.data) {
      // Store token and user info
      localStorage.setItem(TOKEN_KEY, response.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    }

    return response as LoginResponse;
  } catch (error: any) {
    // Handle API errors (401, 400, etc.)
    return {
      success: false,
      error: error.message || "Authentication failed",
      data: undefined as any,
    };
  }
}

/**
 * Logout - clear token and user info
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get stored token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored user info
 */
export function getUser(): UserInfo | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as UserInfo;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Get current user info from API
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  try {
    const response = await apiGet<{ user: UserInfo }>("/api/v1/auth/me");
    if (response.success && response.data) {
      const user = response.data.user;
      // Update stored user info
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  } catch (error) {
    // If token is invalid, clear it
    logout();
    return null;
  }
}

