"use strict";

const OpenAI = require("openai");
const {
  extractPhone,
  extractAmount,
  extractQuartier,
} = require("../parser");

const SYSTEM_PROMPT = `You extract delivery order fields from messy WhatsApp text (Cameroon / Douala context).
Return a single JSON object with keys: phone (string, 9 digits starting with 6, no spaces), product (string, items description), amount (number, total amount in FCFA as integer), location (string, neighborhood/quartier or empty string).
Rules:
- amount is the price the customer pays for the goods (Prix, Montant, Total). If the user wrote 15k or 15K, amount is 15000.
- amount must NOT include or subtract delivery/shipping/livraison fees — ignore lines labelled "Livraison", "Frais", "Transport", "Frais de livraison".
- phone must be Cameroon mobile format 6XXXXXXXX (9 digits). Strip country code (+237) if present.
- If a field cannot be determined, use empty string for phone/location/product or 0 for amount only when no amount exists.
- Respond with JSON only, no markdown.`;

/**
 * Normalize a model-supplied phone string to 6xxxxxxxx or null.
 */
function normalizePhoneString(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 9 && digits.startsWith("6")) {
    return digits.slice(0, 9);
  }
  if (digits.length === 8 && digits.startsWith("6")) {
    return digits.padEnd(9, "0");
  }
  return null;
}

/**
 * Parse amount from model output (number or string like "15k").
 */
function coerceAmountFromModel(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 100 ? Math.round(value) : null;
  }
  if (typeof value === "string") {
    const s = value.trim().replace(/\s/g, "");
    const kMatch = s.match(/^(\d+(?:\.\d+)?)k$/i);
    if (kMatch) {
      const n = parseFloat(kMatch[1]);
      return Number.isFinite(n) ? Math.round(n * 1000) : null;
    }
    const n = parseInt(s.replace(/[.,]/g, ""), 10);
    return Number.isFinite(n) && n >= 100 ? n : null;
  }
  return null;
}

/**
 * Validates AI JSON against the original message. Requires phone + amount.
 * Uses extractPhone/extractAmount from text when present to reduce hallucinations.
 *
 * @param {object|null} modelObj - Parsed JSON from the model
 * @param {string} originalText - Raw WhatsApp message
 * @returns {null|{ phone: string, items: string, amount_due: number, quartier: string|null, carrier: null }}
 */
function validateAndNormalizeAiDelivery(modelObj, originalText) {
  if (!modelObj || typeof modelObj !== "object") return null;

  const text = originalText || "";
  const phoneFromText = extractPhone(text);
  const phoneFromModel = normalizePhoneString(
    typeof modelObj.phone === "string" ? modelObj.phone : String(modelObj.phone || "")
  );
  const phone = phoneFromText || phoneFromModel;
  if (!phone || !/^6\d{8}$/.test(phone)) return null;

  const amountFromText = extractAmount(text);
  const amountFromModel = coerceAmountFromModel(modelObj.amount);

  let amount_due = null;
  if (amountFromText != null && amountFromModel != null) {
    const diff = Math.abs(amountFromText - amountFromModel);
    const tol = Math.max(500, 0.05 * amountFromText);
    if (diff > tol) return null;
    amount_due = Math.round(amountFromText);
  } else if (amountFromText != null) {
    amount_due = Math.round(amountFromText);
  } else if (amountFromModel != null) {
    amount_due = amountFromModel;
  }

  if (amount_due == null || amount_due < 100) return null;

  const quartierFromText = extractQuartier(text);
  let quartier = quartierFromText;
  if (!quartier && modelObj.location != null) {
    const loc = String(modelObj.location).trim();
    quartier = loc.length > 0 ? loc : null;
  }

  const productRaw =
    modelObj.product != null
      ? String(modelObj.product).trim()
      : modelObj.items != null
        ? String(modelObj.items).trim()
        : "";
  const items = productRaw.length > 0 ? productRaw : "Non spécifié";

  return {
    phone,
    items,
    amount_due,
    quartier: quartier || null,
    carrier: null,
  };
}

/**
 * Call OpenAI to extract delivery fields. Does not validate — use validateAndNormalizeAiDelivery.
 *
 * @param {string} messageText
 * @param {object} cfg - config slice: OPENAI_API_KEY, AI_DELIVERY_MODEL, AI_DELIVERY_TIMEOUT_MS, AI_DELIVERY_MAX_TOKENS
 * @returns {Promise<{ ok: true, raw: object } | { ok: false, error: string }>}
 */
async function extractDeliveryWithAI(messageText, cfg) {
  if (!cfg.OPENAI_API_KEY) {
    return { ok: false, error: "no_api_key" };
  }

  const client = new OpenAI({ apiKey: cfg.OPENAI_API_KEY });
  const controller = new AbortController();
  const timeoutMs = cfg.AI_DELIVERY_TIMEOUT_MS || 4000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await client.chat.completions.create(
      {
        model: cfg.AI_DELIVERY_MODEL || "gpt-4o-mini",
        max_tokens: cfg.AI_DELIVERY_MAX_TOKENS || 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract delivery fields from this message:\n\n${messageText}`,
          },
        ],
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return { ok: false, error: "empty_response" };
    }

    let raw;
    try {
      raw = JSON.parse(content);
    } catch {
      return { ok: false, error: "invalid_json" };
    }

    return { ok: true, raw };
  } catch (err) {
    const name = err?.name || "";
    const message = err?.message || String(err);
    if (name === "AbortError" || message.includes("abort")) {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  extractDeliveryWithAI,
  validateAndNormalizeAiDelivery,
  normalizePhoneString,
  coerceAmountFromModel,
};
