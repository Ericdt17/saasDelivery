/**
 * Recruitment API — public landing + admin dashboard
 */

const { z } = require("zod");
const logger = require("../../logger");
const { Readable } = require("node:stream");
const {
  recruitmentListOpenJobs,
  recruitmentGetOpenJobOfferById,
  recruitmentGetJobOfferById,
  recruitmentListQuestionsForJobOffer,
  recruitmentListAdminJobsWithCounts,
  recruitmentCreateJobOffer,
  recruitmentUpdateJobOffer,
  recruitmentDeleteJobOffer,
  recruitmentCreateJobQuestion,
  recruitmentUpdateJobQuestion,
  recruitmentDeleteJobQuestion,
  recruitmentGetQuestionById,
  recruitmentListAdminApplications,
  recruitmentGetApplicationDetail,
  recruitmentUpdateApplication,
  recruitmentCreateApplicationWithAnswers,
} = require("../../db");

const transportEnum = z.enum(["scooter", "velo", "voiture", "apied"]);
const availabilityEnum = z.enum(["plein", "partiel", "weekend"]);
/** Post type label — admin-defined, stored as VARCHAR(50) */
const jobOfferTypeSchema = z.string().trim().min(1).max(50);
const questionTypeEnum = z.enum(["text", "mcq"]);
const statusEnum = z.enum(["new", "in_review", "accepted", "rejected"]);

const createJobSchema = z.object({
  title: z.string().min(1),
  type: jobOfferTypeSchema,
  description: z.string().nullable().optional(),
  location: z.string().min(1).optional(),
  slots: z.coerce.number().int().min(1).optional(),
  is_open: z.boolean().optional(),
});

const patchJobSchema = createJobSchema.partial();

const createQuestionSchema = z
  .object({
    question_text: z.string().min(1),
    question_type: questionTypeEnum,
    options: z.array(z.string()).nullable().optional(),
    is_required: z.boolean().optional(),
    order_index: z.coerce.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.question_type === "mcq") {
      if (!Array.isArray(data.options) || data.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "options must be a non-empty array for mcq",
          path: ["options"],
        });
      }
    }
  });

const patchQuestionSchema = z
  .object({
    question_text: z.string().min(1).optional(),
    question_type: questionTypeEnum.optional(),
    options: z.array(z.string()).nullable().optional(),
    is_required: z.boolean().optional(),
    order_index: z.coerce.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.question_type === "mcq") {
      if (!Array.isArray(data.options) || data.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "options must be a non-empty array for mcq",
          path: ["options"],
        });
      }
    }
  });

const patchApplicationSchema = z.object({
  status: statusEnum.optional(),
  funnel_step: z.coerce.number().int().min(1).max(6).optional(),
  score: z.coerce.number().int().min(0).max(21).nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Each answer: question_id may be string or number in JSON; answer_text coerced to string */
const answerItemSchema = z.object({
  question_id: z.coerce.number().int().positive(),
  answer_text: z.coerce.string(),
});

const emptyToNull = (v) => (v === "" || v === undefined ? null : v);

const applyBodySchema = z.object({
  job_offer_id: z.coerce.number().int().positive(),
  full_name: z.string().min(1),
  phone: z.string().min(1).max(32),
  quartier: z.preprocess(emptyToNull, z.string().nullable().optional()),
  transport: z.preprocess(
    emptyToNull,
    transportEnum.nullable().optional()
  ),
  availability: z.preprocess(
    emptyToNull,
    availabilityEnum.nullable().optional()
  ),
});

/**
 * Multipart field aliases (front Vite/React uses job_id / neighborhood).
 * Canonical names after normalize: job_offer_id, quartier (snake_case).
 */
function normalizeApplyBodyRaw(body) {
  const b = body && typeof body === "object" ? body : {};
  return {
    job_offer_id: b.job_offer_id ?? b.job_id,
    full_name: b.full_name,
    phone: b.phone,
    quartier: b.quartier ?? b.neighborhood,
    transport: b.transport,
    availability: b.availability,
  };
}

function invalidFieldsFromZodFlatten(details) {
  const fe = details.fieldErrors || {};
  return Object.keys(fe)
    .filter((k) => Array.isArray(fe[k]) && fe[k].length > 0)
    .map((field) => ({ field, messages: fe[field] }));
}

function parseAnswersJson(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return [];
  }
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("INVALID_ANSWERS");
  }
  return z.array(answerItemSchema).parse(parsed);
}

function normalizeOptions(options) {
  if (options == null) return null;
  if (Array.isArray(options)) return options;
  if (typeof options === "string") {
    try {
      const o = JSON.parse(options);
      return Array.isArray(o) ? o : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function listOpenJobs(req, res, next) {
  try {
    const jobs = await recruitmentListOpenJobs();
    return res.json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
}

/** Same shape as rows from recruitmentListOpenJobs — no internal fields */
function pickPublicOpenJob(offer) {
  return {
    id: offer.id,
    title: offer.title,
    type: offer.type,
    description: offer.description,
    location: offer.location,
    slots: offer.slots,
  };
}

async function getOpenJobPublic(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid job id" });
    }
    const offer = await recruitmentGetOpenJobOfferById(id);
    if (!offer) {
      return res
        .status(404)
        .json({ success: false, error: "Job not found or closed" });
    }
    return res.json({ success: true, data: pickPublicOpenJob(offer) });
  } catch (err) {
    next(err);
  }
}

async function getJobQuestionsPublic(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid job id" });
    }
    const offer = await recruitmentGetOpenJobOfferById(id);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Job not found or closed" });
    }
    const questions = await recruitmentListQuestionsForJobOffer(id);
    return res.json({ success: true, data: questions });
  } catch (err) {
    next(err);
  }
}

async function apply(req, res, next) {
  try {
    const raw = normalizeApplyBodyRaw(req.body);
    const parsed = applyBodySchema.safeParse({
      ...raw,
      phone: String(raw.phone ?? "").trim(),
    });
    if (!parsed.success) {
      const details = parsed.error.flatten();
      logger.warn(
        {
          fieldErrors: details.fieldErrors,
          formErrors: details.formErrors,
          bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
        },
        "recruitment apply: body validation failed"
      );
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        invalidFields: invalidFieldsFromZodFlatten(details),
        details,
      });
    }

    let answersRaw;
    try {
      answersRaw = parseAnswersJson(req.body.answers);
    } catch (e) {
      if (e.message === "INVALID_JSON") {
        return res.status(400).json({
          success: false,
          error: "answers must be valid JSON",
        });
      }
      if (e.message === "INVALID_ANSWERS") {
        return res.status(400).json({
          success: false,
          error: "answers must be a JSON array of { question_id, answer_text }",
        });
      }
      if (e instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid answers",
          details: e.flatten(),
        });
      }
      return res.status(400).json({
        success: false,
        error: "Invalid answers",
      });
    }

    const jobOfferId = parsed.data.job_offer_id;
    const offer = await recruitmentGetOpenJobOfferById(jobOfferId);
    if (!offer) {
      return res.status(400).json({
        success: false,
        error: "Job not found or no longer open",
      });
    }

    const questions = await recruitmentListQuestionsForJobOffer(jobOfferId);
    const qById = new Map(questions.map((q) => [Number(q.id), q]));

    const seenQ = new Set();
    for (const a of answersRaw) {
      const qid = Number(a.question_id);
      if (seenQ.has(qid)) {
        return res.status(400).json({
          success: false,
          error: "Duplicate question_id in answers",
        });
      }
      seenQ.add(qid);
      const q = qById.get(qid);
      if (!q) {
        return res.status(400).json({
          success: false,
          error: `Question ${qid} does not belong to this job`,
        });
      }
      const text = String(a.answer_text ?? "").trim();
      if (q.question_type === "mcq" && text) {
        const opts = normalizeOptions(q.options);
        if (!opts || !opts.some((o) => String(o).trim() === text)) {
          return res.status(400).json({
            success: false,
            error: `Invalid MCQ answer for question ${qid}`,
          });
        }
      }
    }

    const answersPayload = answersRaw.map((a) => ({
      question_id: Number(a.question_id),
      answer_text: String(a.answer_text ?? "").trim() || null,
    }));

    const cv_url = req.file && req.file.path ? req.file.path : null;
    const cv_original_name =
      req.file && req.file.originalname ? req.file.originalname : null;

    const filesObj =
      req.files && typeof req.files === "object" ? req.files : null;
    const photoFile = filesObj
      ? (filesObj.photo && filesObj.photo[0]) ||
        (filesObj.profile_photo && filesObj.profile_photo[0]) ||
        (filesObj.picture && filesObj.picture[0])
      : null;
    const photo_url =
      photoFile && photoFile.path ? photoFile.path : null;
    const photo_original_name =
      photoFile && photoFile.originalname ? photoFile.originalname : null;

    const coverLetterFile = filesObj
      ? (filesObj.cover_letter && filesObj.cover_letter[0]) ||
        (filesObj.motivation_letter && filesObj.motivation_letter[0]) ||
        (filesObj.letter && filesObj.letter[0])
      : null;
    const cover_letter_url =
      coverLetterFile && coverLetterFile.path ? coverLetterFile.path : null;
    const cover_letter_original_name =
      coverLetterFile && coverLetterFile.originalname
        ? coverLetterFile.originalname
        : null;

    const result = await recruitmentCreateApplicationWithAnswers({
      job_offer_id: jobOfferId,
      full_name: parsed.data.full_name.trim(),
      phone: parsed.data.phone,
      quartier: parsed.data.quartier != null ? String(parsed.data.quartier).trim() : null,
      transport: parsed.data.transport ?? null,
      availability: parsed.data.availability ?? null,
      photo_url,
      photo_original_name,
      cv_url,
      cv_original_name,
      cover_letter_url,
      cover_letter_original_name,
      answers: answersPayload,
    });

    if (result.error === "offer_not_found") {
      return res.status(400).json({ success: false, error: "Job not found" });
    }
    if (result.error === "offer_closed") {
      return res.status(400).json({ success: false, error: "Job is closed" });
    }

    return res.status(201).json({ success: true, data: { id: result.id } });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "You have already applied for this job with this phone number",
      });
    }
    next(err);
  }
}

async function listAdminJobs(req, res, next) {
  try {
    const rows = await recruitmentListAdminJobsWithCounts();
    return res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function createAdminJob(req, res, next) {
  try {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const row = await recruitmentCreateJobOffer(parsed.data);
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function patchAdminJob(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await recruitmentGetJobOfferById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    const row = await recruitmentUpdateJobOffer(id, parsed.data);
    return res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function deleteAdminJob(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const existing = await recruitmentGetJobOfferById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    const result = await recruitmentDeleteJobOffer(id);
    if (!result.deleted) {
      if (result.reason === "has_applications") {
        return res.status(400).json({
          success: false,
          error:
            "Cannot delete this job because there are applications linked to it",
        });
      }
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    return res.json({ success: true, data: { id: result.id } });
  } catch (err) {
    next(err);
  }
}

async function listAdminJobQuestions(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid job id" });
    }
    const offer = await recruitmentGetJobOfferById(id);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    const questions = await recruitmentListQuestionsForJobOffer(id);
    return res.json({ success: true, data: questions });
  } catch (err) {
    next(err);
  }
}

async function createAdminJobQuestion(req, res, next) {
  try {
    const jobId = Number(req.params.id);
    if (!Number.isFinite(jobId)) {
      return res.status(400).json({ success: false, error: "Invalid job id" });
    }
    const offer = await recruitmentGetJobOfferById(jobId);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    const parsed = createQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const row = await recruitmentCreateJobQuestion({
      job_offer_id: jobId,
      question_text: parsed.data.question_text,
      question_type: parsed.data.question_type,
      options:
        parsed.data.question_type === "mcq" ? parsed.data.options : null,
      is_required: parsed.data.is_required,
      order_index: parsed.data.order_index,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function patchAdminQuestion(req, res, next) {
  try {
    const questionId = Number(req.params.questionId);
    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ success: false, error: "Invalid question id" });
    }
    const existing = await recruitmentGetQuestionById(questionId);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Question not found" });
    }
    const parsed = patchQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const data = { ...parsed.data };
    if (data.question_type === "text") {
      data.options = null;
    }
    const row = await recruitmentUpdateJobQuestion(questionId, data);
    return res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function deleteAdminQuestion(req, res, next) {
  try {
    const questionId = Number(req.params.questionId);
    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ success: false, error: "Invalid question id" });
    }
    const result = await recruitmentDeleteJobQuestion(questionId);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: "Question not found" });
    }
    return res.json({ success: true, data: { id: result.id } });
  } catch (err) {
    next(err);
  }
}

async function listAdminApplications(req, res, next) {
  try {
    const filters = {
      job_offer_id: req.query.job_offer_id,
      status: req.query.status,
      funnel_step: req.query.funnel_step,
    };
    const rows = await recruitmentListAdminApplications(filters);
    return res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getAdminApplication(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const detail = await recruitmentGetApplicationDetail(id);
    if (!detail) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }
    return res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
}

async function getAdminApplicationCv(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }

    const detail = await recruitmentGetApplicationDetail(id);
    if (!detail) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    const url = detail?.application?.cv_url;
    if (!url) {
      return res.status(404).json({ success: false, error: "CV not found" });
    }

    // Proxy the PDF and force inline rendering (prevents Cloudinary "attachment" downloads).
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      logger.warn(
        { id, status: upstream.status, statusText: upstream.statusText },
        "CV upstream fetch failed"
      );
      return res
        .status(502)
        .json({ success: false, error: "Unable to fetch CV" });
    }

    const filename = detail?.application?.cv_original_name || "cv.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(filename).replace(/"/g, "")}"`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Node fetch body is a Web ReadableStream → convert to Node stream.
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function getAdminApplicationCoverLetter(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }

    const detail = await recruitmentGetApplicationDetail(id);
    if (!detail) {
      return res
        .status(404)
        .json({ success: false, error: "Application not found" });
    }

    const url = detail?.application?.cover_letter_url;
    if (!url) {
      return res
        .status(404)
        .json({ success: false, error: "Cover letter not found" });
    }

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      logger.warn(
        { id, status: upstream.status, statusText: upstream.statusText },
        "Cover letter upstream fetch failed"
      );
      return res
        .status(502)
        .json({ success: false, error: "Unable to fetch cover letter" });
    }

    const filename =
      detail?.application?.cover_letter_original_name || "lettre-motivation.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(filename).replace(/"/g, "")}"`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function patchAdminApplication(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const row = await recruitmentUpdateApplication(id, parsed.data);
    if (!row) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOpenJobs,
  getOpenJobPublic,
  getJobQuestionsPublic,
  apply,
  listAdminJobs,
  createAdminJob,
  patchAdminJob,
  deleteAdminJob,
  listAdminJobQuestions,
  createAdminJobQuestion,
  patchAdminQuestion,
  deleteAdminQuestion,
  listAdminApplications,
  getAdminApplication,
  getAdminApplicationCv,
  getAdminApplicationCoverLetter,
  patchAdminApplication,
};
