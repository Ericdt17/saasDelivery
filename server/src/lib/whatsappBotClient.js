"use strict";

/**
 * WhatsApp bot outbound client — text / document DMs via health server.
 *
 * Env:
 *   WHATSAPP_BOT_BASE_URL       default http://127.0.0.1:3099
 *   WHATSAPP_BOT_INTERNAL_TOKEN must match bot BOT_INTERNAL_TOKEN
 *   WHATSAPP_BOT_ENABLED        default false
 */

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_BASE_URL = "http://127.0.0.1:3099";

class WhatsAppBotError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number|null, code: string, body?: unknown }} opts
   */
  constructor(message, { status = null, code, body = undefined }) {
    super(message);
    this.name = "WhatsAppBotError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function config() {
  const baseUrl = (process.env.WHATSAPP_BOT_BASE_URL || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/$/, "");
  const token = (process.env.WHATSAPP_BOT_INTERNAL_TOKEN || "").trim();
  const enabled =
    process.env.WHATSAPP_BOT_ENABLED === "true" ||
    process.env.WHATSAPP_BOT_ENABLED === "1";
  return { baseUrl, token, enabled };
}

function isWhatsAppBotEnabled() {
  return config().enabled;
}

/**
 * @param {string} path
 * @param {object} jsonBody
 */
async function postBot(path, jsonBody) {
  const { baseUrl, token, enabled } = config();
  if (!enabled) {
    throw new WhatsAppBotError("WhatsApp bot outbound is disabled", {
      code: "config",
    });
  }
  if (!token) {
    throw new WhatsAppBotError("WHATSAPP_BOT_INTERNAL_TOKEN is not configured", {
      code: "config",
    });
  }

  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Internal-Token": token,
      },
      body: JSON.stringify(jsonBody),
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new WhatsAppBotError("WhatsApp bot request timed out", {
        code: "timeout",
      });
    }
    throw new WhatsAppBotError(err.message || "WhatsApp bot network error", {
      code: "network",
    });
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new WhatsAppBotError("WhatsApp bot rejected the internal token", {
      status: 401,
      code: "unauthorized",
      body,
    });
  }

  if (!res.ok) {
    const msg =
      (body && (body.message || body.error)) ||
      `WhatsApp bot HTTP ${res.status}`;
    throw new WhatsAppBotError(String(msg), {
      status: res.status,
      code: body?.error || "http",
      body,
    });
  }

  return body;
}

/**
 * @param {{ recipientPhone: string, message: string }} payload
 */
async function sendTextDm(payload) {
  const body = await postBot("/internal/send-text-dm", {
    recipient_phone: payload.recipientPhone,
    message: payload.message,
  });
  return {
    messageId: body?.message_id != null ? String(body.message_id) : null,
    recipient: body?.recipient != null ? String(body.recipient) : null,
  };
}

/**
 * @param {{
 *   recipientPhone: string,
 *   filename: string,
 *   pdfBase64: string,
 *   caption?: string,
 * }} payload
 */
async function sendDocumentDm(payload) {
  const body = await postBot("/internal/send-document-dm", {
    recipient_phone: payload.recipientPhone,
    filename: payload.filename,
    pdf_base64: payload.pdfBase64,
    caption: payload.caption || undefined,
  });
  return {
    messageId: body?.message_id != null ? String(body.message_id) : null,
    recipient: body?.recipient != null ? String(body.recipient) : null,
    filename: body?.filename != null ? String(body.filename) : null,
  };
}

module.exports = {
  WhatsAppBotError,
  isWhatsAppBotEnabled,
  sendTextDm,
  sendDocumentDm,
  config,
};
