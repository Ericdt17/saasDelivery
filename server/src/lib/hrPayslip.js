/**
 * HR payslip model — live bulletin de paie from attendance + salary_base.
 * Full-month Mon–Sat day rate (matches client hrUi payroll rules).
 */

const {
  countWeekdaysInMonth,
  estimateDayPenaltyRates,
} = require("./hrCheckin");

const LATE_PAY_FACTOR = 0.5;

/** Defaults when company_settings row is missing or fields are empty. */
const DEFAULT_COMPANY_BRANDING = {
  companyName: "LivSight",
  legalName: "LivSight",
  taxId: "",
  tradeRegister: "",
  legalIdsLine: "",
  address: "Douala, Cameroun",
  phone: "+237 000 000 000",
  email: "contact@livsight.com",
  accentColor: "#4A9FD4",
  logoBase64: null,
  signatureBase64: null,
  stampBase64: null,
  signerName: "",
  signerRole: "",
};

/** @deprecated use DEFAULT_COMPANY_BRANDING */
const COMPANY_BRANDING = DEFAULT_COMPANY_BRANDING;

const ACCENT_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Map DB company_settings row → payslip template branding.
 * @param {Record<string, unknown>|null|undefined} row
 */
function resolveCompanyBranding(row) {
  if (!row) return { ...DEFAULT_COMPANY_BRANDING };
  const accent =
    typeof row.accent_color === "string" && ACCENT_COLOR_RE.test(row.accent_color.trim())
      ? row.accent_color.trim()
      : DEFAULT_COMPANY_BRANDING.accentColor;
  const companyName =
    (typeof row.company_name === "string" && row.company_name.trim()) ||
    DEFAULT_COMPANY_BRANDING.companyName;
  const legalName =
    (typeof row.legal_name === "string" && row.legal_name.trim()) ||
    companyName;
  const taxId =
    typeof row.tax_id === "string" && row.tax_id.trim() ? row.tax_id.trim() : "";
  const tradeRegister =
    typeof row.trade_register === "string" && row.trade_register.trim()
      ? row.trade_register.trim()
      : "";
  const legalIds = [
    taxId ? `NUI: ${taxId}` : null,
    tradeRegister ? `RCCM: ${tradeRegister}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    companyName,
    legalName,
    taxId,
    tradeRegister,
    legalIdsLine: legalIds,
    address:
      (typeof row.address === "string" && row.address.trim()) ||
      DEFAULT_COMPANY_BRANDING.address,
    phone:
      (typeof row.phone === "string" && row.phone.trim()) ||
      DEFAULT_COMPANY_BRANDING.phone,
    email:
      (typeof row.email === "string" && row.email.trim()) ||
      DEFAULT_COMPANY_BRANDING.email,
    accentColor: accent,
    logoBase64:
      typeof row.logo_base64 === "string" && row.logo_base64.trim()
        ? row.logo_base64.trim()
        : null,
    signatureBase64:
      typeof row.signature_base64 === "string" && row.signature_base64.trim()
        ? row.signature_base64.trim()
        : null,
    stampBase64:
      typeof row.stamp_base64 === "string" && row.stamp_base64.trim()
        ? row.stamp_base64.trim()
        : null,
    signerName:
      typeof row.signer_name === "string" && row.signer_name.trim()
        ? row.signer_name.trim()
        : "",
    signerRole:
      typeof row.signer_role === "string" && row.signer_role.trim()
        ? row.signer_role.trim()
        : "",
  };
}

function formatCurrency(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(amount)))} F`;
}

function formatMonthLabelFr(year, month) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * @param {{
 *   salaryBase: number|null,
 *   daysPresent: number,
 *   daysLate: number,
 *   daysAbsent: number,
 *   workdaysInMonth: number,
 * }} input
 */
function estimatePayslipAmounts(input) {
  const workdays = Number(input.workdaysInMonth) || 0;
  if (workdays <= 0) {
    return {
      costLateDay: null,
      costAbsentDay: null,
      penaltyLate: null,
      penaltyAbsent: null,
      penaltiesTotal: null,
      netPay: null,
    };
  }
  const salary = Number(input.salaryBase) || 0;
  const rates = estimateDayPenaltyRates(salary, workdays) || {
    cost_late_day: 0,
    cost_absent_day: 0,
  };
  const daysLate = Number(input.daysLate) || 0;
  const daysAbsent = Number(input.daysAbsent) || 0;
  const dayRate = salary > 0 ? salary / workdays : 0;
  const penaltyLate = Math.round(dayRate * LATE_PAY_FACTOR * daysLate);
  const penaltyAbsent = Math.round(dayRate * daysAbsent);
  const penaltiesTotal = penaltyLate + penaltyAbsent;
  const netPay = Math.max(0, Math.round(salary - penaltiesTotal));
  return {
    costLateDay: rates.cost_late_day,
    costAbsentDay: rates.cost_absent_day,
    penaltyLate,
    penaltyAbsent,
    penaltiesTotal,
    netPay,
  };
}

/**
 * Build preformatted template model for PDF.
 * @param {{
 *   employee: { id: number, full_name: string, email: string, poste?: string|null, salary_base?: number|null },
 *   month: number,
 *   year: number,
 *   daysPresent: number,
 *   daysLate: number,
 *   daysAbsent: number,
 *   weekdaysElapsed?: number,
 *   company?: Record<string, unknown>|null,
 *   signer?: { name?: string|null, fonction?: string|null, signature_base64?: string|null }|null,
 *   generatedAt?: Date,
 * }} input
 */
function buildPayslipModel(input) {
  const year = Number(input.year);
  const month = Number(input.month);
  const workdaysInMonth = countWeekdaysInMonth(year, month);
  const salaryBase = input.employee.salary_base ?? null;
  const amounts = estimatePayslipAmounts({
    salaryBase,
    daysPresent: input.daysPresent,
    daysLate: input.daysLate,
    daysAbsent: input.daysAbsent,
    workdaysInMonth,
  });

  const generatedAt = input.generatedAt || new Date();
  const generatedAtLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeZone: "Africa/Douala",
  }).format(generatedAt);

  const monthPad = String(month).padStart(2, "0");
  const bulletinNo = `PAIE-${year}${monthPad}-${input.employee.id}`;
  const branding = resolveCompanyBranding(input.company);
  const logoHtml = branding.logoBase64
    ? `<img class="header-logo" src="${branding.logoBase64}" alt="" />`
    : "";
  const stampHtml = branding.stampBase64
    ? `<img class="stamp-img" src="${branding.stampBase64}" alt="" />`
    : "";

  const signer = input.signer || null;
  const signerName =
    (signer && typeof signer.name === "string" && signer.name.trim()) ||
    branding.signerName ||
    "";
  const signerRole =
    (signer && typeof signer.fonction === "string" && signer.fonction.trim()) ||
    branding.signerRole ||
    "";
  const signerSignature =
    (signer &&
      typeof signer.signature_base64 === "string" &&
      signer.signature_base64.trim()) ||
    branding.signatureBase64 ||
    null;
  const signatureHtml = signerSignature
    ? `<img class="signature-img" src="${signerSignature}" alt="" />`
    : "";

  return {
    ...branding,
    signerName,
    signerRole,
    logoHtml,
    signatureHtml,
    stampHtml,
    bulletinNo,
    employeeName: input.employee.full_name || "—",
    employeeEmail: input.employee.email || "—",
    employeePoste: input.employee.poste || "—",
    monthLabel: formatMonthLabelFr(year, month),
    year,
    month,
    monthPad,
    generatedAtLabel,
    workdaysInMonth: String(workdaysInMonth),
    weekdaysElapsed:
      input.weekdaysElapsed != null ? String(input.weekdaysElapsed) : "—",
    daysPresent: String(input.daysPresent ?? 0),
    daysLate: String(input.daysLate ?? 0),
    daysAbsent: String(input.daysAbsent ?? 0),
    salaryBaseLabel: formatCurrency(salaryBase ?? 0),
    costLateDayLabel: formatCurrency(amounts.costLateDay),
    costAbsentDayLabel: formatCurrency(amounts.costAbsentDay),
    penaltyLateLabel: formatCurrency(amounts.penaltyLate),
    penaltyAbsentLabel: formatCurrency(amounts.penaltyAbsent),
    penaltiesTotalLabel: formatCurrency(amounts.penaltiesTotal),
    netPayLabel: formatCurrency(amounts.netPay),
    amounts,
  };
}

/**
 * Safe Content-Disposition filename.
 * @param {{ full_name?: string, id: number }} employee
 * @param {number} year
 * @param {number} month
 */
function payslipFileName(employee, year, month) {
  const raw = String(employee.full_name || `employe-${employee.id}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return `Bulletin-paie-${raw || "employe"}-${ym}.pdf`;
}

module.exports = {
  COMPANY_BRANDING,
  DEFAULT_COMPANY_BRANDING,
  ACCENT_COLOR_RE,
  LATE_PAY_FACTOR,
  formatCurrency,
  formatMonthLabelFr,
  estimatePayslipAmounts,
  resolveCompanyBranding,
  buildPayslipModel,
  payslipFileName,
};
