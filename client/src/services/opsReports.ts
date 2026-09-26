/**
 * Ops reports — revenue/expense pulled from LivSight delivery-ops
 * via the backend proxy (super_admin).
 */

import { apiGet } from "./api";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1/ops-reports";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export interface RevenueDeliveryLine {
  id: number;
  type: "delivery" | "expedition";
  type_label: string;
  client_name: string;
  quartier: string;
  status: string;
  status_label: string;
  date: string;
  delivery_fee: number;
}

export interface ExpenseLine {
  id: number;
  expense_date: string;
  person_name: string;
  charge_name: string;
  amount: number;
  created_by_name: string;
  note: string | null;
}

export interface ChargeTypeTotal {
  charge_type_name: string;
  count: number;
  total_amount: number;
}

export interface PersonTotal {
  person_name: string;
  count: number;
  total_amount: number;
}

export interface RevenueReport {
  start_date: string;
  end_date: string;
  generated_at: string;
  deliveries: RevenueDeliveryLine[];
  total_delivery_fees: number;
  billed_count: number;
  expenses: ExpenseLine[];
  total_expenses: number;
  expense_count: number;
  net_revenue: number;
  expenses_par_type: ChargeTypeTotal[];
}

export interface ExpenseReport {
  start_date: string;
  end_date: string;
  generated_at: string;
  expenses: ExpenseLine[];
  total_amount: number;
  expense_count: number;
  par_charge_type: ChargeTypeTotal[];
  par_personne: PersonTotal[];
}

function rangeQuery(startDate: string, endDate: string): string {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return params.toString();
}

export async function fetchRevenueReport(
  startDate: string,
  endDate: string
): Promise<RevenueReport> {
  const res = await apiGet<RevenueReport>(
    `${BASE}/revenue?${rangeQuery(startDate, endDate)}`
  );
  return unwrap(res, "Impossible de charger le rapport de revenus");
}

export async function fetchExpenseReport(
  startDate: string,
  endDate: string
): Promise<ExpenseReport> {
  const res = await apiGet<ExpenseReport>(
    `${BASE}/expenses?${rangeQuery(startDate, endDate)}`
  );
  return unwrap(res, "Impossible de charger le rapport de dépenses");
}
