/**
 * RH — liste employés, création, enrollment facial (super_admin)
 */

import { useState } from "react";
import {
  useHrEmployees,
  useCreateHrEmployee,
  useEnrollHrEmployeeFace,
} from "@/hooks/useHr";
import type { HrEmployee } from "@/services/hr";
import {
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  formatSalary,
} from "@/pages/hr/hrUi";
import { FaceEnrollDialog } from "@/pages/hr/FaceEnrollDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { UserCog, Plus, ScanFace } from "lucide-react";

export default function EmployeesPage() {
  const { data: employees = [], isLoading } = useHrEmployees();
  const createEmployee = useCreateHrEmployee();
  const enrollFace = useEnrollHrEmployeeFace();

  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [poste, setPoste] = useState("");
  const [salaryBase, setSalaryBase] = useState("");

  const [enrollTarget, setEnrollTarget] = useState<HrEmployee | null>(null);

  function openCreate() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPoste("");
    setSalaryBase("");
    setCreateOpen(true);
  }

  async function handleCreate() {
    const name = fullName.trim();
    const mail = email.trim();
    if (!name || !mail) return;

    const salaryParsed = salaryBase.trim() === "" ? null : Number(salaryBase);
    await createEmployee.mutateAsync({
      full_name: name,
      email: mail,
      phone: phone.trim() || null,
      poste: poste.trim() || null,
      salary_base:
        salaryParsed != null && Number.isFinite(salaryParsed)
          ? Math.trunc(salaryParsed)
          : null,
    });
    setCreateOpen(false);
  }

  const createDisabled =
    !fullName.trim() || !email.trim() || createEmployee.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserCog className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employés</h1>
            <p className="text-muted-foreground">
              Roster RH — création et enrollment facial pour le pointage
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
                <TableHead className="w-[120px]">Enrollment</TableHead>
                <TableHead className="text-right w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
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
                        <Badge variant={enrollmentBadgeVariant(enrolled)}>
                          {enrollmentBadgeLabel(enrolled)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEnrollTarget(row)}
                        >
                          <ScanFace className="w-4 h-4 mr-1" />
                          Enroller
                        </Button>
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
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hr-name">Nom complet *</Label>
              <Input
                id="hr-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-email">Email *</Label>
              <Input
                id="hr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-phone">Téléphone</Label>
              <Input
                id="hr-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-poste">Poste</Label>
              <Input
                id="hr-poste"
                value={poste}
                onChange={(e) => setPoste(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-salary">Salaire de base</Label>
              <Input
                id="hr-salary"
                type="number"
                inputMode="numeric"
                value={salaryBase}
                onChange={(e) => setSalaryBase(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={createDisabled}
              onClick={() => void handleCreate()}
            >
              {createEmployee.isPending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
