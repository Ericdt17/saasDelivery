/**
 * Dépenses générales de l'entreprise — /api/v1/expenses (super_admin).
 * Saisies manuellement dans le dashboard (source 'manual'), distinctes des
 * dépenses opérationnelles de l'API livraisons et des salaires RH.
 * L'imputation comptable se fait via effective_month (1er du mois).
 */

const { z } = require("zod");
const {
  listCompanyExpenses,
  getCompanyExpenseById,
  createCompanyExpense,
  updateCompanyExpense,
  deleteCompanyExpense,
  summarizeCompanyExpenses,
} = require("../../db");

const CATEGORIES = [
  "loyer",
  "energie_eau",
  "internet_telephone",
  "transport",
  "materiel_equipement",
  "marketing",
  "administratif_legal",
  "maintenance",
  "autre",
];

const monthQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** 1er du mois d'imputation, dérivé d'une date YYYY-MM-DD. */
const effectiveMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "Expected YYYY-MM-01");

/** Justificatif image (data URL), ~2 Mo max une fois encodé. */
const receiptSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, {
      message: "Image PNG, JPEG ou WebP attendue",
    })
    .max(2_800_000, "Image trop lourde (2 Mo max)")
    .nullable()
    .optional()
);

const expenseBaseSchema = z.object({
  label: z.string().trim().min(1).max(200),
  category: z.enum(CATEGORIES),
  amount: z.number().int().min(0),
  expense_date: dateSchema,
  effective_month: effectiveMonthSchema,
  notes: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(2000).nullable().optional()
  ),
  receipt_base64: receiptSchema,
});

const NOTE_REQUIRED_MSG =
  "Une note est obligatoire pour la catégorie « Autre » (précisez la dépense)";

const createExpenseSchema = expenseBaseSchema.superRefine((d, ctx) => {
  if (d.category === "autre" && !(d.notes && d.notes.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notes"],
      message: NOTE_REQUIRED_MSG,
    });
  }
});

const patchExpenseSchema = expenseBaseSchema.partial();

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function listExpensesHandler(req, res, next) {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { year, month } = parsed.data;
    const [rows, summary] = await Promise.all([
      listCompanyExpenses({ year, month }),
      summarizeCompanyExpenses({ year, month }),
    ]);
    return res.json({ success: true, data: { expenses: rows, summary } });
  } catch (err) {
    next(err);
  }
}

async function createExpenseHandler(req, res, next) {
  try {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const expense = await createCompanyExpense({
      ...parsed.data,
      receipt_base64: parsed.data.receipt_base64 ?? null,
      created_by: req.user?.userId ?? null,
    });
    return res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
}

async function getExpenseHandler(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const expense = await getCompanyExpenseById(id);
    if (!expense) {
      return res.status(404).json({ success: false, error: "Expense not found" });
    }
    return res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
}

async function patchExpenseHandler(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await getCompanyExpenseById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Expense not found" });
    }
    const finalCategory = parsed.data.category ?? existing.category;
    const finalNotes =
      "notes" in parsed.data ? parsed.data.notes : existing.notes;
    if (finalCategory === "autre" && !(finalNotes && String(finalNotes).trim())) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: NOTE_REQUIRED_MSG,
      });
    }
    const updated = await updateCompanyExpense(id, parsed.data);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteExpenseHandler(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const deleted = await deleteCompanyExpense(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Expense not found" });
    }
    return res.json({ success: true, data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
}

async function summaryHandler(req, res, next) {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const summary = await summarizeCompanyExpenses(parsed.data);
    return res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  CATEGORIES,
  listExpensesHandler,
  getExpenseHandler,
  createExpenseHandler,
  patchExpenseHandler,
  deleteExpenseHandler,
  summaryHandler,
};
