/**
 * Company settings API — singleton branding for PDFs (super_admin)
 */

const { z } = require("zod");
const { getCompanySettings, upsertCompanySettings } = require("../../db");
const {
  DEFAULT_COMPANY_BRANDING,
  ACCENT_COLOR_RE,
  resolveCompanyBranding,
} = require("../../lib/hrPayslip");

const putCompanySettingsSchema = z.object({
  company_name: z.string().trim().min(1).max(120),
  legal_name: z.string().trim().max(160).nullable().optional(),
  tax_id: z.string().trim().max(40).nullable().optional(),
  trade_register: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().email().max(120).nullable().optional()
  ),
  accent_color: z
    .string()
    .trim()
    .regex(ACCENT_COLOR_RE, "accent_color must be #RRGGBB")
    .optional(),
  logo_base64: z.string().nullable().optional(),
});

function toPublicCompanySettings(row) {
  const branding = resolveCompanyBranding(row);
  return {
    company_name: branding.companyName,
    legal_name: branding.legalName,
    tax_id: branding.taxId || null,
    trade_register: branding.tradeRegister || null,
    address: branding.address,
    phone: branding.phone,
    email: branding.email,
    accent_color: branding.accentColor,
    logo_base64: branding.logoBase64,
    updated_at: row?.updated_at ?? null,
  };
}

async function getCompanySettingsHandler(req, res, next) {
  try {
    const row = await getCompanySettings();
    return res.json({
      success: true,
      data: toPublicCompanySettings(row),
    });
  } catch (err) {
    next(err);
  }
}

async function putCompanySettingsHandler(req, res, next) {
  try {
    const parsed = putCompanySettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    const row = await upsertCompanySettings({
      company_name: body.company_name,
      legal_name: body.legal_name ?? null,
      tax_id: body.tax_id ?? null,
      trade_register: body.trade_register ?? null,
      address: body.address ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      accent_color: body.accent_color || DEFAULT_COMPANY_BRANDING.accentColor,
      logo_base64: body.logo_base64 ?? null,
    });
    return res.json({
      success: true,
      data: toPublicCompanySettings(row),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCompanySettingsHandler,
  putCompanySettingsHandler,
  toPublicCompanySettings,
};
