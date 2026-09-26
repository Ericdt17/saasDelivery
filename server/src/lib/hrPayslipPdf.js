"use strict";

/**
 * Shared HR payslip PDF builder — used by download and WhatsApp send.
 */

const {
  getEmployeeById,
  summarizeAttendances,
  getCompanySettings,
  getAgencyById,
} = require("../db");
const { countWeekdaysElapsed } = require("./hrCheckin");
const { buildPayslipModel, payslipFileName } = require("./hrPayslip");
const { renderPayslipPdf } = require("./pdf/renderPayslipPdf");

/**
 * @param {{
 *   employeeId: number,
 *   month: number,
 *   year: number,
 *   signerUserId?: number|null,
 * }} input
 * @returns {Promise<
 *   | { ok: true, buffer: Buffer, fileName: string, employee: object, model: object }
 *   | { ok: false, error: "not_found" }
 * >}
 */
async function buildEmployeePayslipPdf({
  employeeId,
  month,
  year,
  signerUserId = null,
}) {
  const employee = await getEmployeeById(employeeId);
  if (!employee) {
    return { ok: false, error: "not_found" };
  }

  const weekdaysElapsed = countWeekdaysElapsed(year, month);
  const rows = await summarizeAttendances({ month, year });
  const row = rows.find((r) => Number(r.employee_id) === employeeId);
  const daysPresent = Number(row?.days_present) || 0;
  const daysLate = Number(row?.days_late) || 0;
  const daysAbsent = Math.max(0, weekdaysElapsed - daysPresent - daysLate);

  const company = await getCompanySettings();
  let signer = null;
  if (signerUserId != null) {
    const profile = await getAgencyById(signerUserId);
    if (profile) {
      signer = {
        name: profile.name,
        fonction: profile.fonction,
        signature_base64: profile.signature_base64,
        stamp_base64: profile.stamp_base64,
      };
    }
  }

  const model = buildPayslipModel({
    employee,
    month,
    year,
    daysPresent,
    daysLate,
    daysAbsent,
    weekdaysElapsed,
    company,
    signer,
  });
  const fileName = payslipFileName(employee, year, month);
  const buffer = await renderPayslipPdf(model);

  return { ok: true, buffer, fileName, employee, model };
}

module.exports = {
  buildEmployeePayslipPdf,
};
