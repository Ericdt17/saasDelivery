/**
 * RH — liste employés, création, modification, suppression (soft), enrollment facial (super_admin)
 */

import { useState } from "react";
import {
  useHrEmployees,
  useCreateHrEmployee,
  useUpdateHrEmployee,
  useDeleteHrEmployee,
  useEnrollHrEmployeeFace,
} from "@/hooks/useHr";
import type { HrEmployee } from "@/services/hr";
import {
  buildEmployeeUpdatePayload,
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  formatSalary,
} from "@/pages/hr/hrUi";
import { FaceEnrollDialog } from "@/pages/hr/FaceEnrollDialog";
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
import { UserCog, Plus, ScanFace, Pencil, Trash2 } from "lucide-react";

export default function EmployeesPage() {
  const { data: employees = [], isLoading } = useHrEmployees();
  const createEmployee = useCreateHrEmployee();
  const updateEmployee = useUpdateHrEmployee();
  const deleteEmployee = useDeleteHrEmployee();
  const enrollFace = useEnrollHrEmployeeFace();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HrEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrEmployee | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [poste, setPoste] = useState("");
  const [salaryBase, setSalaryBase] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [enrollTarget, setEnrollTarget] = useState<HrEmployee | null>(null);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPoste("");
    setSalaryBase("");
    setIsActive(true);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(row: HrEmployee) {
    setFullName(row.full_name);
    setEmail(row.email);
    setPhone(row.phone ?? "");
    setPoste(row.poste ?? "");
    setSalaryBase(row.salary_base != null ? String(row.salary_base) : "");
    setIsActive(row.is_active);
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
    });
    await createEmployee.mutateAsync({
      full_name: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      poste: payload.poste,
      salary_base: payload.salary_base,
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
              Roster RH — création, modification et enrollment facial
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un employé
        </Button>
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Salaire base</TableHead>
                <TableHead className="w-[100px]">Statut</TableHead>
                <TableHead className="w-[120px]">Enrollment</TableHead>
                <TableHead className="text-right w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucun employé pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((row) => {
                  const enrolled = Boolean(row.is_enrolled || row.enrolled_at);
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell>{row.poste ?? "—"}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{formatSalary(row.salary_base)}</TableCell>
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
            onFullNameChange={setFullName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
            onPosteChange={setPoste}
            onSalaryBaseChange={setSalaryBase}
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
            onFullNameChange={setFullName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
            onPosteChange={setPoste}
            onSalaryBaseChange={setSalaryBase}
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
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onPosteChange,
  onSalaryBaseChange,
}: {
  fullName: string;
  email: string;
  phone: string;
  poste: string;
  salaryBase: string;
  onFullNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onPosteChange: (v: string) => void;
  onSalaryBaseChange: (v: string) => void;
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
    </div>
  );
}
