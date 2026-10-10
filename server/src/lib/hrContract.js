"use strict";

/**
 * HR employee contract — snapshot, placeholder resolution, signing helpers.
 * Modeled on backend_core merchant contracts; rendering reuses the payslip
 * Puppeteer pipeline (renderHtmlPdf).
 *
 * Template: server/src/templates/contract.html ({{key}} placeholders, read
 * from disk on every generation so edits apply without restart).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { renderMarkdown } = require("./hrMarkdown");

const TEMPLATE_KEY = "contrat_travail_v1";

/**
 * Signable HR document types. Each freezes its template_key on the contract
 * row; required fields gate generation (422 with the missing list).
 */
const DOCUMENT_TYPES = {
  contrat: {
    templateKey: "contrat_travail_v1",
    title: "Contrat de travail",
    fileNamePrefix: "Contrat-travail",
    templateFile: "contract.html",
    requiredFields: [
      "full_name",
      "date_of_birth",
      "place_of_birth",
      "nationality",
      "national_id",
      "address",
      "phone",
      "poste",
      "employee_type",
      "contract_kind",
      "contract_start_date",
      "trial_period_days",
      "mission_description",
      "workplace_name",
      "work_schedule",
      "salary_base",
    ],
    cddNeedsEndDate: true,
  },
  nda: {
    templateKey: "nda_v1",
    title: "Accord de confidentialité (NDA)",
    fileNamePrefix: "NDA",
    templateFile: "nda.html",
    requiredFields: [
      "full_name",
      "date_of_birth",
      "place_of_birth",
      "nationality",
      "national_id",
      "address",
      "poste",
    ],
    cddNeedsEndDate: false,
  },
};

function documentTypeConfig(type) {
  return DOCUMENT_TYPES[type] || null;
}

function documentTypeFromTemplateKey(templateKey) {
  return (
    Object.values(DOCUMENT_TYPES).find((t) => t.templateKey === templateKey) ||
    DOCUMENT_TYPES.contrat
  );
}

const CONTRACT_TEMPLATE_PATH = path.join(__dirname, "../templates/contract.html");
const ATTESTATION_TEMPLATE_PATH = path.join(
  __dirname,
  "../templates/contract-attestation.html"
);
const SIGN_PAGE_PATH = path.join(
  __dirname,
  "../templates/contract-sign-page.html"
);

const SIGNING_LINK_VALIDITY_DAYS = 30;
const SIGNATURE_SLOT = '<span id="employee-signature-slot"></span>';
const CONSENT_TEXT = "Lu et approuvé";
const LOGO_PATH = path.join(__dirname, "../templates/livsight-logo-header.jpeg");

let logoDataUriCache = null;
function logoDataUri() {
  if (logoDataUriCache == null) {
    try {
      logoDataUriCache = `data:image/jpeg;base64,${fs
        .readFileSync(LOGO_PATH)
        .toString("base64")}`;
    } catch {
      logoDataUriCache = "";
    }
  }
  return logoDataUriCache;
}

/**
 * Puppeteer PDF options reproducing the Word template's running header
 * (centered LivSight logo) and footer (company lines, blue/gray).
 * Footer company data comes from the frozen snapshot's company settings.
 * @param {object} [company] snapshot.company (super-admin settings)
 */
function contractPdfOptions(company = {}) {
  const logo = logoDataUri();
  const esc = escapeHtml;
  const legalName = esc(companyField(company, "legal_name"));
  const address = esc(companyField(company, "address"));
  const phone = esc(companyField(company, "phone"));
  const email = esc(companyField(company, "email"));
  const rccm = esc(companyField(company, "trade_register"));
  // Word: header 12.5mm from the top, logo ~70.6 × 23.5 mm, blue rule under
  // the logo (1.5pt #1A96D4) and above the footer (1pt) spanning the column.
  const headerTemplate = `
    <div style="box-sizing:border-box; width:100%; padding: 10mm 25mm 0; margin:0;">
      <div style="text-align:center; border-bottom: 1.5pt solid #1A96D4; padding-bottom: 1.5mm;">
        ${logo ? `<img src="${logo}" style="height:23.5mm;" />` : ""}
      </div>
    </div>`;
  const footerTemplate = `
    <div style="box-sizing:border-box; width:100%; padding: 0 25mm; margin: 0 0 3mm;">
      <div style="font-family: Helvetica, Arial, sans-serif; font-size:7pt; line-height:1.55; text-align:center; color:#595959; border-top: 1pt solid #1A96D4; padding-top: 1.5mm;">
        <div><span style="color:#1A96D4; font-weight:bold;">${legalName}</span> &middot; ${address}</div>
        <div>Tel: ${phone} &middot; <span style="color:#1A96D4;">${email}</span> &middot; <span style="color:#1A96D4;">www.livsight.com</span></div>
        <div style="color:#1A96D4;">RCCM: ${rccm}</div>
      </div>
    </div>`;
  // Word pgMar: 25mm all around; top grows to fit the 23.5mm-tall header.
  return {
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: "41mm", right: "25mm", bottom: "26mm", left: "25mm" },
  };
}

/** Keys whose values are injected as raw HTML (images/CSS); all others escaped. */
const RAW_KEYS = new Set([
  "employee.signature",
  "company.signature",
  "company.stamp",
  "fonts.css",
  // Rendered via renderMarkdown (escape-first — XSS-safe)
  "mission_description_html",
]);

const FONTS_DIR = path.join(__dirname, "../templates/fonts");
const FONT_FACES = [
  { file: "Aptos.ttf", family: "Aptos", weight: 400 },
  { file: "Aptos-Bold.ttf", family: "Aptos", weight: 700 },
  { file: "Aptos-Display-Bold.ttf", family: "Aptos Display", weight: 700 },
];

let fontFaceCssCache = null;
/**
 * @font-face rules with the Aptos TTFs embedded as data URIs, so the frozen
 * document_html renders identically on any machine (no OS font needed).
 */
function fontFaceCss() {
  if (fontFaceCssCache == null) {
    fontFaceCssCache = FONT_FACES.map(({ file, family, weight }) => {
      try {
        const data = fs.readFileSync(path.join(FONTS_DIR, file)).toString("base64");
        return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url(data:font/ttf;base64,${data}) format("truetype"); }`;
      } catch {
        return "";
      }
    }).join("\n");
  }
  return fontFaceCssCache;
}

function loadContractTemplate(templateFile = "contract.html") {
  return fs.readFileSync(path.join(__dirname, "../templates", templateFile), "utf8");
}

function loadAttestationTemplate() {
  return fs.readFileSync(ATTESTATION_TEMPLATE_PATH, "utf8");
}

function loadSignPage() {
  return fs.readFileSync(SIGN_PAGE_PATH, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace {{key}} / {{dotted.key}} placeholders. Values are HTML-escaped
 * except RAW_KEYS. Unknown or null keys resolve to ''.
 * @param {string} html
 * @param {Record<string, string|number|null|undefined>} values
 */
function fillContractTemplate(html, values) {
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const raw = values[key];
    if (raw == null) return "";
    const str = String(raw);
    return RAW_KEYS.has(key) ? str : escapeHtml(str);
  });
}

/** dd/MM/yyyy from a pg DATE (JS Date at local midnight) or 'YYYY-MM-DD'. */
function formatDateFr(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${value.getFullYear()}`;
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(value);
}

/** "dd/MM/yyyy à HH:mm" in Africa/Douala. */
function formatDateTimeFr(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Douala",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("day")}/${get("month")}/${get("year")} à ${get("hour")}:${get("minute")}`;
}

function formatAmountFr(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat("fr-FR").format(Math.round(Number(value)));
}

const EMPLOYEE_TYPE_LABELS = { livreur: "Livreur", agent: "Agent" };

function toIsoDateString(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${m}-${d}`;
  }
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(value);
}

/**
 * Freeze employee + company data used by the contract (raw values; display
 * formatting happens in buildContractValues). Immutable after generation.
 * @param {{ employee: object, company: object|null, contractDate: string }} input
 */
function buildContractSnapshot({ employee, company, contractDate, type = "contrat" }) {
  const c = company || {};
  const cfg = documentTypeConfig(type) || DOCUMENT_TYPES.contrat;
  return {
    template_key: cfg.templateKey,
    contract_date: contractDate,
    employee: {
      id: employee.id,
      full_name: employee.full_name ?? null,
      email: employee.email ?? null,
      personal_email: employee.personal_email ?? null,
      phone: employee.phone ?? null,
      employee_type: employee.employee_type ?? null,
      poste: employee.poste ?? null,
      salary_base: employee.salary_base ?? null,
      date_of_birth: toIsoDateString(employee.date_of_birth),
      place_of_birth: employee.place_of_birth ?? null,
      gender: employee.gender ?? null,
      nationality: employee.nationality ?? null,
      national_id: employee.national_id ?? null,
      address: employee.address ?? null,
      workplace_name: employee.workplace_name ?? null,
      emergency_contact_name: employee.emergency_contact_name ?? null,
      emergency_contact_phone: employee.emergency_contact_phone ?? null,
      emergency_contact_relation: employee.emergency_contact_relation ?? null,
      contract_kind: employee.contract_kind ?? null,
      trial_period_days: employee.trial_period_days ?? null,
      contract_start_date: toIsoDateString(employee.contract_start_date),
      contract_end_date: toIsoDateString(employee.contract_end_date),
      mission_description: employee.mission_description ?? null,
      work_schedule: employee.work_schedule ?? null,
    },
    company: {
      company_name: c.company_name ?? null,
      legal_name: c.legal_name ?? null,
      tax_id: c.tax_id ?? null,
      trade_register: c.trade_register ?? null,
      address: c.address ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      signer_name: c.signer_name ?? null,
      signer_role: c.signer_role ?? null,
      signature_base64: c.signature_base64 ?? null,
      stamp_base64: c.stamp_base64 ?? null,
    },
  };
}

/**
 * Fields the contract template interpolates — generation is blocked until
 * they are all filled on the employee (contract_end_date only for CDD).
 * @param {object} snapshotEmployee
 * @returns {string[]} missing field names
 */
function missingContractFields(snapshotEmployee, type = "contrat") {
  const e = snapshotEmployee;
  const cfg = documentTypeConfig(type) || DOCUMENT_TYPES.contrat;
  const missing = cfg.requiredFields.filter((key) => {
    const v = e[key];
    return v == null || String(v).trim() === "";
  });
  if (cfg.cddNeedsEndDate && e.contract_kind === "cdd") {
    const v = e.contract_end_date;
    if (v == null || String(v).trim() === "") missing.push("contract_end_date");
  }
  return missing;
}

/** Used when the super-admin company settings leave a field empty. */
const COMPANY_FALLBACKS = {
  legal_name: "LIVSIGHT SARL",
  trade_register: "CM-NSI-02-2026-B12-00874",
  tax_id: "M092618972421M",
  address: "Immeuble de la Lekie, Hippodrome, Yaoundé, Cameroon",
  phone: "+237 658 478 764",
  email: "contact@livsight.com",
  signer_name: "M. Djou Tousse Eric",
  signer_role: "Gérant",
};

function companyField(company, key) {
  const v = company?.[key];
  return v != null && String(v).trim() ? String(v).trim() : COMPANY_FALLBACKS[key];
}

function imageTag(base64, alt) {
  if (!base64 || !String(base64).trim()) return "";
  const data = String(base64).trim();
  const src = data.startsWith("data:") ? data : `data:image/png;base64,${data}`;
  return `<img src="${src}" alt="${escapeHtml(alt)}" />`;
}

/**
 * Template placeholder values from a frozen snapshot. The employee signature
 * resolves to an empty slot marker — filled at signing time.
 * @param {object} snapshot
 */
function buildContractValues(snapshot) {
  const e = snapshot.employee || {};
  const c = snapshot.company || {};
  return {
    full_name: e.full_name,
    email: e.email,
    personal_email: e.personal_email,
    phone: e.phone,
    employee_type: EMPLOYEE_TYPE_LABELS[e.employee_type] || e.employee_type,
    poste: e.poste,
    salary_base: formatAmountFr(e.salary_base),
    date_of_birth: formatDateFr(e.date_of_birth),
    place_of_birth: e.place_of_birth,
    gender: e.gender,
    nationality: e.nationality,
    national_id: e.national_id,
    address: e.address,
    workplace_name: e.workplace_name,
    emergency_contact_name: e.emergency_contact_name,
    emergency_contact_phone: e.emergency_contact_phone,
    emergency_contact_relation: e.emergency_contact_relation,
    contract_kind: e.contract_kind ? String(e.contract_kind).toUpperCase() : null,
    trial_period_days: e.trial_period_days,
    contract_start_date: formatDateFr(e.contract_start_date),
    contract_end_date: formatDateFr(e.contract_end_date) ?? "—",
    mission_description: e.mission_description,
    // Multi-line missions keep their structure: paragraphs + '*'/'-' bullets
    mission_description_html: renderMarkdown(e.mission_description || ""),
    work_schedule: e.work_schedule,
    "contract.date": formatDateFr(snapshot.contract_date),
    "fonts.css": fontFaceCss(),
    "company.legal_name": companyField(c, "legal_name"),
    "company.rccm": companyField(c, "trade_register"),
    "company.niu": companyField(c, "tax_id"),
    "company.address": companyField(c, "address"),
    "company.signer_name": companyField(c, "signer_name"),
    "company.signer_role": companyField(c, "signer_role"),
    "employee.signature": SIGNATURE_SLOT,
    "company.signature": imageTag(c.signature_base64, "Signature employeur"),
    "company.stamp": imageTag(c.stamp_base64, "Cachet"),
  };
}

/** Resolved document HTML with an empty employee-signature slot. */
function buildContractHtml(snapshot) {
  const cfg = documentTypeFromTemplateKey(snapshot.template_key);
  return fillContractTemplate(
    loadContractTemplate(cfg.templateFile),
    buildContractValues(snapshot)
  );
}

const SIGNATURE_IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const SIGNATURE_IMAGE_MAX_CHARS = 700_000; // ~500 KB decoded

function isValidSignatureImage(dataUrl) {
  return (
    typeof dataUrl === "string" &&
    dataUrl.length <= SIGNATURE_IMAGE_MAX_CHARS &&
    SIGNATURE_IMAGE_RE.test(dataUrl)
  );
}

/**
 * Signed document HTML = frozen contract HTML with the employee signature
 * injected into its slot + the attestation page appended.
 * @param {{ documentHtml: string, signatureImage: string, attestation: object }} input
 */
function buildSignedHtml({ documentHtml, signatureImage, attestation }) {
  const signatureImg = `<img src="${signatureImage}" alt="Signature employé" />`;
  const withSignature = documentHtml.replace(SIGNATURE_SLOT, signatureImg);
  const attestationHtml = fillContractTemplate(loadAttestationTemplate(), {
    "attestation.contractId": attestation.contractId,
    "attestation.contractTitle": attestation.contractTitle || "Contrat de travail",
    "attestation.companyLegalName": attestation.companyLegalName || "LivSight",
    "attestation.employeeName": attestation.employeeName,
    "attestation.employeePhone": attestation.employeePhone || "Non disponible",
    "attestation.signedAt": formatDateTimeFr(attestation.signedAt),
    "attestation.ip": attestation.ip || "Non disponible",
    "attestation.documentSha256": attestation.documentSha256,
  });
  if (withSignature.includes("</body>")) {
    return withSignature.replace("</body>", `${attestationHtml}</body>`);
  }
  return withSignature + attestationHtml;
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Single-use signing token — 64 hex chars (like backend_core's double UUID). */
function generateSignatureToken() {
  return crypto.randomBytes(32).toString("hex");
}

function signatureTokenExpiry(now = new Date()) {
  return new Date(now.getTime() + SIGNING_LINK_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/** Mirrors payslipFileName normalization. Suffix = contract date (YYYY-MM-DD). */
function contractFileName(employee, contractDate, type = "contrat") {
  const cfg = documentTypeConfig(type) || DOCUMENT_TYPES.contrat;
  const base = String(employee?.full_name || "employe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = toIsoDateString(contractDate) || "document";
  return `${cfg.fileNamePrefix}-${base || "employe"}-${suffix}.pdf`;
}

module.exports = {
  TEMPLATE_KEY,
  DOCUMENT_TYPES,
  documentTypeConfig,
  documentTypeFromTemplateKey,
  CONSENT_TEXT,
  SIGNING_LINK_VALIDITY_DAYS,
  SIGNATURE_SLOT,
  contractPdfOptions,
  loadContractTemplate,
  loadSignPage,
  fillContractTemplate,
  buildContractSnapshot,
  missingContractFields,
  buildContractValues,
  buildContractHtml,
  buildSignedHtml,
  isValidSignatureImage,
  sha256Hex,
  generateSignatureToken,
  signatureTokenExpiry,
  contractFileName,
  formatDateFr,
  formatDateTimeFr,
};
