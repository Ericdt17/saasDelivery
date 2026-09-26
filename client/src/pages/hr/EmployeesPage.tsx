/**
 * RH — liste employés, création, modification, suppression (soft), enrollment facial (super_admin)
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useHrEmployees,
  useHrAttendancesSummary,
  useCreateHrEmployee,
  useUpdateHrEmployee,
  useDeleteHrEmployee,
  useEnrollHrEmployeeFace,
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
  currentMonthYearDouala,
  isPayrollEligibleForMonth,
} from "@/pages/hr/hrUi";
import { FaceEnrollDialog } from "@/pages/hr/FaceEnrollDialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  getDateRangeForPreset,
  monthYearFromDateRange,
  snapDateRangeToMonth,
  type DateRange,
} from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
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
  const updateEmployee = useUpdateHrEmployee();
  const deleteEmployee = useDeleteHrEmployee();
  const enrollFace = useEnrollHrEmployeeFace();

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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [poste, setPoste] = useState("");
  const [salaryBase, setSalaryBase] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [includeNextMonth, setIncludeNextMonth] = useState(false);

  const [enrollTarget, setEnrollTarget] = useState<HrEmployee | null>(null);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPoste("");
    setSalaryBase("");
    setIsActive(true);
    setIncludeNextMonth(false);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(row: HrEmployee) {
    const { year: cy, month: cm } = currentMonthYearDouala();
    setFullName(row.full_name);
    setEmail(row.email);
    setPhone(row.phone ?? "");
    setPoste(row.poste ?? "");
    setSalaryBase(row.salary_base != null ? String(row.salary_base) : "");
    setIsActive(row.is_active);
    setIncludeNextMonth(
      !isPayrollEligibleForMonth(row.payroll_eligible_from, cy, cm)
    );
    setEditTarget(row);
  }

  async function handleCreate() {
    const name = fullName.trim();
    const mail = email.trim();
    if (!name || !mail) return;

    const payload = buildEmployeeUpdatePayload({
      fullName,
      email,
      phone,
      poste,
      salaryBase,
      isActive: true,
      includeNextMonth,
    });
    await createEmployee.mutateAsync({
      full_name: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      poste: payload.poste,
      salary_base: payload.salary_base,
      include_next_month: payload.include_next_month,
    });
    setCreateOpen(false);
  }

  async function handleUpdate() {
    if (!editTarget) return;
    const name = fullName.trim();
    const mail = email.trim();
    if (!name || !mail) return;

    await updateEmployee.mutateAsync({
      id: editTarget.id,
      data: buildEmployeeUpdatePayload({
        fullName,
        email,
        phone,
        poste,
        salaryBase,
        isActive,
        includeNextMonth,
      }),
    });
    setEditTarget(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteEmployee.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const formDisabled =
    !fullName.trim() ||
    !email.trim() ||
    createEmployee.isPending ||
    updateEmployee.isPending;

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
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
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
                      <TableCell>{row.poste ?? "—"}</TableCell>
                      <TableCell>{formatSalary(row.salary_base)}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un employé</DialogTitle>
            <DialogDescription>
              L’email servira d’identifiant pour le pointage.
            </DialogDescription>
          </DialogHeader>
          <EmployeeFormFields
            fullName={fullName}
            email={email}
            phone={phone}
            poste={poste}
            salaryBase={salaryBase}
            includeNextMonth={includeNextMonth}
            onFullNameChange={setFullName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
            onPosteChange={setPoste}
            onSalaryBaseChange={setSalaryBase}
            onIncludeNextMonthChange={setIncludeNextMonth}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={formDisabled}
              onClick={() => void handleCreate()}
            >
              {createEmployee.isPending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editTarget != null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l’employé</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations. L’email reste l’identifiant de
              pointage.
            </DialogDescription>
          </DialogHeader>
          <EmployeeFormFields
            fullName={fullName}
            email={email}
            phone={phone}
            poste={poste}
            salaryBase={salaryBase}
            includeNextMonth={includeNextMonth}
            onFullNameChange={setFullName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
            onPosteChange={setPoste}
            onSalaryBaseChange={setSalaryBase}
            onIncludeNextMonthChange={setIncludeNextMonth}
          />
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="hr-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="hr-active">Employé actif</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Annuler
            </Button>
            <Button
              disabled={formDisabled}
              onClick={() => void handleUpdate()}
            >
              {updateEmployee.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function EmployeeFormFields({
  fullName,
  email,
  phone,
  poste,
  salaryBase,
  includeNextMonth,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onPosteChange,
  onSalaryBaseChange,
  onIncludeNextMonthChange,
}: {
  fullName: string;
  email: string;
  phone: string;
  poste: string;
  salaryBase: string;
  includeNextMonth: boolean;
  onFullNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onPosteChange: (v: string) => void;
  onSalaryBaseChange: (v: string) => void;
  onIncludeNextMonthChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="hr-name">Nom complet *</Label>
        <Input
          id="hr-name"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hr-email">Email *</Label>
        <Input
          id="hr-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hr-phone">Téléphone</Label>
        <Input
          id="hr-phone"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hr-poste">Poste</Label>
        <Input
          id="hr-poste"
          value={poste}
          onChange={(e) => onPosteChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hr-salary">Salaire de base</Label>
        <Input
          id="hr-salary"
          type="number"
          inputMode="numeric"
          value={salaryBase}
          onChange={(e) => onSalaryBaseChange(e.target.value)}
        />
      </div>
      <div className="flex items-start gap-2 rounded-lg border p-3">
        <Checkbox
          id="hr-include-next-month"
          checked={includeNextMonth}
          onCheckedChange={(v) => onIncludeNextMonthChange(v === true)}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label htmlFor="hr-include-next-month" className="cursor-pointer">
            Inclure au mois suivant
          </Label>
          <p className="text-xs text-muted-foreground">
            Exclut ce salaire de la masse du mois en cours (rapports /
            dashboard). Prise en compte à partir du 1er du mois suivant.
          </p>
        </div>
      </div>
    </div>
  );
}
