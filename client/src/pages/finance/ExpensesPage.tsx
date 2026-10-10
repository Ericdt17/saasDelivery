/**
 * Dépenses générales — saisies manuelles (loyer, énergie, matériel…),
 * imputées à un mois et déduites du CA dans les Rapports (super_admin).
 */

import { useMemo, useState } from "react";
import { Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from "@/hooks/useExpenses";
import {
  EXPENSE_CATEGORY_LABELS,
  type CompanyExpense,
  type ExpenseCategory,
} from "@/services/expenses";
import { formatMonthLabelFr } from "@/pages/hr/hrUi";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  getDateRangeForPreset,
  monthYearFromDateRange,
  snapDateRangeToMonth,
  type DateRange,
} from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_KEYS = Object.keys(
  EXPENSE_CATEGORY_LABELS
) as ExpenseCategory[];

function fmtXaf(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(n)))} F`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function firstOfMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FormState {
  label: string;
  category: ExpenseCategory | "";
  amount: string;
  expense_date: string;
  effective_month: string;
  notes: string;
}

const emptyForm = (effectiveMonth: string): FormState => ({
  label: "",
  category: "",
  amount: "",
  expense_date: todayIso(),
  effective_month: effectiveMonth,
  notes: "",
});

export default function ExpensesPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeForPreset("thisMonth")
  );
  const { year, month } = useMemo(
    () => monthYearFromDateRange(dateRange),
    [dateRange]
  );

  const { data, isLoading } = useExpenses(year, month);
  const expenses = data?.expenses ?? [];
  const summary = data?.summary ?? null;

  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();

  // Options d'imputation : mois en cours + mois précédent (calendrier réel)
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const prevY = curM === 1 ? curY - 1 : curY;
  const prevM = curM === 1 ? 12 : curM - 1;
  const currentMonthValue = firstOfMonth(curY, curM);
  const previousMonthValue = firstOfMonth(prevY, prevM);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyExpense | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(currentMonthValue));

  function patch(p: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm(currentMonthValue));
    setDialogOpen(true);
  }

  function openEdit(row: CompanyExpense) {
    setEditTarget(row);
    setForm({
      label: row.label,
      category: row.category,
      amount: String(row.amount),
      expense_date: String(row.expense_date).slice(0, 10),
      effective_month: String(row.effective_month).slice(0, 10),
      notes: row.notes ?? "",
    });
    setDialogOpen(true);
  }

  const amountNumber = Number(form.amount);
  const formValid =
    form.label.trim().length > 0 &&
    form.category !== "" &&
    Number.isInteger(amountNumber) &&
    amountNumber >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.expense_date);

  async function handleSubmit() {
    if (!formValid || form.category === "") return;
    const payload = {
      label: form.label.trim(),
      category: form.category,
      amount: amountNumber,
      expense_date: form.expense_date,
      effective_month: form.effective_month,
      notes: form.notes.trim() || null,
    };
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setDialogOpen(false);
  }

  // L'imputation existante (édition) peut être hors des deux options standard
  const imputationOptions = useMemo(() => {
    const opts = [
      {
        value: currentMonthValue,
        label: `${formatMonthLabelFr(curY, curM)} (mois en cours)`,
      },
      {
        value: previousMonthValue,
        label: `${formatMonthLabelFr(prevY, prevM)} (mois précédent)`,
      },
    ];
    if (
      form.effective_month &&
      !opts.some((o) => o.value === form.effective_month)
    ) {
      const [y, m] = form.effective_month.split("-").map(Number);
      opts.push({ value: form.effective_month, label: formatMonthLabelFr(y, m) });
    }
    return opts;
  }, [currentMonthValue, previousMonthValue, form.effective_month, curY, curM, prevY, prevM]);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dépenses</h1>
            <p className="text-muted-foreground">
              Dépenses générales saisies ici — hors dépenses opérationnelles
              (API livraisons) et salaires RH
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <DateRangePicker
            value={dateRange}
            onChange={(next) => setDateRange(snapDateRangeToMonth(next))}
          />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une dépense
          </Button>
        </div>
      </div>

      {/* Résumé du mois */}
      <div className="stat-card space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium capitalize">
            {formatMonthLabelFr(year, month)} — total des dépenses générales
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {fmtXaf(summary?.total ?? 0)}
          </span>
        </div>
        {summary && summary.by_category.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summary.by_category.map((c) => (
              <Badge key={c.category} variant="secondary" className="font-normal">
                {EXPENSE_CATEGORY_LABELS[c.category]} : {fmtXaf(c.total)}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Imputation</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right w-[110px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucune dépense imputée à{" "}
                    <span className="capitalize">
                      {formatMonthLabelFr(year, month)}
                    </span>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((row) => {
                  const [ey, em] = String(row.effective_month)
                    .slice(0, 10)
                    .split("-")
                    .map(Number);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{fmtDate(row.expense_date)}</TableCell>
                      <TableCell className="font-medium">
                        {row.label}
                        {row.notes ? (
                          <p className="text-xs font-normal text-muted-foreground truncate max-w-[280px]">
                            {row.notes}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {EXPENSE_CATEGORY_LABELS[row.category] ?? row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {formatMonthLabelFr(ey, em)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtXaf(row.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Modifier"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Supprimer"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Modifier la dépense" : "Ajouter une dépense"}
            </DialogTitle>
            <DialogDescription>
              Dépense générale de l’entreprise — elle sera déduite du chiffre
              d’affaires du mois d’imputation choisi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-label">Libellé *</Label>
              <Input
                id="exp-label"
                value={form.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="Ex. Loyer bureau, facture ENEO…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Catégorie *</Label>
                <Select
                  value={form.category || undefined}
                  onValueChange={(v) => patch({ category: v as ExpenseCategory })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {EXPENSE_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Montant (FCFA) *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.amount}
                  onChange={(e) => patch({ amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date de la dépense *</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => patch({ expense_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mois d’imputation *</Label>
                <Select
                  value={form.effective_month}
                  onValueChange={(v) => patch({ effective_month: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {imputationOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="capitalize">{o.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-notes">Notes</Label>
              <Textarea
                id="exp-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Référence facture, précisions…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!formValid || saving} onClick={() => void handleSubmit()}>
              {saving
                ? "Enregistrement…"
                : editTarget
                  ? "Enregistrer"
                  : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression (vraie suppression) */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.label} » ({fmtXaf(deleteTarget?.amount)}) sera
              définitivement supprimée et ne comptera plus dans les rapports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
