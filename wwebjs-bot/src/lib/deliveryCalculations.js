"use strict";

/**
 * Pure financial helpers for delivery tariff / amount_paid logic.
 * Used by API routes and WhatsApp bot — single source of truth for tests.
 */

/**
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
function roundAmount(value) {
  return Math.round(parseFloat(value) * 100) / 100;
}

/**
 * Net amount after subtracting a fee, never negative (2 decimal places).
 * Same as: max(0, round(base - fee)) with float-safe rounding.
 *
 * @param {string|number} baseAmount — amount_due or current amount_paid
 * @param {string|number} feeAmount — delivery_fee or tariff
 */
function computeAmountPaidAfterFee(baseAmount, feeAmount) {
  return Math.max(
    0,
    Math.round((parseFloat(baseAmount) - parseFloat(feeAmount)) * 100) / 100
  );
}

/**
 * Whether the delivery still needs a tariff row (pending + quartier + no positive fee).
 */
function computeTariffPending(status, quartier, deliveryFee) {
  const normalizedStatus = (status || "").toString().toLowerCase();
  const hasQuartier =
    quartier !== null &&
    quartier !== undefined &&
    String(quartier).trim() !== "";
  const fee =
    deliveryFee !== null && deliveryFee !== undefined
      ? parseFloat(deliveryFee)
      : NaN;

  return (
    normalizedStatus === "pending" &&
    hasQuartier &&
    (!Number.isFinite(fee) || fee <= 0)
  );
}

module.exports = {
  roundAmount,
  computeAmountPaidAfterFee,
  computeTariffPending,
};
