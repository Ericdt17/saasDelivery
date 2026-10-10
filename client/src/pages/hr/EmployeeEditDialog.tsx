/**
 * Formulaire employé partagé (sections numérotées, style parcoursAdmin) +
 * dialog de modification réutilisable (liste employés & fiche employé).
 */

import { useEffect, useState, type ReactNode } from "react";
import { useUpdateHrEmployee, useHrWorkplaces } from "@/hooks/useHr";
import type {
  HrContractKind,
  HrEmployee,
  HrEmployeeType,
  HrGender,
  HrWorkplace,
} from "@/services/hr";
import {
  buildEmployeeUpdatePayload,
  employeeToFormFields,
  formatSalary,
  EMPTY_EMPLOYEE_FORM,
  type EmployeeFormFields,
} from "@/pages/hr/hrUi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FORM_DIALOG_BODY_CLASS,
  FORM_DIALOG_CLOSE_CLASS,
  FORM_DIALOG_CONTENT_CLASS,
  FORM_DIALOG_FOOTER_CLASS,
  FORM_DIALOG_HEADER_CLASS,
} from "@/lib/form-dialog-layout";
import {
  User,
  Briefcase,
  IdCard,
  FileText,
  Phone,
  type LucideIcon,
} from "lucide-react";

function SectionCard({
  step,
  icon: Icon,
  title,
  children,
}: {
  step?: number;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/40 bg-muted/30">
        {step != null && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {step}
          </span>
        )}
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="p-2.5 space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-[11px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function EmployeeFormSections({
  form,
  onChange,
  workplaces,
  showSalaryTiming = false,
  salaryScheduled = null,
}: {
  form: EmployeeFormFields;
  onChange: (patch: Partial<EmployeeFormFields>) => void;
  workplaces: HrWorkplace[];
  showSalaryTiming?: boolean;
  salaryScheduled?: HrEmployee["salary_scheduled"];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
      <div className="flex flex-col gap-2.5">
        <SectionCard step={1} icon={User} title="Identité & contact">
          <Field label="Nom complet *" htmlFor="hr-name">
            <Input
              id="hr-name"
              value={form.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              className="h-8 text-sm"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Email pointage *" htmlFor="hr-email">
              <Input
                id="hr-email"
                type="email"
                value={form.email}
                onChange={(e) => onChange({ email: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Email personnel" htmlFor="hr-personal-email">
              <Input
                id="hr-personal-email"
                type="email"
                value={form.personalEmail}
                onChange={(e) => onChange({ personalEmail: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Téléphone" htmlFor="hr-phone">
              <Input
                id="hr-phone"
                value={form.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard step={2} icon={Briefcase} title="Poste & rémunération">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type d'employé">
              <Select
                value={form.employeeType || "none"}
                onValueChange={(v) =>
                  onChange({
                    employeeType: v === "none" ? "" : (v as HrEmployeeType),
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non renseigné</SelectItem>
                  <SelectItem value="livreur">Livreur</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Poste (libellé)" htmlFor="hr-poste">
              <Input
                id="hr-poste"
                value={form.poste}
                onChange={(e) => onChange({ poste: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
          </div>
          <Field label="Salaire de base" htmlFor="hr-salary">
            <Input
              id="hr-salary"
              type="number"
              inputMode="numeric"
              value={form.salaryBase}
              onChange={(e) => onChange({ salaryBase: e.target.value })}
              className="h-8 text-sm"
            />
            {showSalaryTiming && salaryScheduled ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                Déjà programmé : {formatSalary(salaryScheduled.amount)} F dès{" "}
                {String(salaryScheduled.effective_from).slice(0, 7)}. Une
                nouvelle modification remplace le planning à partir de la date
                choisie.
              </p>
            ) : null}
          </Field>
          {showSalaryTiming ? (
            <div className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-2">
              <Checkbox
                id="hr-salary-apply-this-month"
                checked={form.salaryApplyThisMonth}
                onCheckedChange={(v) =>
                  onChange({ salaryApplyThisMonth: v === true })
                }
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor="hr-salary-apply-this-month"
                  className="cursor-pointer text-[11px]"
                >
                  Appliquer dès ce mois
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Par défaut, hausse ou baisse prend effet le 1er du mois
                  suivant.
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-2">
            <Checkbox
              id="hr-include-next-month"
              checked={form.includeNextMonth}
              onCheckedChange={(v) =>
                onChange({ includeNextMonth: v === true })
              }
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="hr-include-next-month"
                className="cursor-pointer text-[11px]"
              >
                Inclure au mois suivant
              </Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Exclut ce salaire de la masse du mois en cours. Prise en compte
                à partir du 1er du mois suivant.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionCard step={3} icon={IdCard} title="Identité & légal">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date de naissance" htmlFor="hr-dob">
              <Input
                id="hr-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => onChange({ dateOfBirth: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Lieu de naissance" htmlFor="hr-pob">
              <Input
                id="hr-pob"
                value={form.placeOfBirth}
                onChange={(e) => onChange({ placeOfBirth: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Sexe">
              <Select
                value={form.gender || "none"}
                onValueChange={(v) =>
                  onChange({
                    gender: v === "none" ? "" : (v as HrGender),
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non renseigné</SelectItem>
                  <SelectItem value="homme">Homme</SelectItem>
                  <SelectItem value="femme">Femme</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nationalité" htmlFor="hr-nationality">
              <Input
                id="hr-nationality"
                value={form.nationality}
                onChange={(e) => onChange({ nationality: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="CNI / N° pièce" htmlFor="hr-national-id">
              <Input
                id="hr-national-id"
                value={form.nationalId}
                onChange={(e) => onChange({ nationalId: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Lieu de travail">
              <Select
                value={form.workplaceId || "none"}
                onValueChange={(v) =>
                  onChange({ workplaceId: v === "none" ? "" : v })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Choisir un lieu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non renseigné</SelectItem>
                  {workplaces.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workplaces.length === 0 ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Aucun lieu — ajoutez-en dans Paramètres.
                </p>
              ) : null}
            </Field>
          </div>
          <Field label="Adresse complète" htmlFor="hr-address">
            <Textarea
              id="hr-address"
              value={form.address}
              onChange={(e) => onChange({ address: e.target.value })}
              rows={2}
              className="text-sm min-h-[52px]"
            />
          </Field>
        </SectionCard>

        <SectionCard step={4} icon={Phone} title="Contact d'urgence">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nom" htmlFor="hr-emergency-name">
              <Input
                id="hr-emergency-name"
                value={form.emergencyContactName}
                onChange={(e) =>
                  onChange({ emergencyContactName: e.target.value })
                }
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Téléphone" htmlFor="hr-emergency-phone">
              <Input
                id="hr-emergency-phone"
                value={form.emergencyContactPhone}
                onChange={(e) =>
                  onChange({ emergencyContactPhone: e.target.value })
                }
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Lien de parenté" htmlFor="hr-emergency-relation">
              <Input
                id="hr-emergency-relation"
                value={form.emergencyContactRelation}
                onChange={(e) =>
                  onChange({ emergencyContactRelation: e.target.value })
                }
                className="h-8 text-sm"
                placeholder="Ex. Époux, père…"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard step={5} icon={FileText} title="Contrat">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type de contrat">
              <Select
                value={form.contractKind || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : (v as HrContractKind);
                  onChange({
                    contractKind: next,
                    ...(next === "cdi" ? { contractEndDate: "" } : {}),
                  });
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non renseigné</SelectItem>
                  <SelectItem value="cdi">CDI</SelectItem>
                  <SelectItem value="cdd">CDD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Horaires de travail" htmlFor="hr-work-schedule">
              <Input
                id="hr-work-schedule"
                value={form.workSchedule}
                onChange={(e) => onChange({ workSchedule: e.target.value })}
                className="h-8 text-sm"
                placeholder="8h00–17h00, pause 1h"
              />
            </Field>
            <Field label="Période d'essai (jours)" htmlFor="hr-trial">
              <Input
                id="hr-trial"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.trialPeriodDays}
                onChange={(e) => onChange({ trialPeriodDays: e.target.value })}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Date de début" htmlFor="hr-start">
              <Input
                id="hr-start"
                type="date"
                value={form.contractStartDate}
                onChange={(e) =>
                  onChange({ contractStartDate: e.target.value })
                }
                className="h-8 text-sm"
              />
            </Field>
            {form.contractKind === "cdd" ? (
              <Field label="Date de fin (CDD)" htmlFor="hr-end">
                <Input
                  id="hr-end"
                  type="date"
                  value={form.contractEndDate}
                  onChange={(e) =>
                    onChange({ contractEndDate: e.target.value })
                  }
                  className="h-8 text-sm"
                />
              </Field>
            ) : (
              <div />
            )}
          </div>
          <Field label="Description de mission" htmlFor="hr-mission">
            <Textarea
              id="hr-mission"
              value={form.missionDescription}
              onChange={(e) =>
                onChange({ missionDescription: e.target.value })
              }
              rows={5}
              className="text-sm min-h-[96px]"
              placeholder={"Phrase d'introduction…\n\n* première mission ;\n* deuxième mission ;"}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Sur le contrat : chaque ligne commençant par « * » ou « - »
              devient une puce ; une ligne vide sépare les paragraphes.
            </p>
          </Field>
        </SectionCard>
      </div>
    </div>
  );
}

/**
 * Dialog « Modifier l'employé » — autonome (état du formulaire + mutation).
 * Ouvert tant que `employee` est non nul.
 */
export function EmployeeEditDialog({
  employee,
  onClose,
}: {
  employee: HrEmployee | null;
  onClose: () => void;
}) {
  const updateEmployee = useUpdateHrEmployee();
  const { data: workplaces = [] } = useHrWorkplaces({ activeOnly: true });
  const [form, setForm] = useState<EmployeeFormFields>(EMPTY_EMPLOYEE_FORM);

  useEffect(() => {
    if (employee) setForm(employeeToFormFields(employee));
  }, [employee]);

  function patchForm(patch: Partial<EmployeeFormFields>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleUpdate() {
    if (!employee) return;
    if (!form.fullName.trim() || !form.email.trim()) return;
    await updateEmployee.mutateAsync({
      id: employee.id,
      data: buildEmployeeUpdatePayload(form),
    });
    onClose();
  }

  const formDisabled =
    !form.fullName.trim() || !form.email.trim() || updateEmployee.isPending;

  return (
    <Dialog
      open={employee != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={FORM_DIALOG_CONTENT_CLASS}
        closeClassName={FORM_DIALOG_CLOSE_CLASS}
      >
        <div className={FORM_DIALOG_HEADER_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight truncate">
                Modifier l’employé
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                L’email reste l’identifiant de pointage.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Checkbox
                id="hr-active"
                checked={form.isActive}
                onCheckedChange={(v) => patchForm({ isActive: v === true })}
              />
              <Label
                htmlFor="hr-active"
                className="text-[11px] whitespace-nowrap cursor-pointer"
              >
                Actif
              </Label>
            </div>
          </div>
        </div>
        <div className={FORM_DIALOG_BODY_CLASS}>
          <EmployeeFormSections
            form={form}
            onChange={patchForm}
            workplaces={workplaces}
            showSalaryTiming
            salaryScheduled={employee?.salary_scheduled ?? null}
          />
        </div>
        <div className={FORM_DIALOG_FOOTER_CLASS}>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={formDisabled} onClick={() => void handleUpdate()}>
            {updateEmployee.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
