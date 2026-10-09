/**
 * Company documents (règlement intérieur) — versioned, employee-acknowledged.
 * Admin CRUD (super_admin) + public employee reading/acknowledgement flow
 * (email-identified like check-in — employees have no dashboard login).
 *
 * "Not read" is derived: active employee without an acknowledgement row for
 * the CURRENT published version. Published versions are immutable history.
 */

const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const {
  listCompanyDocuments,
  getCompanyDocumentById,
  createCompanyDocument,
  listCompanyDocumentVersions,
  getCompanyDocumentVersionById,
  createCompanyDocumentVersion,
  updateCompanyDocumentVersionContent,
  publishCompanyDocumentVersion,
  getCurrentCompanyDocument,
  acknowledgeCompanyDocumentVersion,
  getCompanyDocumentAcknowledgement,
  listCompanyDocumentReadStatus,
  getEmployeeByEmailWithDescriptor,
} = require("../../db");
const { renderMarkdown } = require("../../lib/hrMarkdown");
const { publicApiBaseUrl } = require("../../lib/payslipDownloadToken");

const REGULATION_PAGE_PATH = path.join(
  __dirname,
  "../../templates/regulation-page.html"
);

const ACKNOWLEDGEMENT_TEXT =
  "Je reconnais avoir reçu ou avoir eu accès au règlement intérieur de LivSight et en avoir pris connaissance. " +
  "Je reconnais avoir été informé(e) de mon obligation de respecter les dispositions et procédures applicables dans le cadre de mes fonctions.";

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().trim().max(2000).nullable().optional()
  ),
  doc_type: z
    .enum(["internal_regulation", "procedure", "policy"])
    .optional()
    .default("internal_regulation"),
});

const createVersionSchema = z.object({
  /** Copy content from this version (defaults to the latest version). */
  from_version_id: z.number().int().positive().nullable().optional(),
});

const updateVersionSchema = z.object({
  content_md: z.string().max(200_000),
});

const acknowledgeSchema = z.object({
  email: z.string().trim().email(),
  version_id: z.number().int().positive(),
});

function versionLabel(versionNumber) {
  return `V${versionNumber}.0`;
}

function slugify(title) {
  return (
    String(title)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "document"
  );
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first =
    typeof fwd === "string" && fwd.trim()
      ? fwd.split(",")[0].trim()
      : req.ip || req.socket?.remoteAddress || "";
  return String(first).replace(/^::ffff:/i, "").slice(0, 64);
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Regulation status for a check-in employee — used to decorate the
 * verify-email / check-in responses with the "à consulter" indicator.
 * @returns {Promise<{ to_read: boolean, version_label: string, url: string } | null>}
 */
async function regulationStatusForEmployee(employeeId) {
  const current = await getCurrentCompanyDocument("internal_regulation");
  if (!current) return null;
  const ack = await getCompanyDocumentAcknowledgement(
    current.version_id,
    employeeId
  );
  return {
    to_read: !ack,
    version_label: versionLabel(current.version_number),
    url: `${publicApiBaseUrl()}/api/v1/hr/reglement`,
  };
}

// ---------------------------------------------------------------------------
// Admin endpoints (JWT + super_admin)
// ---------------------------------------------------------------------------

async function listAdminRegulations(req, res, next) {
  try {
    const docs = await listCompanyDocuments();
    const data = [];
    for (const doc of docs) {
      let stats = null;
      if (doc.current_version_id) {
        const rows = await listCompanyDocumentReadStatus(doc.current_version_id);
        const read = rows.filter((r) => r.acknowledged_at != null).length;
        stats = {
          total_active_employees: rows.length,
          read,
          not_read: rows.length - read,
        };
      }
      data.push({
        ...doc,
        current_version_label:
          doc.current_version_number != null
            ? versionLabel(doc.current_version_number)
            : null,
        stats,
      });
    }
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createAdminRegulation(req, res, next) {
  try {
    const parsed = createDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const { title, description, doc_type } = parsed.data;
    const doc = await createCompanyDocument({
      doc_type,
      title,
      slug: slugify(title),
      description,
      created_by: req.user?.userId ?? null,
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "duplicate",
        message: "Un document avec ce titre existe déjà",
      });
    }
    next(err);
  }
}

async function getAdminRegulation(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const doc = await getCompanyDocumentById(id);
    if (!doc) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }
    const versions = await listCompanyDocumentVersions(id);
    return res.json({
      success: true,
      data: {
        ...doc,
        current_version_label:
          doc.current_version_number != null
            ? versionLabel(doc.current_version_number)
            : null,
        versions: versions.map((v) => ({
          ...v,
          version_label: versionLabel(v.version_number),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createAdminRegulationVersion(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const doc = await getCompanyDocumentById(id);
    if (!doc) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }
    const parsed = createVersionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    const versions = await listCompanyDocumentVersions(id);
    if (versions.some((v) => v.status === "draft")) {
      return res.status(409).json({
        success: false,
        error: "draft_exists",
        message:
          "Un brouillon existe déjà — modifiez-le ou publiez-le avant d'en créer un autre",
      });
    }

    // Seed content from an existing version (default: the most recent one).
    let content = "";
    const fromId = parsed.data.from_version_id ?? versions[0]?.id ?? null;
    if (fromId) {
      const source = await getCompanyDocumentVersionById(fromId);
      if (!source || source.document_id !== id) {
        return res.status(400).json({
          success: false,
          error: "invalid_source_version",
        });
      }
      content = source.content_md || "";
    }

    const version = await createCompanyDocumentVersion({
      document_id: id,
      content_md: content,
      created_by: req.user?.userId ?? null,
    });
    return res.status(201).json({
      success: true,
      data: { ...version, version_label: versionLabel(version.version_number) },
    });
  } catch (err) {
    next(err);
  }
}

async function getAdminRegulationVersion(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const version = await getCompanyDocumentVersionById(id);
    if (!version) {
      return res.status(404).json({ success: false, error: "Version not found" });
    }
    return res.json({
      success: true,
      data: {
        ...version,
        version_label: versionLabel(version.version_number),
        content_html: renderMarkdown(version.content_md),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateAdminRegulationVersion(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const parsed = updateVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const version = await getCompanyDocumentVersionById(id);
    if (!version) {
      return res.status(404).json({ success: false, error: "Version not found" });
    }
    if (version.status !== "draft") {
      // Published versions are immutable history — never edited in place.
      return res.status(409).json({
        success: false,
        error: "not_draft",
        message:
          "Cette version est publiée — créez une nouvelle version pour la modifier",
      });
    }
    const updated = await updateCompanyDocumentVersionContent(
      id,
      parsed.data.content_md
    );
    return res.json({
      success: true,
      data: { ...updated, version_label: versionLabel(updated.version_number) },
    });
  } catch (err) {
    next(err);
  }
}

async function publishAdminRegulationVersion(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const version = await getCompanyDocumentVersionById(id);
    if (!version) {
      return res.status(404).json({ success: false, error: "Version not found" });
    }
    if (version.status !== "draft") {
      return res.status(409).json({
        success: false,
        error: "not_draft",
        message: `La version est ${version.status}`,
      });
    }
    const published = await publishCompanyDocumentVersion(
      id,
      req.user?.userId ?? null
    );
    if (!published) {
      return res.status(409).json({ success: false, error: "not_draft" });
    }
    return res.json({
      success: true,
      data: {
        ...published,
        version_label: versionLabel(published.version_number),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getAdminRegulationAcknowledgements(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid id" });
    }
    const doc = await getCompanyDocumentById(id);
    if (!doc) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }
    if (!doc.current_version_id) {
      return res.json({
        success: true,
        data: { version: null, stats: null, employees: [] },
      });
    }
    const filter = String(req.query.status || "all");
    const rows = await listCompanyDocumentReadStatus(doc.current_version_id);
    const read = rows.filter((r) => r.acknowledged_at != null).length;
    const total = rows.length;
    const employees = rows
      .map((r) => ({
        employee_id: r.employee_id,
        full_name: r.full_name,
        poste: r.poste,
        status: r.acknowledged_at != null ? "read" : "not_read",
        acknowledged_at: r.acknowledged_at,
      }))
      .filter((r) =>
        filter === "read"
          ? r.status === "read"
          : filter === "not_read"
            ? r.status === "not_read"
            : true
      );
    return res.json({
      success: true,
      data: {
        version: {
          id: doc.current_version_id,
          version_label: versionLabel(doc.current_version_number),
          published_at: doc.current_version_published_at,
        },
        stats: {
          total_active_employees: total,
          read,
          not_read: total - read,
          completion_pct: total > 0 ? Math.round((read / total) * 1000) / 10 : 0,
        },
        employees,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public employee endpoints (no auth — email-identified, rate limited)
// ---------------------------------------------------------------------------

async function getRegulationPage(req, res, next) {
  try {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Same CSP relaxation as the contract signing page (inline script).
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'"
    );
    return res.send(fs.readFileSync(REGULATION_PAGE_PATH, "utf8"));
  } catch (err) {
    next(err);
  }
}

async function resolveActiveEmployeeByEmail(email) {
  const employee = await getEmployeeByEmailWithDescriptor(email);
  if (!employee || employee.is_active === false) return null;
  return employee;
}

async function getCurrentRegulationForEmployee(req, res, next) {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "email_required" });
    }
    const employee = await resolveActiveEmployeeByEmail(email);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "employee_not_found",
        message: "Aucun employé actif avec cet email",
      });
    }
    const current = await getCurrentCompanyDocument("internal_regulation");
    if (!current) {
      return res.status(404).json({
        success: false,
        error: "no_published_regulation",
        message: "Aucun règlement intérieur publié pour le moment",
      });
    }
    const ack = await getCompanyDocumentAcknowledgement(
      current.version_id,
      employee.id
    );
    return res.json({
      success: true,
      data: {
        employee_name: employee.full_name,
        title: current.title,
        version_id: current.version_id,
        version_label: versionLabel(current.version_number),
        published_at: current.published_at,
        content_html: renderMarkdown(current.content_md),
        acknowledgement_text: ACKNOWLEDGEMENT_TEXT,
        acknowledged: Boolean(ack),
        acknowledged_at: ack?.acknowledged_at ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function acknowledgeRegulation(req, res, next) {
  try {
    const parsed = acknowledgeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const employee = await resolveActiveEmployeeByEmail(parsed.data.email);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "employee_not_found",
        message: "Aucun employé actif avec cet email",
      });
    }
    const current = await getCurrentCompanyDocument("internal_regulation");
    if (!current) {
      return res
        .status(404)
        .json({ success: false, error: "no_published_regulation" });
    }
    // The acknowledgement always targets one EXACT version; reject if the
    // page was loaded before a newer version was published.
    if (current.version_id !== parsed.data.version_id) {
      return res.status(409).json({
        success: false,
        error: "version_outdated",
        message:
          "Une nouvelle version du règlement a été publiée — rechargez la page",
      });
    }
    const ack = await acknowledgeCompanyDocumentVersion({
      version_id: current.version_id,
      employee_id: employee.id,
      ip_address: clientIp(req),
      user_agent: String(req.headers["user-agent"] || "").slice(0, 255) || null,
    });
    return res.json({
      success: true,
      data: {
        acknowledged: true,
        already_acknowledged: ack?.already_acknowledged ?? false,
        acknowledged_at: ack?.acknowledged_at ?? null,
        version_label: versionLabel(current.version_number),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAdminRegulations,
  createAdminRegulation,
  getAdminRegulation,
  createAdminRegulationVersion,
  getAdminRegulationVersion,
  updateAdminRegulationVersion,
  publishAdminRegulationVersion,
  getAdminRegulationAcknowledgements,
  getRegulationPage,
  getCurrentRegulationForEmployee,
  acknowledgeRegulation,
  regulationStatusForEmployee,
  ACKNOWLEDGEMENT_TEXT,
};
