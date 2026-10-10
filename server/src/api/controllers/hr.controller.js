/**
 * HR employees API — roster + face enrollment (super_admin)
 * + public check-in (no auth)
 */

const { z } = require("zod");
const {
  listEmployees,
  getEmployeeById,
  getEmployeeDocuments,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  enrollEmployeeFace,
  getEmployeeByEmailWithDescriptor,
  getAttendanceByEmployeeAndDate,
  createAttendance,
  upsertAttendance,
  listAttendances,
  summarizeAttendances,
  replaceSalaryFrom,
  listWorkplaces,
  getWorkplaceById,
  createWorkplace,
  updateWorkplace,
  deleteWorkplace,
} = require("../../db");
const {
  isWithinOffice,
  isFaceMatch,
  getCheckInStatus,
  getDoualaDateString,
  getDoualaParts,
  countWeekdaysElapsed,
  countWeekdaysInMonth,
  estimateDayPenaltyRates,
} = require("../../lib/hrCheckin");
const { CHECKIN_MESSAGES } = require("../../lib/hrCheckinMessages");
const { notifyHrCheckinAlert } = require("../../lib/botAlerts");
const { buildEmployeePayslipPdf } = require("../../lib/hrPayslipPdf");
const { formatMonthLabelFr } = require("../../lib/hrPayslip");
const {
  sendTextDm,
  WhatsAppBotError,
  isWhatsAppBotEnabled,
} = require("../../lib/whatsappBotClient");
const {
  createPayslipDownloadLink,
  resolvePayslipDownloadCode,
} = require("../../lib/payslipDownloadToken");
const {
  resolvePayrollEligibleFrom,
  firstOfCurrentMonthDouala,
} = require("../../lib/hrPayrollEligibility");
const {
  resolveSalaryEffectiveFrom,
  salariesEqual,
} = require("../../lib/hrSalary");
const { regulationStatusForEmployee } = require("./hrRegulation.controller");

function publicEmployeeCheckinPayload(employee) {
  const parts = getDoualaParts(new Date());
  const workdays = countWeekdaysInMonth(parts.year, Number(parts.month));
  const rates = estimateDayPenaltyRates(employee.salary_base, workdays);
  return {
    full_name: employee.full_name,
    email: employee.email,
    is_enrolled: isEmployeeEnrolled(employee),
    cost_late_day: rates?.cost_late_day ?? null,
    cost_absent_day: rates?.cost_absent_day ?? null,
  };
}

const emptyToNull = (v) => (v === "" || v === undefined ? null : v);
const optionalDateSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .nullable()
    .optional()
);
const optionalTrimmedSchema = z.preprocess(
  emptyToNull,
  z.string().trim().min(1).nullable().optional()
);
const optionalEmailSchema = z.preprocess(
  emptyToNull,
  z.string().trim().email().nullable().optional()
);
const optionalGenderSchema = z.preprocess(
  emptyToNull,
  z.enum(["homme", "femme"]).nullable().optional()
);

const createEmployeeSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email(),
  personal_email: optionalEmailSchema,
  phone: z.string().trim().min(1).nullable().optional(),
  poste: z.string().trim().min(1).nullable().optional(),
  salary_base: z.number().int().nullable().optional(),
  /** When true, mass salary starts on the 1st of next Douala month. */
  include_next_month: z.boolean().optional().default(false),
  employee_type: z.enum(["livreur", "agent"]).nullable().optional(),
  date_of_birth: optionalDateSchema,
  place_of_birth: optionalTrimmedSchema,
  gender: optionalGenderSchema,
  nationality: optionalTrimmedSchema,
  national_id: optionalTrimmedSchema,
  address: optionalTrimmedSchema,
  workplace_id: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.number().int().positive().nullable().optional()
  ),
  emergency_contact_name: optionalTrimmedSchema,
  emergency_contact_phone: optionalTrimmedSchema,
  emergency_contact_relation: optionalTrimmedSchema,
  work_schedule: optionalTrimmedSchema,
  contract_kind: z.enum(["cdi", "cdd"]).nullable().optional(),
  contract_start_date: optionalDateSchema,
  contract_end_date: optionalDateSchema,
  trial_period_days: z.number().int().min(0).nullable().optional(),
  mission_description: optionalTrimmedSchema,
});

/** Document image (data URL) — stockage pur, hors génération de contrats. */
const optionalDocumentImageSchema = z.preprocess(
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

const patchEmployeeSchema = createEmployeeSchema
  .partial()
  .extend({
    /** Photos CNI + plan de localisation (images, null pour retirer). */
    cni_front_base64: optionalDocumentImageSchema,
    cni_back_base64: optionalDocumentImageSchema,
    home_location_base64: optionalDocumentImageSchema,
    is_active: z.boolean().optional(),
    /**
     * When salary_base changes: false (default) → effective next Douala month;
     * true → effective this month (correction / intentional October adjust).
     */
    salary_apply_this_month: z.boolean().optional().default(false),
  });

const listEmployeesQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const enrollEmployeeSchema = z.object({
  face_descriptor: z.array(z.number()).length(128),
});

const verifyEmailQuerySchema = z.object({
  email: z.string().trim().email(),
});

const checkinBodySchema = z.object({
  email: z.string().trim().email(),
  face_descriptor: z.array(z.number()).length(128),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
});

const listAttendancesQuerySchema = z
  .object({
    employee_id: z.coerce.number().int().positive().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).optional(),
  })
  .superRefine((data, ctx) => {
    const hasMonth = data.month != null;
    const hasYear = data.year != null;
    if (hasMonth !== hasYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "month and year must be provided together",
        path: hasMonth ? ["year"] : ["month"],
      });
    }
  });

const summaryAttendancesQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
});

const payslipQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  download: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

const manualAttendanceSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "late", "absent"]),
});

const clientErrorSchema = z.object({
  kind: z.enum([
    "geo_denied",
    "geo_timeout",
    "geo_unavailable",
    "camera_denied",
    "camera_unavailable",
    "network",
    "other",
  ]),
  email: z.string().trim().email().optional(),
  message: z.string().trim().max(500).optional(),
  user_agent: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(500).optional(),
});

function fireHrAlert(payload) {
  Promise.resolve(notifyHrCheckinAlert(payload)).catch(() => {});
}

function stripFaceDescriptor(row) {
  if (!row || typeof row !== "object") return row;
  const { face_descriptor, ...safe } = row;
  return safe;
}

function stripFaceDescriptorList(rows) {
  return Array.isArray(rows) ? rows.map(stripFaceDescriptor) : rows;
}

function asDescriptorArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isEmployeeEnrolled(employee) {
  if (!employee) return false;
  if (employee.enrolled_at) return true;
  const desc = asDescriptorArray(employee.face_descriptor);
  return Array.isArray(desc) && desc.length === 128;
}

async function listAdminEmployees(req, res, next) {
  try {
    const parsed = listEmployeesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { year, month } = parsed.data;
    if ((year != null) !== (month != null)) {
      return res.status(400).json({
        success: false,
        error: "year and month must be provided together",
      });
    }
    const rows = await listEmployees(
      year != null && month != null ? { year, month } : {}
    );
    return res.json({ success: true, data: stripFaceDescriptorList(rows) });
  } catch (err) {
    next(err);
  }
}

async function createAdminEmployee(req, res, next) {
  try {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { include_next_month, ...fields } = parsed.data;
    if (fields.workplace_id != null) {
      const workplace = await getWorkplaceById(fields.workplace_id);
      if (!workplace || workplace.is_active === false) {
        return res.status(400).json({
          success: false,
          error: "Invalid workplace_id",
        });
      }
    }
    if (fields.contract_kind === "cdi") {
      fields.contract_end_date = null;
    }
    const row = await createEmployee({
      ...fields,
      payroll_eligible_from: resolvePayrollEligibleFrom({
        includeNextMonth: include_next_month === true,
      }),
    });
    return res.status(201).json({ success: true, data: stripFaceDescriptor(row) });
  } catch (err) {
    next(err);
  }
}

async function patchAdminEmployee(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await getEmployeeById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }
    const { include_next_month, salary_apply_this_month, ...fields } =
      parsed.data;
    const updates = { ...fields };
    if (updates.workplace_id != null) {
      const workplace = await getWorkplaceById(updates.workplace_id);
      if (!workplace || workplace.is_active === false) {
        return res.status(400).json({
          success: false,
          error: "Invalid workplace_id",
        });
      }
    }
    if (updates.contract_kind === "cdi") {
      updates.contract_end_date = null;
    }
    if (include_next_month === true) {
      updates.payroll_eligible_from = resolvePayrollEligibleFrom({
        includeNextMonth: true,
      });
    } else if (include_next_month === false) {
      const currentMonthStart = firstOfCurrentMonthDouala();
      const existingFrom = existing.payroll_eligible_from
        ? String(existing.payroll_eligible_from).slice(0, 10)
        : null;
      // Only pull a deferred date back into the current month; never rewind older eligibility.
      if (existingFrom && existingFrom > currentMonthStart) {
        updates.payroll_eligible_from = currentMonthStart;
      }
    }

    const salaryProvided = Object.prototype.hasOwnProperty.call(
      fields,
      "salary_base"
    );
    if (salaryProvided && !salariesEqual(fields.salary_base, existing.salary_base)) {
      const effectiveFrom = resolveSalaryEffectiveFrom({
        applyThisMonth: salary_apply_this_month === true,
      });
      const currentMonthStart = firstOfCurrentMonthDouala();
      await replaceSalaryFrom({
        employee_id: id,
        amount: fields.salary_base ?? null,
        effective_from: effectiveFrom,
      });
      // Denormalized current-month amount only when the change covers this month.
      if (effectiveFrom > currentMonthStart) {
        delete updates.salary_base;
      }
    } else if (salaryProvided) {
      // Unchanged amount — keep denormalized column in sync if sent, no history rewrite.
    }

    const row = await updateEmployee(id, updates);
    return res.json({ success: true, data: stripFaceDescriptor(row) });
  } catch (err) {
    next(err);
  }
}

async function deleteAdminEmployee(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const existing = await getEmployeeById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }
    const row = await deleteEmployee(id);
    return res.json({ success: true, data: stripFaceDescriptor(row) });
  } catch (err) {
    next(err);
  }
}

async function enrollAdminEmployeeFace(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = enrollEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await getEmployeeById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }
    const row = await enrollEmployeeFace(id, parsed.data.face_descriptor);
    return res.json({ success: true, data: stripFaceDescriptor(row) });
  } catch (err) {
    next(err);
  }
}

async function verifyCheckinEmail(req, res, next) {
  try {
    const parsed = verifyEmailQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: CHECKIN_MESSAGES.EMAIL_INVALID,
        details: parsed.error.flatten(),
      });
    }

    const employee = await getEmployeeByEmailWithDescriptor(parsed.data.email);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: CHECKIN_MESSAGES.EMPLOYEE_NOT_FOUND,
      });
    }

    if (employee.is_active === false) {
      fireHrAlert({
        kind: "employee_inactive",
        email: employee.email,
        message: CHECKIN_MESSAGES.EMPLOYEE_INACTIVE,
        path: "/api/v1/hr/checkin/verify-email",
      });
      return res.status(400).json({
        success: false,
        error: "Inactive",
        message: CHECKIN_MESSAGES.EMPLOYEE_INACTIVE,
      });
    }

    // Non-blocking indicator: current règlement intérieur to read, if any.
    let regulation = null;
    try {
      regulation = await regulationStatusForEmployee(employee.id);
    } catch {
      /* indicator only — never block check-in */
    }

    return res.json({
      success: true,
      data: { ...publicEmployeeCheckinPayload(employee), regulation },
    });
  } catch (err) {
    next(err);
  }
}

async function publicSelfEnroll(req, res, next) {
  try {
    const parsed = enrollEmployeeSchema
      .extend({
        email: z.string().trim().email(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: CHECKIN_MESSAGES.VALIDATION_FAILED,
        details: parsed.error.flatten(),
      });
    }

    const { email, face_descriptor } = parsed.data;
    const employee = await getEmployeeByEmailWithDescriptor(email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: CHECKIN_MESSAGES.EMPLOYEE_NOT_FOUND,
      });
    }

    if (employee.is_active === false) {
      fireHrAlert({
        kind: "employee_inactive",
        email: employee.email,
        message: CHECKIN_MESSAGES.EMPLOYEE_INACTIVE,
        path: "/api/v1/hr/checkin/enroll",
      });
      return res.status(400).json({
        success: false,
        error: "Inactive",
        message: CHECKIN_MESSAGES.EMPLOYEE_INACTIVE,
      });
    }

    if (isEmployeeEnrolled(employee)) {
      return res.status(409).json({
        success: false,
        error: "Already enrolled",
        message: CHECKIN_MESSAGES.FACE_ALREADY_ENROLLED,
      });
    }

    const row = await enrollEmployeeFace(employee.id, face_descriptor);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: CHECKIN_MESSAGES.EMPLOYEE_NOT_FOUND,
      });
    }

    return res.json({
      success: true,
      message: CHECKIN_MESSAGES.FACE_ENROLLED_OK,
      data: publicEmployeeCheckinPayload({ ...row, is_enrolled: true }),
    });
  } catch (err) {
    next(err);
  }
}

async function publicCheckin(req, res, next) {
  try {
    const parsed = checkinBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: CHECKIN_MESSAGES.VALIDATION_FAILED,
        details: parsed.error.flatten(),
      });
    }

    const { email, face_descriptor, latitude, longitude } = parsed.data;
    const employee = await getEmployeeByEmailWithDescriptor(email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: CHECKIN_MESSAGES.EMPLOYEE_NOT_FOUND,
      });
    }

    if (employee.is_active === false) {
      fireHrAlert({
        kind: "employee_inactive",
        email: employee.email,
        message: CHECKIN_MESSAGES.EMPLOYEE_INACTIVE,
        path: "/api/v1/hr/checkin",
      });
      return res.status(400).json({
        success: false,
        error: "Inactive",
        message: CHECKIN_MESSAGES.EMPLOYEE_INACTIVE,
      });
    }

    const storedDescriptor = asDescriptorArray(employee.face_descriptor);
    if (!storedDescriptor || storedDescriptor.length !== 128) {
      fireHrAlert({
        kind: "face_not_enrolled",
        email: employee.email,
        message: CHECKIN_MESSAGES.FACE_NOT_ENROLLED,
        path: "/api/v1/hr/checkin",
      });
      return res.status(400).json({
        success: false,
        error: "Not enrolled",
        message: CHECKIN_MESSAGES.FACE_NOT_ENROLLED,
      });
    }

    if (!isFaceMatch(storedDescriptor, face_descriptor)) {
      fireHrAlert({
        kind: "face_mismatch",
        email: employee.email,
        message: CHECKIN_MESSAGES.FACE_MISMATCH,
        path: "/api/v1/hr/checkin",
      });
      return res.status(400).json({
        success: false,
        error: "Face mismatch",
        message: CHECKIN_MESSAGES.FACE_MISMATCH,
      });
    }

    if (!isWithinOffice(latitude, longitude)) {
      fireHrAlert({
        kind: "out_of_range",
        email: employee.email,
        message: CHECKIN_MESSAGES.OUT_OF_RANGE,
        detail: `lat=${latitude},lng=${longitude}`,
        path: "/api/v1/hr/checkin",
      });
      return res.status(400).json({
        success: false,
        error: "Out of range",
        message: CHECKIN_MESSAGES.OUT_OF_RANGE,
      });
    }

    const now = new Date();
    const status = getCheckInStatus(now);
    if (!status) {
      fireHrAlert({
        kind: "closed",
        email: employee.email,
        message: CHECKIN_MESSAGES.CLOSED,
        path: "/api/v1/hr/checkin",
      });
      return res.status(400).json({
        success: false,
        error: "Closed",
        message: CHECKIN_MESSAGES.CLOSED,
      });
    }

    const date = getDoualaDateString(now);
    const existingAttendance = await getAttendanceByEmployeeAndDate(employee.id, date);
    if (existingAttendance) {
      fireHrAlert({
        kind: "already_checked_in",
        email: employee.email,
        message: CHECKIN_MESSAGES.ALREADY_CHECKED_IN,
        path: "/api/v1/hr/checkin",
      });
      return res.status(409).json({
        success: false,
        error: "Already checked in",
        message: CHECKIN_MESSAGES.ALREADY_CHECKED_IN,
      });
    }

    let attendance;
    try {
      attendance = await createAttendance({
        employee_id: employee.id,
        date,
        check_in_time: now.toISOString(),
        status,
        face_verified: true,
        gps_verified: true,
        latitude,
        longitude,
      });
    } catch (err) {
      if (err && err.code === "23505") {
        fireHrAlert({
          kind: "already_checked_in",
          email: employee.email,
          message: CHECKIN_MESSAGES.ALREADY_CHECKED_IN,
          path: "/api/v1/hr/checkin",
        });
        return res.status(409).json({
          success: false,
          error: "Already checked in",
          message: CHECKIN_MESSAGES.ALREADY_CHECKED_IN,
        });
      }
      throw err;
    }

    return res.json({
      success: true,
      employee_name: employee.full_name,
      check_in_time: attendance.check_in_time,
      status: attendance.status,
      regulation: await regulationStatusForEmployee(employee.id).catch(
        () => null
      ),
    });
  } catch (err) {
    next(err);
  }
}

async function reportClientCheckinError(req, res, next) {
  try {
    const parsed = clientErrorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const { kind, email, message, user_agent, detail } = parsed.data;
    fireHrAlert({
      kind,
      email: email || undefined,
      message: message || kind,
      detail: [detail, user_agent ? `ua=${user_agent}` : null]
        .filter(Boolean)
        .join(" · "),
      path: "/api/v1/hr/checkin/client-error",
      ip: req.ip,
    });

    return res.status(202).json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function listAdminAttendances(req, res, next) {
  try {
    const parsed = listAttendancesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const rows = await listAttendances(parsed.data);
    return res.json({ success: true, data: stripFaceDescriptorList(rows) });
  } catch (err) {
    next(err);
  }
}

async function createAdminAttendance(req, res, next) {
  try {
    const parsed = manualAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { employee_id, date, status } = parsed.data;
    const employee = await getEmployeeById(employee_id);
    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }
    if (!employee.is_active) {
      return res.status(400).json({
        success: false,
        error: "Employee inactive",
        message: "Impossible de pointer un employé inactif",
      });
    }

    const row = await upsertAttendance({
      employee_id,
      date,
      check_in_time: status === "absent" ? null : new Date().toISOString(),
      status,
      face_verified: false,
      gps_verified: false,
      latitude: null,
      longitude: null,
    });

    return res.json({ success: true, data: stripFaceDescriptor(row) });
  } catch (err) {
    next(err);
  }
}

async function getAttendancesSummary(req, res, next) {
  try {
    const parsed = summaryAttendancesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { month, year } = parsed.data;
    const weekdaysElapsed = countWeekdaysElapsed(year, month);
    const rows = await summarizeAttendances({ month, year });
    const data = rows.map((row) => {
      const days_present = Number(row.days_present) || 0;
      const days_late = Number(row.days_late) || 0;
      return {
        employee_id: row.employee_id,
        full_name: row.full_name,
        email: row.email,
        poste: row.poste ?? null,
        days_present,
        days_late,
        days_absent: Math.max(0, weekdaysElapsed - days_present - days_late),
        weekdays_elapsed: weekdaysElapsed,
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** CNI recto/verso + plan de localisation — images servies à la demande. */
async function getAdminEmployeeDocuments(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid employee id" });
    }
    const docs = await getEmployeeDocuments(id);
    if (!docs) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }
    return res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
}

async function getEmployeePayslipPdf(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid employee id" });
    }

    const parsed = payslipQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { month, year, download } = parsed.data;

    const result = await buildEmployeePayslipPdf({
      employeeId: id,
      month,
      year,
      signerUserId: req.user?.userId ?? null,
    });
    if (!result.ok) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    // no-store: payslip content changes with attendance and settings — a
    // cached response would show stale amounts or branding.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${result.fileName}"`
    );
    return res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

async function sendEmployeePayslipWhatsapp(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid employee id" });
    }

    const parsed = payslipQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { month, year } = parsed.data;

    if (!isWhatsAppBotEnabled()) {
      return res.status(503).json({
        success: false,
        error: "whatsapp_disabled",
        message: "WhatsApp bot outbound is disabled",
      });
    }

    const employee = await getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const phone =
      employee.phone != null ? String(employee.phone).trim() : "";
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "phone_required",
        message: "Employee has no phone number",
      });
    }

    let downloadUrl;
    try {
      downloadUrl = createPayslipDownloadLink({
        employeeId: id,
        year,
        month,
      }).url;
    } catch (err) {
      return res.status(503).json({
        success: false,
        error: "payslip_link_config",
        message: err.message || "Payslip download link could not be created",
      });
    }

    const monthLabel = formatMonthLabelFr(year, month);
    // WhatsApp often does NOT auto-link raw http://IP:port URLs.
    // Send intro + URL as two separate bubbles (URL alone = best chance to linkify).
    // Prefer PUBLIC_API_BASE_URL with an https domain (e.g. cloudflared) for reliable taps.
    const introMessage = [
      "*Bulletin de paie*",
      "",
      `${employee.full_name} — ${monthLabel}`,
      "",
      "Téléchargez votre bulletin (valable 7 jours).",
      "Ouvrez le lien ci-dessous :",
    ].join("\n");

    try {
      await sendTextDm({
        recipientPhone: phone,
        message: introMessage,
      });
      const sent = await sendTextDm({
        recipientPhone: phone,
        message: downloadUrl,
      });
      const hostLooksLikeIp = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?\//i.test(
        downloadUrl
      );
      return res.json({
        success: true,
        data: {
          sent: true,
          channel: "whatsapp_link",
          recipient: sent.recipient || null,
          message_id: sent.messageId || null,
          download_url: downloadUrl,
          warning: hostLooksLikeIp
            ? "WhatsApp often does not make http://IP:port links tappable. Use an https domain (e.g. cloudflared tunnel) in PUBLIC_API_BASE_URL."
            : null,
        },
      });
    } catch (err) {
      if (err instanceof WhatsAppBotError) {
        const status =
          err.code === "config"
            ? 503
            : err.code === "unauthorized"
              ? 502
              : err.status && err.status >= 400 && err.status < 600
                ? err.status === 401
                  ? 502
                  : err.status
                : 502;
        return res.status(status).json({
          success: false,
          error: err.code || "whatsapp_send_failed",
          message: err.message,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function downloadPayslipByCode(req, res, next) {
  try {
    const code =
      (req.params.code != null ? String(req.params.code) : "") ||
      (req.query.token != null ? String(req.query.token) : "");
    const trimmed = code.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        error: "token_required",
        message: "Missing download code",
      });
    }

    const verified = resolvePayslipDownloadCode(trimmed);
    if (!verified.ok) {
      const status = verified.error === "expired" ? 410 : 403;
      return res.status(status).json({
        success: false,
        error: verified.error,
        message:
          verified.error === "expired"
            ? "This payslip link has expired"
            : "Invalid payslip download link",
      });
    }

    const result = await buildEmployeePayslipPdf({
      employeeId: verified.employeeId,
      month: verified.month,
      year: verified.year,
    });
    if (!result.ok) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    return res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

const createWorkplaceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  is_active: z.boolean().optional().default(true),
});

const patchWorkplaceSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  is_active: z.boolean().optional(),
});

async function listAdminWorkplaces(req, res, next) {
  try {
    const activeOnly = String(req.query.active || "") === "true";
    const rows = await listWorkplaces({ activeOnly });
    return res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function createAdminWorkplace(req, res, next) {
  try {
    const parsed = createWorkplaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const row = await createWorkplace(parsed.data);
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "A workplace with this name already exists",
      });
    }
    next(err);
  }
}

async function patchAdminWorkplace(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = patchWorkplaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const existing = await getWorkplaceById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Workplace not found" });
    }
    const row = await updateWorkplace(id, parsed.data);
    return res.json({ success: true, data: row });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "A workplace with this name already exists",
      });
    }
    next(err);
  }
}

async function deleteAdminWorkplace(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const row = await deleteWorkplace(id);
    if (!row) {
      return res.status(404).json({ success: false, error: "Workplace not found" });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdminEmployeeDocuments,
  listAdminEmployees,
  createAdminEmployee,
  patchAdminEmployee,
  deleteAdminEmployee,
  enrollAdminEmployeeFace,
  verifyCheckinEmail,
  publicSelfEnroll,
  publicCheckin,
  reportClientCheckinError,
  listAdminAttendances,
  createAdminAttendance,
  getAttendancesSummary,
  getEmployeePayslipPdf,
  sendEmployeePayslipWhatsapp,
  downloadPayslipByCode,
  downloadPayslipByToken: downloadPayslipByCode,
  listAdminWorkplaces,
  createAdminWorkplace,
  patchAdminWorkplace,
  deleteAdminWorkplace,
};
