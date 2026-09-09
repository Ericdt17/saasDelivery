export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  TIMEOUT: 30000, // 30 seconds to handle Render free tier cold starts (10-30s wake time)
};

export function buildApiUrl(path: string): string {
  const prefix = path.startsWith("/") ? "" : "/";
  return `${API_CONFIG.BASE_URL}${prefix}${path}`;
}

export const API_ENDPOINTS = {
  WAITLIST: "/api/v1/waitlist",
  HR_EMPLOYEES: "/api/v1/hr/employees",
  HR_ATTENDANCES: "/api/v1/hr/attendances",
  RECRUITMENT: "/api/v1/recruitment",
  MERCHANT_TERMS: "/api/v1/merchant-terms",
  AGENCIES: "/api/v1/agencies",
};
