/**
 * Tableau de bord — KPIs RH (super_admin).
 * Comptes agence : message réservé (plus de stats livraisons).
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Percent,
  Clock,
  Wallet,
  HandCoins,
  BookOpenCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHrAttendances,
  useHrAttendancesSummary,
  useHrEmployees,
  useHrRegulations,
} from "@/hooks/useHr";
import {
  buildHrDashboardStats,
  countWorkdaysInMonth,
  formatAttendanceRatePct,
  formatMonthLabelFr,
  formatPayrollAmount,
  todayDateStringDouala,
} from "@/pages/hr/hrUi";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  getDateRangeForPreset,
  monthYearFromDateRange,
  snapDateRangeToMonth,
  type DateRange,
} from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center px-4">
        <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground max-w-md">
          Tableau de bord réservé à l’administration.
        </p>
      </div>
    );
  }

  return <HrDashboardContent />;
};

function HrDashboardContent() {
  const today = todayDateStringDouala();
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeForPreset("thisMonth")
  );
  const { year, month } = useMemo(
    () => monthYearFromDateRange(dateRange),
    [dateRange]
  );

  const {
    data: employees = [],
    isLoading: loadingEmployees,
    isError: errorEmployees,
  } = useHrEmployees();
  const {
    data: todayAttendances = [],
    isLoading: loadingToday,
    isError: errorToday,
  } = useHrAttendances({ date: today });
  const {
    data: monthSummary = [],
    isLoading: loadingSummary,
    isError: errorSummary,
  } = useHrAttendancesSummary(month, year);

  const stats = useMemo(
    () =>
      buildHrDashboardStats({
        employees,
        todayAttendances,
        monthSummary,
        workdaysInMonth: countWorkdaysInMonth(year, month),
        year,
        month,
      }),
    [employees, todayAttendances, monthSummary, year, month]
  );

  const isLoading = loadingEmployees || loadingToday || loadingSummary;
  const hasError = errorEmployees || errorToday || errorSummary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-muted-foreground">
              Présence, effectifs et salaires (lun–sam) —{" "}
              <span className="capitalize">{formatMonthLabelFr(year, month)}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end w-full sm:w-auto">
          <DateRangePicker
            value={dateRange}
            onChange={(next) => setDateRange(snapDateRangeToMonth(next))}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/hr/employees">Employés</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/hr/attendances">Présences</Link>
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : hasError ? (
        <p className="text-sm text-muted-foreground">
          Impossible de charger les indicateurs RH. Réessayez dans un instant.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            size="sm"
            title="Employés actifs"
            value={stats.activeCount}
            icon={Users}
            variant="default"
          />
          <StatCard
            size="sm"
            title="Présents aujourd’hui"
            value={stats.presentToday}
            icon={UserCheck}
            variant="success"
          />
          <StatCard
            size="sm"
            title="Taux de présence (mois)"
            value={formatAttendanceRatePct(stats.attendanceRatePct)}
            icon={Percent}
            variant="info"
          />
          <StatCard
            size="sm"
            title="Retards (mois)"
            value={stats.lateDaysMonth}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            size="sm"
            title="Masse salariale de base"
            value={formatPayrollAmount(stats.basePayroll)}
            icon={Wallet}
            variant="default"
            iconTooltip="Somme des salaires de base des employés actifs"
          />
          <StatCard
            size="sm"
            title="Salaire à payer (estimé)"
            value={formatPayrollAmount(stats.estimatedPayroll)}
            icon={HandCoins}
            variant="expedition"
            iconTooltip="Présent = journée · Retard = demi-journée · Absent = 0 — base mois complet (lun–sam)"
          />
        </div>
      )}

      <RegulationIndicatorCard />
    </div>
  );
}

/** « X employés n'ont pas pris connaissance du règlement » — lien vers le suivi. */
function RegulationIndicatorCard() {
  const { data: regulations = [] } = useHrRegulations();
  const regulation = regulations[0];
  if (!regulation?.stats || regulation.stats.not_read === 0) return null;
  return (
    <Link
      to="/hr/reglement"
      className="block max-w-xl rounded-xl border border-orange-200 bg-orange-50 p-4 transition-colors hover:bg-orange-100"
    >
      <div className="flex items-start gap-3">
        <BookOpenCheck className="mt-0.5 h-5 w-5 text-orange-600" />
        <div>
          <p className="font-medium text-orange-900">
            Règlement intérieur {regulation.current_version_label} —{" "}
            {regulation.stats.not_read}{" "}
            {regulation.stats.not_read > 1
              ? "employés n'ont pas encore pris connaissance"
              : "employé n'a pas encore pris connaissance"}
          </p>
          <p className="mt-0.5 text-sm text-orange-700">
            Voir les employés →
          </p>
        </div>
      </div>
    </Link>
  );
}

export default Index;
