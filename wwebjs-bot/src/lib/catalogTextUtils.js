"use strict";

/**
 * Normalize catalog / item text for comparison (lowercase, trim, strip accents).
 * @param {string} s
 * @returns {string}
 */
function normalizeCatalogText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

module.exports = { normalizeCatalogText };
