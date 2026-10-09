/**
 * RH — liste employés, création, modification, suppression (soft), enrollment facial (super_admin)
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useHrEmployees,
  useHrAttendancesSummary,
  useCreateHrEmployee,
  useDeleteHrEmployee,
  useEnrollHrEmployeeFace,
  useHrWorkplaces,
} from "@/hooks/useHr";
import type { HrEmployee } from "@/services/hr";
import {
  buildEmployeeDetailStats,
  buildEmployeeUpdatePayload,
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  formatMonthLabelFr,
  formatPayrollAmount,
  formatPenaltyBreakdownLines,
  formatSalary,
  countWorkdaysInMonth,
  isPayrollEligibleForMonth,
  EMPTY_EMPLOYEE_FORM,
  type EmployeeFormFields,
} from "@/pages/hr/hrUi";
import { FaceEnrollDialog } from "@/pages/hr/FaceEnrollDialog";
import {
  EmployeeEditDialog,
  EmployeeFormSections,
} from "@/pages/hr/EmployeeEditDialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  getDateRangeForPreset,
  monthYearFromDateRange,
  snapDateRangeToMonth,
  type DateRange,
} from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FORM_DIALOG_BODY_CLASS,
  FORM_DIALOG_CLOSE_CLASS,
  FORM_DIALOG_CONTENT_CLASS,
  FORM_DIALOG_FOOTER_CLASS,
  FORM_DIALOG_HEADER_CLASS,
} from "@/lib/form-dialog-layout";
import { UserCog, Plus, ScanFace, Pencil, Trash2, Eye } from "lucide-react";

export default function EmployeesPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeForPreset("thisMonth")
  );
  const { year, month } = useMemo(
    () => monthYearFromDateRange(dateRange),
    [dateRange]
  );

  const { data: employees = [], isLoading } = useHrEmployees();
  const { data: monthSummary = [], isLoading: loadingSummary } =
    useHrAttendancesSummary(month, year);
  const createEmployee = useCreateHrEmployee();
  const deleteEmployee = useDeleteHrEmployee();
  const enrollFace = useEnrollHrEmployeeFace();
  const { data: workplaces = [] } = useHrWorkplaces({ activeOnly: true });

  const statsByEmployee = useMemo(() => {
    const map = new Map<
      number,
      ReturnType<typeof buildEmployeeDetailStats>
    >();
    const workdaysInMonth = countWorkdaysInMonth(year, month);
    for (const emp of employees) {
      const empId = Number(emp.id);
      const summary =
        monthSummary.find((r) => Number(r.employee_id) === empId) ?? null;
      map.set(
        empId,
        buildEmployeeDetailStats({
          salaryBase: emp.salary_base,
          summary,
          workdaysInMonth,
        })
      );
    }
    return map;
  }, [employees, monthSummary, year, month]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HrEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrEmployee | null>(null);
  const [form, setForm] = useState<EmployeeFormFields>(EMPTY_EMPLOYEE_FORM);

  const [enrollTarget, setEnrollTarget] = useState<HrEmployee | null>(null);

  function patchForm(patch: Partial<EmployeeFormFields>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function resetForm() {
    setForm(EMPTY_EMPLOYEE_FORM);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(row: HrEmployee) {
    setEditTarget(row);
  }

  async function handleCreate() {
    const name = form.fullName.trim();
    const mail = form.email.trim();
    if (!name || !mail) return;

    const payload = buildEmployeeUpdatePayload({
      ...form,
      isActive: true,
      salaryApplyThisMonth: false,
    });
    await createEmployee.mutateAsync({
      full_name: payload.full_name,
      email: payload.email,
      personal_email: payload.personal_email,
      phone: payload.phone,
      poste: payload.poste,
      salary_base: payload.salary_base,
      include_next_month: payload.include_next_month,
      employee_type: payload.employee_type,
      date_of_birth: payload.date_of_birth,
      place_of_birth: payload.place_of_birth,
      gender: payload.gender,
      nationality: payload.nationality,
      national_id: payload.national_id,
      address: payload.address,
      workplace_id: payload.workplace_id,
      emergency_contact_name: payload.emergency_contact_name,
      emergency_contact_phone: payload.emergency_contact_phone,
      emergency_contact_relation: payload.emergency_contact_relation,
      work_schedule: payload.work_schedule,
      contract_kind: payload.contract_kind,
      contract_start_date: payload.contract_start_date,
      contract_end_date: payload.contract_end_date,
      trial_period_days: payload.trial_period_days,
      mission_description: payload.mission_description,
    });
    setCreateOpen(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteEmployee.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const formDisabled =
    !form.fullName.trim() || !form.email.trim() || createEmployee.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserCog className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employés</h1>
            <p className="text-muted-foreground">
              Roster RH —{" "}
              <span className="capitalize">{formatMonthLabelFr(year, month)}</span>{" "}
              (lun–sam) et enrollment facial
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end w-full sm:w-auto">
          <DateRangePicker
            value={dateRange}
            onChange={(next) => setDateRange(snapDateRangeToMonth(next))}
          />
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un employé
          </Button>
        </div>
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Salaire base</TableHead>
                <TableHead className="text-right">Présents</TableHead>
                <TableHead className="text-right">Retards</TableHead>
                <TableHead className="text-right">À payer</TableHead>
                <TableHead className="text-right">Pénalités</TableHead>
                <TableHead className="w-[100px]">Statut</TableHead>
                <TableHead className="w-[120px]">Enrollment</TableHead>
                <TableHead className="text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || loadingSummary ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucun employé pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((row) => {
                  const enrolled = Boolean(row.is_enrolled || row.enrolled_at);
                  const stats = statsByEmployee.get(Number(row.id));
                  const payrollEligible = isPayrollEligibleForMonth(
                    row.payroll_eligible_from,
                    year,
                    month
                  );
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link
                          to={`/hr/employees/${row.id}`}
                          className="hover:underline text-foreground"
                        >
                          {row.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">
                        {row.employee_type ?? "—"}
                      </TableCell>
                      <TableCell>{row.poste ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span>{formatSalary(row.salary_base)}</span>
                          {row.salary_scheduled ? (
                            <span className="text-xs text-muted-foreground">
                              → {formatSalary(row.salary_scheduled.amount)} dès{" "}
                              {String(row.salary_scheduled.effective_from).slice(
                                0,
                                7
                              )}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.is_active ? (stats?.daysPresent ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.is_active ? (stats?.daysLate ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.is_active && payrollEligible
                          ? formatPayrollAmount(stats?.estimatedPay ?? null)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {row.is_active && payrollEligible && stats ? (
                          <div className="inline-flex flex-col items-end gap-0.5 leading-snug text-muted-foreground">
                            {formatPenaltyBreakdownLines(
                              stats.penalties == null
                                ? null
                                : {
                                    late: stats.penaltyLate ?? 0,
                                    absent: stats.penaltyAbsent ?? 0,
                                    total: stats.penalties,
                                  }
                            ).map((line) => (
                              <span
                                key={line}
                                className={
                                  line.startsWith("Total")
                                    ? "font-medium text-foreground"
                                    : undefined
                                }
                              >
                                {line}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? "default" : "secondary"}>
                          {row.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={enrollmentBadgeVariant(enrolled)}>
                          {enrollmentBadgeLabel(enrolled)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Voir la fiche"
                            aria-label="Voir la fiche"
                            asChild
                          >
                            <Link to={`/hr/employees/${row.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Modifier"
                            aria-label="Modifier"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Enroller le visage"
                            aria-label="Enroller le visage"
                            onClick={() => setEnrollTarget(row)}
                          >
                            <ScanFace className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            title="Supprimer"
                            aria-label="Supprimer"
                            disabled={!row.is_active || deleteEmployee.isPending}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className={FORM_DIALOG_CONTENT_CLASS}
          closeClassName={FORM_DIALOG_CLOSE_CLASS}
        >
          <div className={FORM_DIALOG_HEADER_CLASS}>
            <DialogTitle className="text-base font-semibold leading-tight">
              Ajouter un employé
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              L’email servira d’identifiant pour le pointage.
            </DialogDescription>
          </div>
          <div className={FORM_DIALOG_BODY_CLASS}>
            <EmployeeFormSections
              form={form}
              onChange={patchForm}
              workplaces={workplaces}
            />
          </div>
          <div className={FORM_DIALOG_FOOTER_CLASS}>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={formDisabled}
              onClick={() => void handleCreate()}
            >
              {createEmployee.isPending ? "Création…" : "Créer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeEditDialog
        employee={editTarget}
        onClose={() => setEditTarget(null)}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver cet employé ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.full_name} » ne pourra plus pointer. L’historique
              de présence est conservé ; vous pourrez le réactiver plus tard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleteEmployee.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEmployee.isPending ? "Désactivation…" : "Désactiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FaceEnrollDialog
        open={enrollTarget != null}
        employeeName={enrollTarget?.full_name ?? ""}
        pending={enrollFace.isPending}
        onOpenChange={(open) => {
          if (!open) setEnrollTarget(null);
        }}
        onEnroll={async (face_descriptor) => {
          if (!enrollTarget) return;
          await enrollFace.mutateAsync({
            id: enrollTarget.id,
            face_descriptor,
          });
          setEnrollTarget(null);
        }}
      />
    </div>
  );
}
