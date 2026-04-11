/**
 * Waitlist: public POST (landing); GET list is super admin only.
 */

const express = require("express");
const { z } = require("zod");
const { insertWaitlistEntry, getWaitlistEntries } = require("../../db");
const { normalizeWaitlistPhone } = require("../../utils/waitlistPhone");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();

const looseEmailCheck = z.string().email();

const waitlistSchema = z
  .object({
    email: z.string().min(1, { message: "required" }),
    phone: z.string().min(1, { message: "required" }),
  })
  .superRefine((data, ctx) => {
    const emailNorm = data.email.trim().toLowerCase();
    if (!looseEmailCheck.safeParse(emailNorm).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "invalid",
      });
    }
    if (!normalizeWaitlistPhone(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "invalid",
      });
    }
  });

function fieldsFromZodError(error) {
  const paths = new Set();
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      paths.add(key);
    }
  }
  return [...paths];
}

router.post("/", async (req, res) => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      error: "invalid_input",
      fields: fieldsFromZodError(parsed.error),
    });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const phone = normalizeWaitlistPhone(parsed.data.phone);

  try {
    await insertWaitlistEntry({ email, phone });
    return res.status(201).json({ success: true });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "already_registered",
      });
    }
    throw err;
  }
});

/**
 * GET /api/v1/waitlist — list entries (super admin only, cookie auth)
 */
router.get("/", authenticateToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const page = req.query.page != null ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
    const result = await getWaitlistEntries({ page, limit });
    res.json({
      success: true,
      data: result.entries,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
