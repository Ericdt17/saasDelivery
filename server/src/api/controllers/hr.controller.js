/**
 * HR employees API — roster + face enrollment (super_admin)
 * + public check-in (no auth)
 */

const { z } = require("zod");
const {
  listEmployees,
  getEmployeeById,
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
} = require("../../db");
const {
  isWithinOffice,
  isFaceMatch,
  getCheckInStatus,
  getDoualaDateString,
  countWeekdaysElapsed,
} = require("../../lib/hrCheckin");
const { CHECKIN_MESSAGES } = require("../../lib/hrCheckinMessages");
const { notifyHrCheckinAlert } = require("../../lib/botAlerts");

const createEmployeeSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1).nullable().optional(),
  poste: z.string().trim().min(1).nullable().optional(),
  salary_base: z.number().int().nullable().optional(),
});

const patchEmployeeSchema = createEmployeeSchema
  .partial()
  .extend({
    is_active: z.boolean().optional(),
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

const manualAttendanceSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "late"]),
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
    const rows = await listEmployees();
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
    const row = await createEmployee(parsed.data);
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
    const row = await updateEmployee(id, parsed.data);
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

    if (!isEmployeeEnrolled(employee)) {
      return res.json({
        success: true,
        data: {
          full_name: employee.full_name,
          email: employee.email,
          is_enrolled: false,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        full_name: employee.full_name,
        email: employee.email,
        is_enrolled: true,
      },
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
      data: {
        full_name: row.full_name,
        email: row.email,
        is_enrolled: true,
      },
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
      check_in_time: new Date().toISOString(),
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

module.exports = {
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
};
