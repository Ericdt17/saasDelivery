/**
 * Dépenses générales — saisies manuelles, imputées à un mois et déduites du
 * CA dans les Rapports (super_admin). Catégories dynamiques (Paramètres),
 * justificatifs multiples ; modal au layout « fiche employé ».
 */

import { useMemo, useState } from "react";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  FileText,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useExpenses,
  useExpenseCategories,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from "@/hooks/useExpenses";
import {
  getExpense,
  MAX_RECEIPTS,
  type CompanyExpense,
} from "@/services/expenses";
import { formatMonthLabelFr } from "@/pages/hr/hrUi";
import { imageFileToDataUrl } from "@/lib/image-file";
import { SectionCard, Field } from "@/pages/hr/EmployeeEditDialog";
import {
  FORM_DIALOG_BODY_CLASS,
  FORM_DIALOG_CLOSE_CLASS,
  FORM_DIALOG_CONTENT_CLASS,
  FORM_DIALOG_FOOTER_CLASS,
  FORM_DIALOG_HEADER_CLASS,
} from "@/lib/form-dialog-layout";
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


function isPdf(src: string) {
  return src.startsWith("data:application/pdf");
}

/** Lit un PDF tel quel (pas de recompression) en data URL. */
function pdfFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("PDF illisible"));
    reader.readAsDataURL(file);
  });
}

/** Justificatif dans le formulaire : existant (id serveur) ou nouveau. */
type FormReceipt =
  | { kind: "existing"; id: number; src: string }
  | { kind: "new"; src: string };

interface FormState {
  label: string;
  categoryId: string;
  amount: string;
  expense_date: string;
  effective_month: string;
  notes: string;
  receipts: FormReceipt[];
  removedReceiptIds: number[];
}

const emptyForm = (effectiveMonth: string): FormState => ({
  label: "",
  categoryId: "",
  amount: "",
  expense_date: todayIso(),
  effective_month: effectiveMonth,
  notes: "",
  receipts: [],
  removedReceiptIds: [],
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
  const { data: categories = [] } = useExpenseCategories({ activeOnly: true });

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
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptViewer, setReceiptViewer] = useState<{
    label: string;
    images: string[] | null;
  } | null>(null);

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
      categoryId: String(row.category_id),
      amount: String(row.amount),
      expense_date: String(row.expense_date).slice(0, 10),
      effective_month: String(row.effective_month).slice(0, 10),
      notes: row.notes ?? "",
      receipts: [],
      removedReceiptIds: [],
    });
    setDialogOpen(true);
    if (row.receipt_count > 0) {
      setReceiptsLoading(true);
      getExpense(row.id)
        .then((full) =>
          patch({
            receipts: (full.receipts ?? []).map((r) => ({
              kind: "existing" as const,
              id: r.id,
              src: r.image_base64,
            })),
          })
        )
        .catch(() =>
          toast.error("Impossible de charger les justificatifs existants")
        )
        .finally(() => setReceiptsLoading(false));
    }
  }

  async function handleReceiptFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_RECEIPTS - form.receipts.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_RECEIPTS} justificatifs par dépense`);
      return;
    }
    const selected = Array.from(files).slice(0, room);
    if (files.length > room) {
      toast.error(
        `Seulement ${room} image${room > 1 ? "s" : ""} ajoutée${room > 1 ? "s" : ""} (max ${MAX_RECEIPTS})`
      );
    }
    for (const file of selected) {
      const isPdfFile = file.type === "application/pdf";
      if (!isPdfFile && !file.type.startsWith("image/")) {
        toast.error(`« ${file.name} » doit être une image ou un PDF`);
        continue;
      }
      // Les PDF partent tels quels (pas de compression possible) : 2 Mo max.
      if (isPdfFile && file.size > 2 * 1024 * 1024) {
        toast.error(`« ${file.name} » dépasse 2 Mo (limite PDF)`);
        continue;
      }
      if (!isPdfFile && file.size > 10 * 1024 * 1024) {
        toast.error(`« ${file.name} » est trop lourde (10 Mo max)`);
        continue;
      }
      try {
        const dataUrl = isPdfFile
          ? await pdfFileToDataUrl(file)
          : await imageFileToDataUrl(file, { maxDimension: 1400 });
        setForm((prev) => ({
          ...prev,
          receipts: [...prev.receipts, { kind: "new", src: dataUrl }],
        }));
      } catch {
        toast.error(`Impossible de lire « ${file.name} »`);
      }
    }
  }

  function removeReceipt(index: number) {
    setForm((prev) => {
      const target = prev.receipts[index];
      return {
        ...prev,
        receipts: prev.receipts.filter((_, i) => i !== index),
        removedReceiptIds:
          target?.kind === "existing"
            ? [...prev.removedReceiptIds, target.id]
            : prev.removedReceiptIds,
      };
    });
  }

  async function openReceiptViewer(row: CompanyExpense) {
    setReceiptViewer({ label: row.label, images: null });
    try {
      const full = await getExpense(row.id);
      setReceiptViewer({
        label: row.label,
        images: (full.receipts ?? []).map((r) => r.image_base64),
      });
    } catch {
      toast.error("Impossible de charger les justificatifs");
      setReceiptViewer(null);
    }
  }

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === form.categoryId) ?? null,
    [categories, form.categoryId]
  );
  const noteRequired = selectedCategory?.requires_note === true;

  const amountNumber = Number(form.amount);
  const formValid =
    form.label.trim().length > 0 &&
    form.categoryId !== "" &&
    Number.isInteger(amountNumber) &&
    amountNumber >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.expense_date) &&
    (!noteRequired || form.notes.trim().length > 0);

  async function handleSubmit() {
    if (!formValid) return;
    const common = {
      label: form.label.trim(),
      category_id: Number(form.categoryId),
      amount: amountNumber,
      expense_date: form.expense_date,
      effective_month: form.effective_month,
      notes: form.notes.trim() || null,
    };
    if (editTarget) {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: {
          ...common,
          receipts_add: form.receipts
            .filter((r) => r.kind === "new")
            .map((r) => r.src),
          receipt_ids_remove: form.removedReceiptIds,
        },
      });
    } else {
      await createMutation.mutateAsync({
        ...common,
        receipts: form.receipts.map((r) => r.src),
      });
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
              Dépenses générales de l'entreprise — déduites du chiffre
              d'affaires
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
              <Badge
                key={c.category_id}
                variant="secondary"
                className="font-normal"
              >
                {c.category_name} : {fmtXaf(c.total)}
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
                <TableHead>Justificatifs</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right w-[110px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucune dépense imputée à{" "}
                    <span className="capitalize">
                      {formatMonthLabelFr(year, month)}
                    </span>
                    . Vérifiez le mois sélectionné en haut à droite — les
                    dépenses imputées à un autre mois s’affichent sous ce
                    mois-là.
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
                          <p className="text-xs font-normal text-muted-foreground truncate max-w-[240px]">
                            {row.notes}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {row.category_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {formatMonthLabelFr(ey, em)}
                      </TableCell>
                      <TableCell>
                        {row.receipt_count > 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-primary"
                            title="Voir les justificatifs"
                            onClick={() => void openReceiptViewer(row)}
                          >
                            <Paperclip className="mr-1 h-3.5 w-3.5" />
                            {row.receipt_count}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

      {/* Dialog création / édition — layout « fiche employé » */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={FORM_DIALOG_CONTENT_CLASS}
          closeClassName={FORM_DIALOG_CLOSE_CLASS}
        >
          <div className={FORM_DIALOG_HEADER_CLASS}>
            <DialogTitle className="text-base font-semibold leading-tight">
              {editTarget ? "Modifier la dépense" : "Ajouter une dépense"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Dépense générale — déduite du chiffre d’affaires du mois
              d’imputation choisi.
            </DialogDescription>
          </div>
          <div className={FORM_DIALOG_BODY_CLASS}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
              <div className="flex flex-col gap-2.5">
                <SectionCard step={1} icon={Receipt} title="Informations">
                  <Field label="Libellé *" htmlFor="exp-label">
                    <Input
                      id="exp-label"
                      value={form.label}
                      onChange={(e) => patch({ label: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Ex. Loyer bureau, facture ENEO…"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Catégorie *">
                      <Select
                        value={form.categoryId || undefined}
                        onValueChange={(v) => patch({ categoryId: v })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {categories.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Aucune catégorie — ajoutez-en dans Paramètres.
                        </p>
                      ) : null}
                    </Field>
                    <Field label="Montant (FCFA) *" htmlFor="exp-amount">
                      <Input
                        id="exp-amount"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={form.amount}
                        onChange={(e) => patch({ amount: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard
                  step={2}
                  icon={CalendarDays}
                  title="Dates & imputation"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Date de la dépense *" htmlFor="exp-date">
                      <Input
                        id="exp-date"
                        type="date"
                        value={form.expense_date}
                        onChange={(e) => patch({ expense_date: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </Field>
                    <Field label="Mois d'imputation *">
                      <Select
                        value={form.effective_month}
                        onValueChange={(v) => patch({ effective_month: v })}
                      >
                        <SelectTrigger className="h-8 text-sm">
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
                    </Field>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    La dépense sera déduite du chiffre d’affaires du mois
                    d’imputation (utile pour les factures reçues en retard).
                  </p>
                </SectionCard>

                <SectionCard
                  step={3}
                  icon={FileText}
                  title={noteRequired ? "Notes (obligatoire)" : "Notes"}
                >
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    className="text-sm min-h-[72px]"
                    placeholder={
                      noteRequired
                        ? `Précisez la nature de la dépense (obligatoire pour « ${selectedCategory?.name} »)`
                        : "Référence facture, précisions…"
                    }
                  />
                  {noteRequired && form.notes.trim().length === 0 ? (
                    <p className="text-[11px] text-orange-600">
                      Une note est obligatoire pour la catégorie «{" "}
                      {selectedCategory?.name} ».
                    </p>
                  ) : null}
                </SectionCard>
              </div>

              <div className="flex flex-col gap-2.5">
                <SectionCard
                  step={4}
                  icon={Paperclip}
                  title={`Justificatifs (${form.receipts.length}/${MAX_RECEIPTS})`}
                >
                  {receiptsLoading ? (
                    <Skeleton className="h-40 w-full rounded-md" />
                  ) : (
                    <div className="space-y-2">
                      {form.receipts.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {form.receipts.map((r, index) => (
                            <div
                              key={r.kind === "existing" ? `e-${r.id}` : `n-${index}`}
                              className="relative overflow-hidden rounded-md border bg-background/60"
                            >
                              <button
                                type="button"
                                className="block w-full cursor-zoom-in"
                                title="Agrandir"
                                onClick={() =>
                                  setReceiptViewer({
                                    label: form.label || "Justificatif",
                                    images: [r.src],
                                  })
                                }
                              >
                                {isPdf(r.src) ? (
                                  <div className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-muted/40">
                                    <FileText className="h-8 w-8 text-red-500" />
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      PDF
                                    </span>
                                  </div>
                                ) : (
                                  <img
                                    src={r.src}
                                    alt={`Justificatif ${index + 1}`}
                                    className="h-28 w-full object-cover"
                                  />
                                )}
                              </button>
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="absolute right-1 top-1 h-6 w-6"
                                title="Retirer"
                                onClick={() => removeReceipt(index)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {form.receipts.length < MAX_RECEIPTS ? (
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background/60 px-4 py-6 text-center">
                          <Paperclip className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Ajouter des justificatifs (reçus, factures…)
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Images (PNG, JPEG, WebP) ou PDF — plusieurs fichiers
                            possibles
                          </span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              void handleReceiptFiles(e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Maximum {MAX_RECEIPTS} justificatifs atteint.
                        </p>
                      )}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          </div>
          <div className={FORM_DIALOG_FOOTER_CLASS}>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!formValid || saving || receiptsLoading}
              onClick={() => void handleSubmit()}
            >
              {saving
                ? "Enregistrement…"
                : editTarget
                  ? "Enregistrer"
                  : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visionneuse de justificatifs */}
      <Dialog
        open={receiptViewer != null}
        onOpenChange={(open) => {
          if (!open) setReceiptViewer(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Justificatifs — {receiptViewer?.label}</DialogTitle>
          </DialogHeader>
          {receiptViewer?.images ? (
            <div className="space-y-3">
              {receiptViewer.images.map((src, i) =>
                isPdf(src) ? (
                  <iframe
                    key={i}
                    src={src}
                    title={`Justificatif PDF ${i + 1}`}
                    className="h-[60vh] w-full rounded-md border"
                  />
                ) : (
                  <img
                    key={i}
                    src={src}
                    alt={`Justificatif ${i + 1}`}
                    className="mx-auto max-h-[60vh] rounded-md object-contain"
                  />
                )
              )}
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-md" />
          )}
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
              définitivement supprimée — justificatifs compris — et ne comptera
              plus dans les rapports.
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
