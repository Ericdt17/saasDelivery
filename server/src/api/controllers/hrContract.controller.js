/**
 * HR employee contracts — generation, signing links, public e-signature.
 * super_admin endpoints + public /sign/:token flow (modeled on backend_core
 * merchant contracts).
 */

const { z } = require("zod");
const {
  getEmployeeById,
  getCompanySettings,
  getAgencyById,
  createHrContract,
  listHrContractsByEmployee,
  getHrContractById,
  getHrContractByToken,
  updateHrContract,
  cancelOpenHrContracts,
} = require("../../db");
const {
  CONSENT_TEXT,
  documentTypeConfig,
  documentTypeFromTemplateKey,
  loadSignPage,
  buildContractSnapshot,
  missingContractFields,
  buildContractHtml,
  buildSignedHtml,
  contractPdfOptions,
  isValidSignatureImage,
  sha256Hex,
  generateSignatureToken,
  signatureTokenExpiry,
  contractFileName,
} = require("../../lib/hrContract");
const { renderHtmlPdf } = require("../../lib/pdf/renderPayslipPdf");
const { getDoualaDateString } = require("../../lib/hrCheckin");
const { publicApiBaseUrl } = require("../../lib/payslipDownloadToken");
const {
  sendTextDm,
  WhatsAppBotError,
  isWhatsAppBotEnabled,
} = require("../../lib/whatsappBotClient");

const TOKEN_RE = /^[a-f0-9]{64}$/;

const signBodySchema = z.object({
  consent: z.literal(true),
  signature_image: z.string(),
});

const declineBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const generateBodySchema = z.object({
  type: z.enum(["contrat", "nda"]).optional().default("contrat"),
});

function parseSnapshot(contract) {
  const raw = contract?.snapshot;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function signingUrlFor(token) {
  return `${publicApiBaseUrl()}/api/v1/hr/sign/${token}`;
}

/** Admin-facing metadata: raw token replaced by the full signing URL. */
function contractMetadata(contract) {
  if (!contract) return null;
  const { signature_token, snapshot, document_html, document_pdf, signed_pdf,
    signature_image_base64, ...rest } = contract;
  return {
    ...rest,
    has_signed_document: contract.signed_document_sha256 != null,
    signing_url:
      signature_token && contract.status === "ready_for_signature"
        ? signingUrlFor(signature_token)
        : null,
  };
}

function publicSummary(contract) {
  const snapshot = parseSnapshot(contract);
  return {
    status: contract.status,
    document_title: documentTypeFromTemplateKey(contract.template_key).title,
    employee_name: snapshot.employee?.full_name || null,
    company_name:
      snapshot.company?.legal_name || snapshot.company?.company_name || "LivSight",
    contract_date: contract.contract_date,
    expires_at: contract.signature_token_expires_at,
    signed_at: contract.signed_at,
    declined_at: contract.declined_at,
  };
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first =
    typeof fwd === "string" && fwd.trim()
      ? fwd.split(",")[0].trim()
      : req.ip || req.socket?.remoteAddress || "";
  // Node reports IPv4 clients as IPv4-mapped IPv6 ("::ffff:1.2.3.4").
  return String(first).replace(/^::ffff:/i, "").slice(0, 64);
}

/**
 * Lookup by token; auto-expires stale ready_for_signature contracts.
 * @returns {Promise<{ ok: true, contract: object } | { ok: false, status: number, error: string }>}
 */
async function resolveContractByToken(token) {
  const key = String(token || "").trim().toLowerCase();
  if (!TOKEN_RE.test(key)) {
    return { ok: false, status: 404, error: "invalid_token" };
  }
  const contract = await getHrContractByToken(key);
  if (!contract) {
    return { ok: false, status: 404, error: "invalid_token" };
  }
  if (
    contract.status === "ready_for_signature" &&
    contract.signature_token_expires_at &&
    new Date(contract.signature_token_expires_at).getTime() < Date.now()
  ) {
    await updateHrContract(contract.id, {
      status: "expired",
      signature_token: null,
    });
    return { ok: false, status: 410, error: "expired" };
  }
  return { ok: true, contract };
}

// ---------------------------------------------------------------------------
// Admin endpoints (JWT + super_admin)
// ---------------------------------------------------------------------------

async function listEmployeeContracts(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid employee id" });
    }
    const rows = await listHrContractsByEmployee(id);
    return res.json({ success: true, data: rows.map(contractMetadata) });
  } catch (err) {
    next(err);
  }
}

async function generateEmployeeContract(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid employee id" });
    }
    const employee = await getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const parsedBody = generateBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, error: "Invalid document type" });
    }
    const type = parsedBody.data.type;
    const typeConfig = documentTypeConfig(type);

    const company = await getCompanySettings();
    // « Mon profil » of the generating admin — personal signature/stamp
    // override the company-wide ones in the employer block (like payslips).
    let signer = null;
    if (req.user?.userId != null) {
      try {
        const profile = await getAgencyById(req.user.userId);
        if (profile) {
          signer = {
            name: profile.name,
            fonction: profile.fonction,
            signature_base64: profile.signature_base64,
            stamp_base64: profile.stamp_base64,
          };
        }
      } catch {
        /* profile stamp is optional — fall back to company settings */
      }
    }
    const contractDate = getDoualaDateString(new Date());
    const snapshot = buildContractSnapshot({ employee, company, contractDate, type, signer });

    const missing = missingContractFields(snapshot.employee, type);
    if (missing.length) {
      return res.status(422).json({
        success: false,
        error: "missing_fields",
        message: "Des champs requis pour le contrat sont manquants sur l'employé",
        missing,
      });
    }

    const documentHtml = buildContractHtml(snapshot);
    const pdf = await renderHtmlPdf(documentHtml, contractPdfOptions(snapshot.company));
    const fileName = contractFileName(employee, contractDate, type);

    // Only supersede open documents of the SAME type (an open work contract
    // must survive generating an NDA, and vice versa).
    await cancelOpenHrContracts(id, typeConfig.templateKey);
    const contract = await createHrContract({
      employee_id: id,
      template_key: typeConfig.templateKey,
      contract_date: contractDate,
      snapshot,
      document_html: documentHtml,
      document_pdf: pdf,
      document_file_name: fileName,
      document_sha256: sha256Hex(pdf),
    });

    return res.status(201).json({ success: true, data: contractMetadata(contract) });
  } catch (err) {
    next(err);
  }
}

async function getAdminContract(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid contract id" });
    }
    const contract = await getHrContractById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }
    return res.json({ success: true, data: contractMetadata(contract) });
  } catch (err) {
    next(err);
  }
}

async function getAdminContractDocument(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid contract id" });
    }
    const contract = await getHrContractById(id, { withDocuments: true });
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }
    const buffer = contract.signed_pdf || contract.document_pdf;
    if (!buffer) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }
    const download = String(req.query.download || "") === "true";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${contract.document_file_name}"`
    );
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

/** Issue (or re-issue) the single-use signing token. */
async function issueSigningToken(contract) {
  const token = generateSignatureToken();
  const updated = await updateHrContract(contract.id, {
    status: "ready_for_signature",
    ready_for_signature_at: new Date(),
    signature_token: token,
    signature_token_expires_at: signatureTokenExpiry(),
    declined_at: null,
    decline_reason: null,
  });
  return { updated, token };
}

const READYABLE_STATUSES = new Set([
  "generated",
  "ready_for_signature",
  "declined",
  "expired",
]);

async function readyContractForSignature(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid contract id" });
    }
    const contract = await getHrContractById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }
    if (!READYABLE_STATUSES.has(contract.status)) {
      return res.status(409).json({
        success: false,
        error: "invalid_status",
        message: `Contract is ${contract.status}`,
      });
    }
    const { updated, token } = await issueSigningToken(contract);
    return res.json({
      success: true,
      data: {
        ...contractMetadata(updated),
        signing_url: signingUrlFor(token),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function sendContractWhatsapp(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid contract id" });
    }
    if (!isWhatsAppBotEnabled()) {
      return res.status(503).json({
        success: false,
        error: "whatsapp_disabled",
        message: "WhatsApp bot outbound is disabled",
      });
    }
    let contract = await getHrContractById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }
    if (!READYABLE_STATUSES.has(contract.status)) {
      return res.status(409).json({
        success: false,
        error: "invalid_status",
        message: `Contract is ${contract.status}`,
      });
    }
    const employee = await getEmployeeById(contract.employee_id);
    const phone = employee?.phone != null ? String(employee.phone).trim() : "";
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "phone_required",
        message: "Employee has no phone number",
      });
    }

    const { updated, token } = await issueSigningToken(contract);
    contract = updated;
    const signingUrl = signingUrlFor(token);

    const docTitle = documentTypeFromTemplateKey(contract.template_key).title;
    const introMessage = [
      `*${docTitle}*`,
      "",
      `${employee.full_name} — LivSight`,
      "",
      `Votre document « ${docTitle} » est prêt à être signé (lien valable 30 jours).`,
      "Lisez-le attentivement puis signez via le lien ci-dessous :",
    ].join("\n");

    try {
      await sendTextDm({ recipientPhone: phone, message: introMessage });
      const sent = await sendTextDm({ recipientPhone: phone, message: signingUrl });
      const hostLooksLikeIp = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?\//i.test(
        signingUrl
      );
      return res.json({
        success: true,
        data: {
          sent: true,
          channel: "whatsapp_link",
          recipient: sent.recipient || null,
          message_id: sent.messageId || null,
          signing_url: signingUrl,
          contract: contractMetadata(contract),
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

async function cancelContract(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, error: "Invalid contract id" });
    }
    const contract = await getHrContractById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: "Contract not found" });
    }
    if (!["generated", "ready_for_signature", "declined", "expired"].includes(contract.status)) {
      return res.status(409).json({
        success: false,
        error: "invalid_status",
        message: `Contract is ${contract.status}`,
      });
    }
    const updated = await updateHrContract(id, {
      status: "cancelled",
      signature_token: null,
    });
    return res.json({ success: true, data: contractMetadata(updated) });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public signing endpoints (no auth, rate-limited)
// ---------------------------------------------------------------------------

async function getContractSignPage(req, res, next) {
  try {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Helmet's default CSP (script-src 'self') would block this standalone
    // page's inline script — relax it for this public page only.
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'"
    );
    return res.send(loadSignPage());
  } catch (err) {
    next(err);
  }
}

async function getContractSignSummary(req, res, next) {
  try {
    const resolved = await resolveContractByToken(req.params.token);
    if (!resolved.ok) {
      return res
        .status(resolved.status)
        .json({ success: false, error: resolved.error });
    }
    return res.json({ success: true, data: publicSummary(resolved.contract) });
  } catch (err) {
    next(err);
  }
}

async function getContractSignDocument(req, res, next) {
  try {
    const resolved = await resolveContractByToken(req.params.token);
    if (!resolved.ok) {
      return res
        .status(resolved.status)
        .json({ success: false, error: resolved.error });
    }
    const contract = resolved.contract;
    const buffer = contract.signed_pdf || contract.document_pdf;
    if (!buffer) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${contract.document_file_name}"`
    );
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

async function signContractByToken(req, res, next) {
  try {
    const resolved = await resolveContractByToken(req.params.token);
    if (!resolved.ok) {
      return res
        .status(resolved.status)
        .json({ success: false, error: resolved.error });
    }
    const contract = resolved.contract;
    if (contract.status !== "ready_for_signature") {
      return res.status(409).json({
        success: false,
        error: "invalid_status",
        message: `Contract is ${contract.status}`,
      });
    }

    const parsed = signBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "consent_required",
        message: "La mention « Lu et approuvé » et la signature sont requises",
      });
    }
    if (!isValidSignatureImage(parsed.data.signature_image)) {
      return res.status(400).json({
        success: false,
        error: "invalid_signature_image",
        message: "Signature invalide — dessinez votre signature puis réessayez",
      });
    }

    const snapshot = parseSnapshot(contract);
    const signedAt = new Date();
    const signedHtml = buildSignedHtml({
      documentHtml: contract.document_html,
      signatureImage: parsed.data.signature_image,
      attestation: {
        contractId: contract.id,
        contractTitle: documentTypeFromTemplateKey(contract.template_key).title,
        companyLegalName:
          snapshot.company?.legal_name || snapshot.company?.company_name || "LivSight",
        employeeName: snapshot.employee?.full_name || "",
        employeePhone: snapshot.employee?.phone || "",
        signedAt,
        ip: clientIp(req),
        documentSha256: contract.document_sha256,
      },
    });
    const signedPdf = await renderHtmlPdf(signedHtml, contractPdfOptions(snapshot.company));

    // The token is kept on purpose: signing is blocked by the status check,
    // but the employee's link keeps working to view/download the signed PDF.
    const updated = await updateHrContract(contract.id, {
      status: "signed",
      signed_at: signedAt,
      signature_consent: CONSENT_TEXT,
      signature_ip: clientIp(req),
      signature_user_agent: String(req.headers["user-agent"] || "").slice(0, 255),
      signature_image_base64: parsed.data.signature_image,
      signed_pdf: signedPdf,
      signed_document_sha256: sha256Hex(signedPdf),
    });

    return res.json({ success: true, data: publicSummary({ ...updated, snapshot: contract.snapshot }) });
  } catch (err) {
    next(err);
  }
}

async function declineContractByToken(req, res, next) {
  try {
    const resolved = await resolveContractByToken(req.params.token);
    if (!resolved.ok) {
      return res
        .status(resolved.status)
        .json({ success: false, error: resolved.error });
    }
    const contract = resolved.contract;
    if (contract.status !== "ready_for_signature") {
      return res.status(409).json({
        success: false,
        error: "invalid_status",
        message: `Contract is ${contract.status}`,
      });
    }
    const parsed = declineBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "reason_required",
        message: "Le motif du refus est requis",
      });
    }
    // Token kept so the link shows the declined state instead of a 404;
    // re-sending for signature rotates it anyway.
    const updated = await updateHrContract(contract.id, {
      status: "declined",
      declined_at: new Date(),
      decline_reason: parsed.data.reason,
    });
    return res.json({ success: true, data: publicSummary({ ...updated, snapshot: contract.snapshot }) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEmployeeContracts,
  generateEmployeeContract,
  getAdminContract,
  getAdminContractDocument,
  readyContractForSignature,
  sendContractWhatsapp,
  cancelContract,
  getContractSignPage,
  getContractSignSummary,
  getContractSignDocument,
  signContractByToken,
  declineContractByToken,
};
