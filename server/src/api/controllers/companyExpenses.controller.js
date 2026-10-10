/**
 * Dépenses générales de l'entreprise — /api/v1/expenses (super_admin).
 * Saisies manuellement dans le dashboard (source 'manual'), distinctes des
 * dépenses opérationnelles de l'API livraisons et des salaires RH.
 * L'imputation comptable se fait via effective_month (1er du mois).
 *
 * Catégories dynamiques (gérées dans Paramètres, requires_note par
 * catégorie) + justificatifs multiples par dépense (5 max).
 */

const { z } = require("zod");
const {
  listExpenseCategories,
  getExpenseCategoryById,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  listCompanyExpenses,
  getCompanyExpenseById,
  createCompanyExpense,
  updateCompanyExpense,
  deleteCompanyExpense,
  addExpenseReceipts,
  deleteExpenseReceipts,
  countExpenseReceipts,
  summarizeCompanyExpenses,
} = require("../../db");

const MAX_RECEIPTS = 5;

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

/** Justificatif (data URL) : image PNG/JPEG/WebP ou PDF, ~2 Mo max encodé. */
const receiptImageSchema = z
  .string()
  .regex(
    /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/,
    { message: "Image (PNG, JPEG, WebP) ou PDF attendu" }
  )
  .max(2_800_000, "Fichier trop lourd (2 Mo max)");

const expenseBaseSchema = z.object({
  label: z.string().trim().min(1).max(200),
  category_id: z.number().int().positive(),
  amount: z.number().int().min(0),
  expense_date: dateSchema,
  effective_month: effectiveMonthSchema,
  notes: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(2000).nullable().optional()
  ),
});

const createExpenseSchema = expenseBaseSchema.extend({
  receipts: z.array(receiptImageSchema).max(MAX_RECEIPTS).optional().default([]),
});

const patchExpenseSchema = expenseBaseSchema.partial().extend({
  /** Nouveaux justificatifs à ajouter. */
  receipts_add: z.array(receiptImageSchema).max(MAX_RECEIPTS).optional(),
  /** Ids de justificatifs existants à supprimer. */
  receipt_ids_remove: z.array(z.number().int().positive()).optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  requires_note: z.boolean().optional().default(false),
});

const patchCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  requires_note: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function noteRequiredMessage(categoryName) {
  return `Une note est obligatoire pour la catégorie « ${categoryName} » (précisez la dépense)`;
}

/**
 * Catégorie valide + règle « note obligatoire » appliquée.
 * @returns {Promise<{ ok: true } | { ok: false, status: number, body: object }>}
 */
async function checkCategoryRules(categoryId, notes, { mustBeActive } = {}) {
  const category = await getExpenseCategoryById(categoryId);
  if (!category || (mustBeActive && !category.is_active)) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: "invalid_category",
        message: "Catégorie inconnue ou désactivée",
      },
    };
  }
  if (category.requires_note && !(notes && String(notes).trim())) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: "note_required",
        message: noteRequiredMessage(category.name),
      },
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Catégories (gérées dans Paramètres)
// ---------------------------------------------------------------------------

async function listCategoriesHandler(req, res, next) {
  try {
    const activeOnly = String(req.query.active || "") === "true";
    const rows = await listExpenseCategories({ activeOnly });
    return res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function createCategoryHandler(req, res, next) {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const category = await createExpenseCategory(parsed.data);
    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "duplicate",
        message: "Une catégorie avec ce nom existe déjà",
      });
    }
    next(err);
  }
}

async function patchCategoryHandler(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const updated = await updateExpenseCategory(id, parsed.data);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "duplicate",
        message: "Une catégorie avec ce nom existe déjà",
      });
    }
    next(err);
  }
}

async function deleteCategoryHandler(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const updated = await deleteExpenseCategory(id);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Dépenses
// ---------------------------------------------------------------------------

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
    const rules = await checkCategoryRules(
      parsed.data.category_id,
      parsed.data.notes,
      { mustBeActive: true }
    );
    if (!rules.ok) {
      return res.status(rules.status).json(rules.body);
    }
    const expense = await createCompanyExpense({
      ...parsed.data,
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

    // Règle catégorie/note sur l'état FUSIONNÉ (patch partiel)
    const finalCategoryId = parsed.data.category_id ?? existing.category_id;
    const finalNotes =
      "notes" in parsed.data ? parsed.data.notes : existing.notes;
    const rules = await checkCategoryRules(finalCategoryId, finalNotes, {
      // Une catégorie désactivée reste valide pour une dépense qui l'a déjà
      mustBeActive: parsed.data.category_id != null,
    });
    if (!rules.ok) {
      return res.status(rules.status).json(rules.body);
    }

    // Plafond de justificatifs après ajouts/suppressions
    const toAdd = parsed.data.receipts_add ?? [];
    const toRemove = parsed.data.receipt_ids_remove ?? [];
    if (toAdd.length || toRemove.length) {
      const current = await countExpenseReceipts(id);
      const removable = (existing.receipts || []).filter((r) =>
        toRemove.includes(r.id)
      ).length;
      if (current - removable + toAdd.length > MAX_RECEIPTS) {
        return res.status(400).json({
          success: false,
          error: "too_many_receipts",
          message: `Maximum ${MAX_RECEIPTS} justificatifs par dépense`,
        });
      }
      await deleteExpenseReceipts(id, toRemove);
      await addExpenseReceipts(id, toAdd);
    }

    const { receipts_add, receipt_ids_remove, ...fields } = parsed.data;
    const updated = await updateCompanyExpense(id, fields);
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
  MAX_RECEIPTS,
  listCategoriesHandler,
  createCategoryHandler,
  patchCategoryHandler,
  deleteCategoryHandler,
  listExpensesHandler,
  getExpenseHandler,
  createExpenseHandler,
  patchExpenseHandler,
  deleteExpenseHandler,
  summaryHandler,
};
