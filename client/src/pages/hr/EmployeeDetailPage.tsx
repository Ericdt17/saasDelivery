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
  Scale,
  Eye,
  Download,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateManualAttendance,
  useHrAttendances,
  useHrAttendancesSummary,
  useHrEmployees,
} from "@/hooks/useHr";
import {
  buildPayslipFileName,
  downloadPayslipPdf,
  previewPayslipPdf,
  sendPayslipWhatsapp,
} from "@/services/hr";
import {
  attendanceStatusClassName,
  attendanceStatusLabel,
  buildEmployeeDetailStats,
  buildEmployeeMonthDayRows,
  canSetAttendanceStatus,
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  formatAttendanceRatePct,
  formatCheckInTime,
  formatMonthLabelFr,
  formatPayrollAmount,
  formatPenaltyBreakdownLines,
  formatDayPenaltyRateLines,
  estimateDayPenaltyRates,
  countWorkdaysInMonth,
  formatSalary,
  type AttendanceStatus,
} from "@/pages/hr/hrUi";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  getDateRangeForPreset,
  monthYearFromDateRange,
  snapDateRangeToMonth,
  type DateRange,
} from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeForPreset("thisMonth")
  );
  const { year, month } = useMemo(
    () => monthYearFromDateRange(dateRange),
    [dateRange]
  );

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
  const [payslipBusy, setPayslipBusy] = useState<
    "preview" | "download" | "whatsapp" | null
  >(null);
  const [payslipPreview, setPayslipPreview] = useState<{
    objectUrl: string;
    fileName: string;
  } | null>(null);

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
        workdaysInMonth: countWorkdaysInMonth(year, month),
      }),
    [employee, summaryRow, year, month]
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

  async function handlePayslip(mode: "preview" | "download") {
    if (!Number.isFinite(employeeId) || !employee) return;
    setPayslipBusy(mode);
    const fileName = buildPayslipFileName(employee, year, month);
    try {
      if (mode === "preview") {
        const next = await previewPayslipPdf(employeeId, {
          month,
          year,
          fileName,
        });
        setPayslipPreview((prev) => {
          if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
          return next;
        });
      } else {
        await downloadPayslipPdf(employeeId, { month, year, fileName });
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de générer le bulletin de paie"
      );
    } finally {
      setPayslipBusy(null);
    }
  }

  async function handleSendPayslipWhatsapp() {
    if (!Number.isFinite(employeeId) || !employee) return;
    if (!employee.phone?.trim()) {
      toast.error("Ajoutez un numéro de téléphone à l’employé avant d’envoyer.");
      return;
    }
    setPayslipBusy("whatsapp");
    try {
      await sendPayslipWhatsapp(employeeId, { month, year });
      toast.success("Bulletin envoyé sur WhatsApp");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le bulletin sur WhatsApp"
      );
    } finally {
      setPayslipBusy(null);
    }
  }

  function closePayslipPreview() {
    setPayslipPreview((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
  }

  async function downloadFromPreview() {
    if (!payslipPreview) return;
    setPayslipBusy("download");
    try {
      const a = document.createElement("a");
      a.href = payslipPreview.objectUrl;
      a.download = payslipPreview.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setPayslipBusy(null);
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
        <div className="flex flex-col gap-2 sm:items-end w-full sm:w-auto">
          <DateRangePicker
            value={dateRange}
            onChange={(next) => setDateRange(snapDateRangeToMonth(next))}
          />
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!employee || payslipBusy !== null}
              onClick={() => handlePayslip("preview")}
            >
              <Eye className="mr-1.5 h-4 w-4" />
              {payslipBusy === "preview" ? "Génération…" : "Prévisualiser"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!employee || payslipBusy !== null}
              onClick={() => handlePayslip("download")}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {payslipBusy === "download" ? "Génération…" : "Télécharger"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !employee ||
                payslipBusy !== null ||
                !employee.phone?.trim()
              }
              title={
                employee?.phone?.trim()
                  ? "Envoyer le bulletin sur WhatsApp"
                  : "Numéro de téléphone requis"
              }
              onClick={() => void handleSendPayslipWhatsapp()}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              {payslipBusy === "whatsapp"
                ? "Envoi…"
                : "Envoyer WhatsApp"}
            </Button>
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
              iconTooltip="Présent (<08:30) = 1 · Retard (08:30–midi) = 0,5 · Absent = 0 — base = mois complet (lun–sam)"
            />
          </div>

          <div className="stat-card space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Coût d’un jour (mois)
            </div>
            <dl className="space-y-1.5 text-sm">
              {formatDayPenaltyRateLines(
                estimateDayPenaltyRates({
                  salaryBase: stats.salaryBase,
                  workdaysInMonth: countWorkdaysInMonth(year, month),
                })
              ).map((line) => {
                const [key, value] = line.split(" = ");
                return (
                  <div
                    key={line}
                    className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/60 pb-1 last:border-0 last:pb-0"
                  >
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="tabular-nums font-medium text-foreground">
                      {value}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="text-xs text-muted-foreground">
              Tarif du mois sélectionné (lun–sam) — pour motiver l’assiduité
            </p>
          </div>

          <div className="stat-card space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Pénalités du mois
            </div>
            <dl className="space-y-1.5 text-sm">
              {formatPenaltyBreakdownLines(
                stats.penalties == null
                  ? null
                  : {
                      late: stats.penaltyLate ?? 0,
                      absent: stats.penaltyAbsent ?? 0,
                      total: stats.penalties,
                    }
              ).map((line) => {
                const [key, value] = line.split(" = ");
                return (
                  <div
                    key={line}
                    className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/60 pb-1 last:border-0 last:pb-0"
                  >
                    <dt
                      className={
                        key?.startsWith("Total")
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {key}
                    </dt>
                    <dd
                      className={
                        key?.startsWith("Total")
                          ? "font-semibold tabular-nums"
                          : "tabular-nums text-foreground"
                      }
                    >
                      {value}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="text-xs text-muted-foreground">
              Retard = demi-journée · Absence = journée — même tarif que « coût
              d’un jour » (mois complet)
            </p>
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

      <Dialog
        open={payslipPreview != null}
        onOpenChange={(open) => {
          if (!open) closePayslipPreview();
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[min(960px,95vw)] max-w-[95vw] flex-col gap-3 overflow-hidden p-4 sm:rounded-lg">
          <DialogHeader className="shrink-0 space-y-1 pr-8">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <DialogTitle>Bulletin de paie</DialogTitle>
                {payslipPreview?.fileName ? (
                  <p className="text-sm font-normal text-muted-foreground truncate">
                    {payslipPreview.fileName}
                  </p>
                ) : null}
              </div>
              {payslipPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={payslipBusy !== null}
                  onClick={() => void downloadFromPreview()}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {payslipBusy === "download" ? "Génération…" : "Télécharger"}
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          {payslipPreview?.objectUrl ? (
            <iframe
              title="Aperçu bulletin de paie"
              src={payslipPreview.objectUrl}
              className="min-h-0 w-full flex-1 rounded-md border bg-muted/30"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
