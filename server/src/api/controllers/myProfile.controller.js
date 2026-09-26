/**
 * Personal profile (Mon profil) — name, fonction, signature, stamp for super_admin.
 */

const { z } = require("zod");
const { getAgencyById, updateAgencyProfile } = require("../../db");

const patchMeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fonction: z.string().trim().max(120).nullable().optional(),
  signature_base64: z.string().nullable().optional(),
  stamp_base64: z.string().nullable().optional(),
});

function toPublicProfile(row) {
  if (!row) {
    return {
      name: "",
      email: "",
      fonction: null,
      signature_base64: null,
      stamp_base64: null,
    };
  }
  return {
    name: row.name || "",
    email: row.email || "",
    fonction:
      typeof row.fonction === "string" && row.fonction.trim()
        ? row.fonction.trim()
        : null,
    signature_base64:
      typeof row.signature_base64 === "string" && row.signature_base64.trim()
        ? row.signature_base64.trim()
        : null,
    stamp_base64:
      typeof row.stamp_base64 === "string" && row.stamp_base64.trim()
        ? row.stamp_base64.trim()
        : null,
  };
}

async function getMyProfileHandler(req, res, next) {
  try {
    const row = await getAgencyById(req.user.userId);
    if (!row) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.json({ success: true, data: toPublicProfile(row) });
  } catch (err) {
    next(err);
  }
}

async function patchMyProfileHandler(req, res, next) {
  try {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await getAgencyById(req.user.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const body = parsed.data;
    const row = await updateAgencyProfile(req.user.userId, {
      name: body.name,
      fonction: body.fonction ?? null,
      signature_base64: body.signature_base64 ?? null,
      stamp_base64: body.stamp_base64 ?? null,
    });
    return res.json({ success: true, data: toPublicProfile(row) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProfileHandler,
  patchMyProfileHandler,
  toPublicProfile,
};
