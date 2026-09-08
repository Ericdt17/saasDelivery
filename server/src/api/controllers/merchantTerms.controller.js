/**
 * Merchant terms API — conditions générales pour marchands partenaires (super_admin)
 */

const { z } = require("zod");
const {
  listMerchantTerms,
  getMerchantTermsById,
  createMerchantTerms,
  updateMerchantTerms,
  deleteMerchantTerms,
} = require("../../db");

const createMerchantTermsSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const patchMerchantTermsSchema = createMerchantTermsSchema.partial();

async function listAdminMerchantTerms(req, res, next) {
  try {
    const rows = await listMerchantTerms();
    return res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function createAdminMerchantTerms(req, res, next) {
  try {
    const parsed = createMerchantTermsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const row = await createMerchantTerms(parsed.data);
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function patchAdminMerchantTerms(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchMerchantTermsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await getMerchantTermsById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Merchant terms not found" });
    }
    const row = await updateMerchantTerms(id, parsed.data);
    return res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function deleteAdminMerchantTerms(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const existing = await getMerchantTermsById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Merchant terms not found" });
    }
    const result = await deleteMerchantTerms(id);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: "Merchant terms not found" });
    }
    return res.json({ success: true, data: { id: result.id } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAdminMerchantTerms,
  createAdminMerchantTerms,
  patchAdminMerchantTerms,
  deleteAdminMerchantTerms,
};
