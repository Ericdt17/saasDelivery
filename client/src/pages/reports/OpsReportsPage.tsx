/**
 * Rapports ops — layout aligned with parcoursAdmin Rapports:
 * tabs CA / Livraisons (stats only) / Dépenses (full detail) / Salaires RH.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchRevenueReport,
  fetchExpenseReport,
  type RevenueDeliveryLine,
  type RevenueReport,
  type ExpenseReport,
} from "@/services/opsReports";
import { useHrAttendancesSummary, useHrEmployees } from "@/hooks/useHr";
import {
  buildPayrollRowsByEmployee,
  countWorkdaysInMonth,
  formatMonthLabelFr,
  formatPayrollAmount,
  type PayrollByEmployeeResult,
} from "@/pages/hr/hrUi";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useExpensesSummary } from "@/hooks/useExpenses";
import {
  getDateRangeForPreset,
  monthYearFromDateRange,
  type DateRange,
} from "@/lib/date-utils";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppErrorExperience } from "@/components/errors/AppErrorExperience";
import {
  BarChart3,
  CheckCircle,
  FileText,
  HandCoins,
  Package,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

const fmtXaf = (n: number) => `${n.toLocaleString("fr-FR")} F`;

function summarizeDeliveries(deliveries: RevenueDeliveryLine[]) {
  let deliveryCount = 0;
  let expeditionCount = 0;
  let feeDelivery = 0;
  let feeExpedition = 0;
  const byStatus = new Map<string, number>();

  for (const d of deliveries) {
    if (d.type === "expedition") {
      expeditionCount += 1;
      feeExpedition += d.delivery_fee || 0;
    } else {
      deliveryCount += 1;
      feeDelivery += d.delivery_fee || 0;
    }
    const label = d.status_label || d.status || "—";
    byStatus.set(label, (byStatus.get(label) || 0) + 1);
  }

  return {
    deliveryCount,
    expeditionCount,
    feeDelivery,
    feeExpedition,
    totalFees: feeDelivery + feeExpedition,
    totalCourses: deliveries.length,
    statusChartData: Array.from(byStatus.entries())
      .map(([statut, value]) => ({ statut, value }))
      .sort((a, b) => b.value - a.value),
  };
}

function PeriodBanner({ startDate, endDate, countLabel }: {
  startDate: string;
  endDate: string;
  countLabel?: string;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      Période :{" "}
      <span className="font-medium text-foreground">
        {startDate === endDate ? startDate : `${startDate} — ${endDate}`}
      </span>
      {countLabel ? (
        <span className="ml-1">— {countLabel}</span>
      ) : null}
    </p>
  );
}

function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ChiffreAffairesTab({
  revenue,
  expenses,
  payroll,
  payrollMonthLabel,
  generalExpensesTotal,
  isLoading,
  startDate,
  endDate,
}: {
  revenue: RevenueReport | undefined;
  expenses: ExpenseReport | undefined;
  payroll: PayrollByEmployeeResult | undefined;
  payrollMonthLabel: string;
  /** Dépenses générales saisies dans le dashboard (mois d'imputation). */
  generalExpensesTotal: number;
  isLoading: boolean;
  startDate: string;
  endDate: string;
}) {
  const expenseTotal =
    expenses?.total_amount ?? revenue?.total_expenses ?? 0;
  const byType =
    expenses?.par_charge_type ?? revenue?.expenses_par_type ?? [];
  const salariesTotal = payroll?.estimatedPayroll ?? 0;
  const revenues = revenue?.total_delivery_fees ?? 0;
  const netRevenue =
    revenues - expenseTotal - salariesTotal - generalExpensesTotal;

  if (isLoading) return <LoadingBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PeriodBanner startDate={startDate} endDate={endDate} />

      <div className="rounded-xl border bg-gradient-to-r from-success/10 via-success/5 to-transparent border-success/20 p-5">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Revenu net
        </p>
        <p className="text-3xl md:text-4xl font-bold text-success tabular-nums">
          {fmtXaf(netRevenue)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Revenus − dépenses ops (API) − salaires (RH) − dépenses générales
          (saisies)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Revenus</p>
          <p className="text-2xl font-semibold tabular-nums">
            {fmtXaf(revenues)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {revenue?.billed_count ?? 0} courses facturées
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">
            Dépenses ops (API)
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {fmtXaf(expenseTotal)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {expenses?.expense_count ?? revenue?.expense_count ?? 0} lignes —
            API livraisons
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">
            Salaires estimés
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPayrollAmount(payroll?.estimatedPayroll ?? null)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {payrollMonthLabel}
            {payroll != null
              ? ` · ${payroll.activeCount} actif${payroll.activeCount !== 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">
            Dépenses générales (saisies)
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {fmtXaf(generalExpensesTotal)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {payrollMonthLabel} — onglet Dépenses
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 pt-4">
          <h3 className="text-sm font-semibold">Dépenses par type</h3>
        </div>
        <div className="overflow-x-auto p-4 pt-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byType.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-muted-foreground py-6"
                  >
                    Aucune dépense sur la période
                  </TableCell>
                </TableRow>
              ) : (
                byType.map((row) => (
                  <TableRow key={row.charge_type_name}>
                    <TableCell className="font-medium">
                      {row.charge_type_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtXaf(row.total_amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell className="font-medium">
                  Salaires RH (estimé)
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPayrollAmount(payroll?.estimatedPayroll ?? null)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  Dépenses générales (saisies dashboard)
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtXaf(generalExpensesTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">
                  Total coûts (ops + salaires + générales)
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmtXaf(expenseTotal + salariesTotal + generalExpensesTotal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}

function LivraisonsTab({
  revenue,
  isLoading,
  startDate,
  endDate,
}: {
  revenue: RevenueReport | undefined;
  isLoading: boolean;
  startDate: string;
  endDate: string;
}) {
  const stats = useMemo(
    () => summarizeDeliveries(revenue?.deliveries ?? []),
    [revenue]
  );

  if (isLoading) return <LoadingBlock rows={5} />;

  return (
    <div className="space-y-6">
      <PeriodBanner
        startDate={startDate}
        endDate={endDate}
        countLabel={`${stats.totalCourses} enregistrement${stats.totalCourses !== 1 ? "s" : ""}`}
      />

      <div className="rounded-xl border bg-gradient-to-r from-success/10 via-success/5 to-transparent border-success/20 p-5">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Revenus totaux agence
        </p>
        <p className="text-3xl md:text-4xl font-bold text-success tabular-nums mb-4">
          {fmtXaf(revenue?.total_delivery_fees ?? stats.totalFees)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-card/80 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">
              Revenu livraison
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {fmtXaf(stats.feeDelivery)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Frais de livraison
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/80 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">
              Revenu expédition
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {fmtXaf(stats.feeExpedition)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Frais / marge expédition
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total courses"
          value={stats.totalCourses}
          icon={Package}
        />
        <StatCard
          title="Livraisons"
          value={stats.deliveryCount}
          icon={Package}
          variant="info"
        />
        <StatCard
          title="Expéditions"
          value={stats.expeditionCount}
          icon={Truck}
          variant="expedition"
        />
        <StatCard
          title="Facturées"
          value={revenue?.billed_count ?? 0}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Frais totaux"
          value={fmtXaf(revenue?.total_delivery_fees ?? stats.totalFees)}
          icon={Wallet}
          variant="success"
        />
        <StatCard
          title="Frais livraison"
          value={fmtXaf(stats.feeDelivery)}
          icon={TrendingUp}
          variant="info"
        />
        <StatCard
          title="Frais expédition"
          value={fmtXaf(stats.feeExpedition)}
          icon={Truck}
          variant="expedition"
        />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold mb-4">Répartition par statut</h3>
        <div className="h-[300px]">
          {stats.statusChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Aucune donnée sur cette période
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.statusChartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="statut"
                  tick={{
                    fontSize: 12,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 12,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Nombre"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function DepensesTab({
  expenses,
  isLoading,
  startDate,
  endDate,
}: {
  expenses: ExpenseReport | undefined;
  isLoading: boolean;
  startDate: string;
  endDate: string;
}) {
  if (isLoading) return <LoadingBlock rows={5} />;

  const lines = expenses?.expenses ?? [];
  const byType = expenses?.par_charge_type ?? [];
  const byPerson = expenses?.par_personne ?? [];
  const total = expenses?.total_amount ?? 0;

  return (
    <div className="space-y-6">
      <PeriodBanner
        startDate={startDate}
        endDate={endDate}
        countLabel={`${expenses?.expense_count ?? 0} dépense${(expenses?.expense_count ?? 0) !== 1 ? "s" : ""}`}
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Total dépenses"
          value={fmtXaf(total)}
          icon={Wallet}
          variant="destructive"
        />
        <StatCard
          title="Nombre de dépenses"
          value={expenses?.expense_count ?? 0}
          icon={FileText}
          variant="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold">
              Dépenses par type de charge
            </h3>
          </div>
          <div className="overflow-x-auto p-4 pt-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Nombre</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-6"
                    >
                      Aucune donnée.
                    </TableCell>
                  </TableRow>
                ) : (
                  byType.map((row) => (
                    <TableRow key={row.charge_type_name}>
                      <TableCell className="font-medium">
                        {row.charge_type_name}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtXaf(row.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {byType.length > 0 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtXaf(total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold">Dépenses par personne</h3>
          </div>
          <div className="overflow-x-auto p-4 pt-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Personne</TableHead>
                  <TableHead className="text-right">Nombre</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPerson.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-6"
                    >
                      Aucune donnée.
                    </TableCell>
                  </TableRow>
                ) : (
                  byPerson.map((row) => (
                    <TableRow key={row.person_name}>
                      <TableCell className="font-medium">
                        {row.person_name}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtXaf(row.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {byPerson.length > 0 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtXaf(total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold">Détail des dépenses</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Personne</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Créé par</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    Aucune dépense sur la période
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {e.expense_date}
                    </TableCell>
                    <TableCell>{e.person_name}</TableCell>
                    <TableCell>{e.charge_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.created_by_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.note || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtXaf(e.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function SalairesTab({
  payroll,
  monthLabel,
  isLoading,
}: {
  payroll: PayrollByEmployeeResult | undefined;
  monthLabel: string;
  isLoading: boolean;
}) {
  if (isLoading) return <LoadingBlock rows={4} />;

  const rows = payroll?.rows ?? [];
  const estimated = payroll?.estimatedPayroll ?? null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Masse salariale estimée —{" "}
        <span className="font-medium text-foreground">{monthLabel}</span>
        <span className="ml-1">
          (base − absences / retards, lun–sam)
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Net estimé"
          value={formatPayrollAmount(estimated)}
          icon={HandCoins}
          variant="success"
        />
        <StatCard
          title="Base totale"
          value={fmtXaf(payroll?.basePayroll ?? 0)}
          icon={Wallet}
        />
        <StatCard
          title="Effectif actifs"
          value={payroll?.activeCount ?? 0}
          icon={Users}
          variant="info"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Employé</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Présents</TableHead>
                <TableHead className="text-right">Retards</TableHead>
                <TableHead className="text-right">Absents</TableHead>
                <TableHead className="text-right">Pénalités</TableHead>
                <TableHead className="text-right">Net estimé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Aucun employé actif
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell className="font-medium">{r.fullName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtXaf(r.salaryBase)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.daysPresent}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.daysLate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.daysAbsent}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPayrollAmount(r.penalties)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPayrollAmount(r.estimatedNet)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {rows.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold" colSpan={6}>
                    Total net estimé
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatPayrollAmount(estimated)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </div>
    </div>
  );
}

export default function OpsReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeForPreset("thisMonth")
  );
  const { startDate, endDate } = dateRange;
  const rangeReady = Boolean(startDate && endDate);
  const { year, month } = useMemo(
    () => monthYearFromDateRange(dateRange),
    [dateRange]
  );
  const payrollMonthLabel = formatMonthLabelFr(year, month);
  const workdaysInMonth = useMemo(
    () => countWorkdaysInMonth(year, month),
    [year, month]
  );

  // Dépenses générales saisies dans l'onglet Dépenses (mois d'imputation)
  const generalExpensesQuery = useExpensesSummary(year, month);
  const generalExpensesTotal = generalExpensesQuery.data?.total ?? 0;

  const revenueQuery = useQuery({
    queryKey: ["ops-reports", "revenue", startDate, endDate],
    queryFn: () => fetchRevenueReport(startDate, endDate),
    enabled: rangeReady,
  });
  const expenseQuery = useQuery({
    queryKey: ["ops-reports", "expenses", startDate, endDate],
    queryFn: () => fetchExpenseReport(startDate, endDate),
    enabled: rangeReady,
  });

  const {
    data: employees = [],
    isLoading: loadingEmployees,
    isError: errorEmployees,
    error: employeesError,
    refetch: refetchEmployees,
  } = useHrEmployees({ year, month });
  const {
    data: monthSummary = [],
    isLoading: loadingSummary,
    isError: errorSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useHrAttendancesSummary(month, year);

  const payroll = useMemo(
    () =>
      buildPayrollRowsByEmployee({
        employees,
        monthSummary,
        workdaysInMonth,
        year,
        month,
      }),
    [employees, monthSummary, workdaysInMonth, year, month]
  );

  const payrollLoading = loadingEmployees || loadingSummary;
  const payrollError = errorEmployees || errorSummary;
  const payrollErrorObj = employeesError || summaryError;

  const caLoading =
    revenueQuery.isLoading || expenseQuery.isLoading || payrollLoading;
  const hardError =
    revenueQuery.isError && expenseQuery.isError
      ? revenueQuery.error || expenseQuery.error
      : null;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Rapports
          </h1>
          <p className="text-muted-foreground">
            Revenus, dépenses ops et salaires RH estimés.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {hardError ? (
        <AppErrorExperience
          error={hardError}
          onRetry={() => {
            void revenueQuery.refetch();
            void expenseQuery.refetch();
          }}
        />
      ) : (
        <Tabs defaultValue="chiffre-affaires">
          <TabsList>
            <TabsTrigger value="chiffre-affaires">
              Chiffre d&apos;affaires
            </TabsTrigger>
            <TabsTrigger value="livraisons">Livraisons</TabsTrigger>
            <TabsTrigger value="depenses">Dépenses</TabsTrigger>
            <TabsTrigger value="salaires">Salaires</TabsTrigger>
          </TabsList>

          <TabsContent value="chiffre-affaires" className="mt-6">
            {revenueQuery.isError ? (
              <AppErrorExperience
                error={revenueQuery.error}
                onRetry={() => void revenueQuery.refetch()}
              />
            ) : (
              <ChiffreAffairesTab
                revenue={revenueQuery.data}
                expenses={expenseQuery.data}
                payroll={payrollError ? undefined : payroll}
                payrollMonthLabel={payrollMonthLabel}
                generalExpensesTotal={generalExpensesTotal}
                isLoading={caLoading}
                startDate={startDate}
                endDate={endDate}
              />
            )}
          </TabsContent>

          <TabsContent value="livraisons" className="mt-6">
            {revenueQuery.isError ? (
              <AppErrorExperience
                error={revenueQuery.error}
                onRetry={() => void revenueQuery.refetch()}
              />
            ) : (
              <LivraisonsTab
                revenue={revenueQuery.data}
                isLoading={revenueQuery.isLoading}
                startDate={startDate}
                endDate={endDate}
              />
            )}
          </TabsContent>

          <TabsContent value="depenses" className="mt-6">
            {expenseQuery.isError ? (
              <AppErrorExperience
                error={expenseQuery.error}
                onRetry={() => void expenseQuery.refetch()}
              />
            ) : (
              <DepensesTab
                expenses={expenseQuery.data}
                isLoading={expenseQuery.isLoading}
                startDate={startDate}
                endDate={endDate}
              />
            )}
          </TabsContent>

          <TabsContent value="salaires" className="mt-6">
            {payrollError ? (
              <AppErrorExperience
                error={payrollErrorObj}
                onRetry={() => {
                  void refetchEmployees();
                  void refetchSummary();
                }}
              />
            ) : (
              <SalairesTab
                payroll={payroll}
                monthLabel={payrollMonthLabel}
                isLoading={payrollLoading}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
