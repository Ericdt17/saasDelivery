/**
 * Recruitment API — public landing + admin dashboard
 */

const { z } = require("zod");
const logger = require("../../logger");
const { Readable } = require("node:stream");
const { notifyNewApplication } = require("../../lib/botAlerts");
const { deleteCloudinaryAsset } = require("../../config/cloudinary");
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
  recruitmentDeleteApplication,
  recruitmentCreateApplicationWithAnswers,
} = require("../../db");

const transportEnum = z.enum(["scooter", "velo", "voiture", "apied"]);
const availabilityEnum = z.enum(["plein", "partiel", "weekend"]);
const educationLevelEnum = z.enum(["bac", "licence", "master", "doctorat"]);
const spokenLanguageEnum = z.enum(["francais", "anglais"]);
const ALLOWED_SPOKEN_LANGUAGES = new Set(spokenLanguageEnum.options);
const yesNoEnum = z.enum(["oui", "non"]);
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
  email: z.string().trim().email().max(255),
  quartier: z.string().trim().min(1),
  education_level: educationLevelEnum,
  field_of_study: z.string().trim().min(1).max(255),
  school_name: z.string().trim().min(1).max(255),
  currently_employed: yesNoEnum,
  in_other_company: yesNoEnum,
  transport: transportEnum,
  availability: availabilityEnum,
});

function getApplyFiles(req) {
  const filesObj =
    req.files && typeof req.files === "object" ? req.files : null;
  const photoFile = filesObj
    ? (filesObj.photo && filesObj.photo[0]) ||
      (filesObj.profile_photo && filesObj.profile_photo[0]) ||
      (filesObj.picture && filesObj.picture[0])
    : null;
  const cvFile =
    (req.file && req.file) ||
    (filesObj &&
      ((filesObj.cv && filesObj.cv[0]) ||
        (filesObj.file && filesObj.file[0]) ||
        (filesObj.resume && filesObj.resume[0]))) ||
    null;
  const coverLetterFile = filesObj
    ? (filesObj.cover_letter && filesObj.cover_letter[0]) ||
      (filesObj.motivation_letter && filesObj.motivation_letter[0]) ||
      (filesObj.letter && filesObj.letter[0])
    : null;
  return { photoFile, cvFile, coverLetterFile };
}

function validateRequiredApplyFiles(req) {
  const { photoFile, cvFile, coverLetterFile } = getApplyFiles(req);
  const invalidFields = [];
  if (!photoFile) {
    invalidFields.push({ field: "photo", messages: ["Photo is required"] });
  }
  if (!cvFile) {
    invalidFields.push({ field: "cv", messages: ["CV is required"] });
  }
  if (!coverLetterFile) {
    invalidFields.push({
      field: "cover_letter",
      messages: ["Cover letter is required"],
    });
  }
  return invalidFields;
}

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
    email: b.email,
    quartier: b.quartier ?? b.neighborhood,
    education_level: b.education_level,
    field_of_study: b.field_of_study ?? b.study_field,
    school_name: b.school_name ?? b.school,
    languages: b.languages,
    currently_employed: b.currently_employed,
    in_other_company: b.in_other_company,
    transport: b.transport,
    availability: b.availability,
  };
}

function parseLanguagesInput(raw) {
  if (raw === undefined || raw === null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("INVALID_LANGUAGES");
    }
    return parsed.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  return text.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function normalizeLanguagesForStorage(raw) {
  let list;
  try {
    list = parseLanguagesInput(raw);
  } catch {
    throw new Error("INVALID_LANGUAGES_JSON");
  }
  const unique = [...new Set(list)];
  if (unique.length === 0) {
    throw new Error("LANGUAGES_REQUIRED");
  }
  for (const lang of unique) {
    if (!ALLOWED_SPOKEN_LANGUAGES.has(lang)) {
      throw new Error(`INVALID_LANGUAGE:${lang}`);
    }
  }
  unique.sort();
  return unique.join(",");
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

    const missingFiles = validateRequiredApplyFiles(req);
    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        invalidFields: missingFiles,
      });
    }

    let languagesStored;
    try {
      languagesStored = normalizeLanguagesForStorage(req.body.languages);
    } catch (e) {
      if (e.message === "INVALID_LANGUAGES_JSON") {
        return res.status(400).json({
          success: false,
          error: "languages must be valid JSON array or comma-separated values",
        });
      }
      if (e.message === "LANGUAGES_REQUIRED") {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          invalidFields: [
            {
              field: "languages",
              messages: ["At least one language is required"],
            },
          ],
        });
      }
      if (e.message && e.message.startsWith("INVALID_LANGUAGE:")) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          invalidFields: [
            {
              field: "languages",
              messages: ["Allowed values: francais, anglais"],
            },
          ],
        });
      }
      return res.status(400).json({
        success: false,
        error: "Invalid languages",
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

    for (const q of questions) {
      const qid = Number(q.id);
      const entry = answersRaw.find((a) => Number(a.question_id) === qid);
      const text = entry ? String(entry.answer_text ?? "").trim() : "";
      if (!text) {
        return res.status(400).json({
          success: false,
          error: `Answer required for question ${qid}`,
        });
      }
    }

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

    const { photoFile, cvFile, coverLetterFile } = getApplyFiles(req);

    const cv_url = cvFile && cvFile.path ? cvFile.path : null;
    const cv_original_name =
      cvFile && cvFile.originalname ? cvFile.originalname : null;

    const photo_url =
      photoFile && photoFile.path ? photoFile.path : null;
    const photo_original_name =
      photoFile && photoFile.originalname ? photoFile.originalname : null;

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
      email: parsed.data.email.trim(),
      quartier: String(parsed.data.quartier).trim(),
      education_level: parsed.data.education_level,
      field_of_study: parsed.data.field_of_study.trim(),
      school_name: parsed.data.school_name.trim(),
      languages: languagesStored,
      currently_employed: parsed.data.currently_employed,
      in_other_company: parsed.data.in_other_company,
      transport: parsed.data.transport,
      availability: parsed.data.availability,
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

    notifyNewApplication({
      applicationId: result.id,
      jobOfferId,
      jobTitle: offer.title,
      jobType: offer.type,
      jobLocation: offer.location,
      fullName: parsed.data.full_name.trim(),
      phone: parsed.data.phone,
      email: parsed.data.email.trim(),
      quartier: String(parsed.data.quartier).trim() || null,
      educationLevel: parsed.data.education_level,
      fieldOfStudy: parsed.data.field_of_study.trim(),
      schoolName: parsed.data.school_name.trim(),
      languages: languagesStored,
      currentlyEmployed: parsed.data.currently_employed,
      inOtherCompany: parsed.data.in_other_company,
      transport: parsed.data.transport,
      availability: parsed.data.availability,
      photoUrl: photo_url,
      cvUrl: cv_url,
      coverLetterUrl: cover_letter_url,
      answers: answersPayload
        .map((a) => {
          const q = qById.get(Number(a.question_id));
          return {
            orderIndex: q?.order_index ?? 999,
            questionText: q?.question_text || `Question #${a.question_id}`,
            answerText: a.answer_text || "—",
          };
        })
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(({ questionText, answerText }) => ({ questionText, answerText })),
    }).catch(() => {});

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

async function deleteAdminApplication(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }

    const detail = await recruitmentGetApplicationDetail(id);
    if (!detail) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    const result = await recruitmentDeleteApplication(id);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    const app = detail.application;
    await Promise.allSettled([
      deleteCloudinaryAsset(app.photo_url),
      deleteCloudinaryAsset(app.cv_url),
      deleteCloudinaryAsset(app.cover_letter_url),
    ]);

    return res.json({ success: true, data: { id: result.id } });
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
  deleteAdminApplication,
};
