/**
 * RH — fiche employé : infos + stats mois (présence / salaire)
 * Correction manuelle présent / absent sur chaque jour ouvré.
 */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  UserCog,
  CalendarCheck,
  Clock,
  UserX,
  Percent,
  Wallet,
  HandCoins,
  UserCheck,
} from "lucide-react";
import {
  useCreateManualAttendance,
  useHrAttendances,
  useHrAttendancesSummary,
  useHrEmployees,
} from "@/hooks/useHr";
import {
  attendanceStatusClassName,
  attendanceStatusLabel,
  buildEmployeeDetailStats,
  buildEmployeeMonthDayRows,
  canSetAttendanceStatus,
  currentMonthYearDouala,
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  formatAttendanceRatePct,
  formatCheckInTime,
  formatMonthLabelFr,
  formatPayrollAmount,
  formatSalary,
  type AttendanceStatus,
} from "@/pages/hr/hrUi";
import { HrMonthPicker } from "@/pages/hr/HrMonthPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [{ year, month }, setPeriod] = useState(currentMonthYearDouala);

  const { data: employees = [], isLoading: loadingEmployees } = useHrEmployees();
  const { data: monthSummary = [], isLoading: loadingSummary } =
    useHrAttendancesSummary(month, year);
  const { data: monthAttendances = [], isLoading: loadingAttendances } =
    useHrAttendances({
      employee_id: Number.isFinite(employeeId) ? employeeId : undefined,
      month,
      year,
    });
  const createManual = useCreateManualAttendance();

  const employee = useMemo(
    () => employees.find((e) => Number(e.id) === employeeId) ?? null,
    [employees, employeeId]
  );

  const summaryRow = useMemo(
    () =>
      monthSummary.find((r) => Number(r.employee_id) === employeeId) ?? null,
    [monthSummary, employeeId]
  );

  const stats = useMemo(
    () =>
      buildEmployeeDetailStats({
        salaryBase: employee?.salary_base ?? null,
        summary: summaryRow,
      }),
    [employee, summaryRow]
  );

  const dayRows = useMemo(
    () => buildEmployeeMonthDayRows(year, month, monthAttendances),
    [year, month, monthAttendances]
  );

  const isLoading = loadingEmployees || loadingSummary || loadingAttendances;
  const canEdit = Boolean(employee?.is_active);

  async function setStatus(date: string, status: AttendanceStatus) {
    if (!canEdit || !Number.isFinite(employeeId)) return;
    const key = `${date}:${status}`;
    setPendingKey(key);
    try {
      await createManual.mutateAsync({
        employee_id: employeeId,
        date,
        status,
      });
    } finally {
      setPendingKey(null);
    }
  }

  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Employé introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/hr/employees">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  if (!isLoading && !employee) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Aucun employé avec l’identifiant {employeeId}.
        </p>
        <Button asChild variant="outline">
          <Link to="/hr/employees">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  const enrolled = Boolean(employee?.is_enrolled || employee?.enrolled_at);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to="/hr/employees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Employés
            </Link>
          </Button>
          {isLoading || !employee ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <UserCog className="mt-1 h-8 w-8 text-muted-foreground" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {employee.full_name}
                </h1>
                <p className="text-muted-foreground">
                  {[employee.poste, employee.email].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={employee.is_active ? "default" : "secondary"}>
                    {employee.is_active ? "Actif" : "Inactif"}
                  </Badge>
                  <Badge variant={enrollmentBadgeVariant(enrolled)}>
                    {enrollmentBadgeLabel(enrolled)}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="employee-detail-month" className="sr-only">
              Mois
            </Label>
            <HrMonthPicker
              id="employee-detail-month"
              year={year}
              month={month}
              onChange={setPeriod}
            />
          </div>
          <Button asChild variant="outline">
            <Link to="/hr/attendances">Voir les présences</Link>
          </Button>
        </div>
      </div>

      {!isLoading && employee && !employee.is_active && (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed px-3 py-2">
          Employé inactif — exclu des totaux du tableau de bord (effectif,
          présence, masse salariale). Corrections manuelles désactivées.
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              size="sm"
              title="Présents (mois)"
              value={stats.daysPresent}
              icon={CalendarCheck}
              variant="success"
            />
            <StatCard
              size="sm"
              title="Retards (mois)"
              value={stats.daysLate}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              size="sm"
              title="Absents (mois)"
              value={stats.daysAbsent}
              icon={UserX}
              variant="destructive"
            />
            <StatCard
              size="sm"
              title="Taux de présence"
              value={formatAttendanceRatePct(stats.attendanceRatePct)}
              icon={Percent}
              variant="info"
              iconTooltip={`Sur ${stats.weekdaysElapsed} jours ouvrés (lun–sam)`}
            />
            <StatCard
              size="sm"
              title="Salaire de base"
              value={`${formatSalary(stats.salaryBase || null)} F`}
              icon={Wallet}
              variant="default"
            />
            <StatCard
              size="sm"
              title="Salaire à payer (estimé)"
              value={formatPayrollAmount(stats.estimatedPay)}
              icon={HandCoins}
              variant="expedition"
              iconTooltip="Présent (<08:30) = 1 · Retard (08:30–midi) = 0,5 · Non pointé après midi = absent (0)"
            />
          </div>

          <div className="stat-card overflow-hidden p-0">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Pointages du mois</h2>
              <p className="text-sm text-muted-foreground capitalize">
                {formatMonthLabelFr(year, month)} — lun–sam (jours écoulés).
                Sans pointage avant midi = absent.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Heure</TableHead>
                    <TableHead>Vérif.</TableHead>
                    <TableHead className="text-right w-[140px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Aucun jour ouvré écoulé sur ce mois.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dayRows.map((row) => {
                      const busy = pendingKey?.startsWith(`${row.date}:`);
                      const showPresent =
                        canEdit &&
                        canSetAttendanceStatus(row.status, "present");
                      const showLate =
                        canEdit && canSetAttendanceStatus(row.status, "late");
                      const showAbsent =
                        canEdit &&
                        canSetAttendanceStatus(row.status, "absent");
                      return (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>
                            <Badge
                              className={attendanceStatusClassName(row.status)}
                            >
                              {attendanceStatusLabel(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatCheckInTime(row.check_in_time)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.attendance_id == null
                              ? "—"
                              : [
                                  row.face_verified ? "visage" : null,
                                  row.gps_verified ? "GPS" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "manuel"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-0.5">
                              {showPresent ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Marquer présent"
                                  aria-label={`Marquer présent le ${row.date}`}
                                  disabled={busy || createManual.isPending}
                                  onClick={() =>
                                    void setStatus(row.date, "present")
                                  }
                                >
                                  <UserCheck className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {showLate ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Marquer en retard"
                                  aria-label={`Marquer en retard le ${row.date}`}
                                  disabled={busy || createManual.isPending}
                                  onClick={() =>
                                    void setStatus(row.date, "late")
                                  }
                                >
                                  <Clock className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {showAbsent ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Marquer absent"
                                  aria-label={`Marquer absent le ${row.date}`}
                                  disabled={busy || createManual.isPending}
                                  onClick={() =>
                                    void setStatus(row.date, "absent")
                                  }
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
