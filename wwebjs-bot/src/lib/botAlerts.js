/**
 * Optional ops alerts: Discord or Slack incoming webhook.
 * Set BOT_ALERT_WEBHOOK_URL (and optionally BOT_ALERT_WEBHOOK_TYPE).
 */

const processStart = Date.now();

let getQrShown = () => false;
let disconnectTimer = null;
let lastDisconnectReason = "";
let qrStaleTimer = null;
let stateWatchTimer = null;
let firstNotConnectedAt = null;
let startupWebhookSent = false;
const lastCooldownSent = new Map();

function config() {
  return {
    webhookUrl: (process.env.BOT_ALERT_WEBHOOK_URL || "").trim(),
    type: inferWebhookType(),
    disconnectMs:
      Number(process.env.BOT_ALERT_DISCONNECT_MS) || 5 * 60 * 1000,
    stateGraceMs:
      Number(process.env.BOT_ALERT_STATE_GRACE_MS) || 3 * 60 * 1000,
    stateIntervalMs:
      Number(process.env.BOT_ALERT_STATE_INTERVAL_MS) || 2 * 60 * 1000,
    notConnectedMs:
      Number(process.env.BOT_ALERT_NOT_CONNECTED_MS) || 10 * 60 * 1000,
    qrStaleMs:
      Number(process.env.BOT_ALERT_QR_STALE_MS) || 20 * 60 * 1000,
    errorCooldownMs:
      Number(process.env.BOT_ALERT_ERROR_COOLDOWN_MS) || 15 * 60 * 1000,
  };
}

function inferWebhookType() {
  const explicit = (process.env.BOT_ALERT_WEBHOOK_TYPE || "").toLowerCase();
  if (explicit === "slack" || explicit === "discord") return explicit;
  const url = process.env.BOT_ALERT_WEBHOOK_URL || "";
  if (url.includes("hooks.slack.com")) return "slack";
  return "discord";
}

async function sendBotAlert(text) {
  const { webhookUrl, type } = config();
  if (!webhookUrl) return;

  const body =
    type === "slack"
      ? JSON.stringify({ text })
      : JSON.stringify({ content: String(text).slice(0, 2000) });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[botAlerts] Webhook HTTP", res.status, t.slice(0, 200));
    }
  } catch (err) {
    console.error("[botAlerts] Webhook error:", err.message);
  }
}

function alertWithCooldown(key, text, cooldownMs) {
  const now = Date.now();
  const last = lastCooldownSent.get(key) || 0;
  if (now - last < cooldownMs) return;
  lastCooldownSent.set(key, now);
  sendBotAlert(text);
}

function clearDisconnectAlertTimer() {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
}

function clearQrStaleTimer() {
  if (qrStaleTimer) {
    clearTimeout(qrStaleTimer);
    qrStaleTimer = null;
  }
}

function scheduleQrStaleAlert(qrStaleMs) {
  clearQrStaleTimer();
  qrStaleTimer = setTimeout(() => {
    qrStaleTimer = null;
    alertWithCooldown(
      "qr-stale",
      `[Livsight bot] QR code still not scanned after ${Math.round(
        qrStaleMs / 60000
      )} minutes. Link the device in WhatsApp.`,
      qrStaleMs
    );
  }, qrStaleMs);
}

function init({ getQrShown: qrFn, client }) {
  getQrShown = typeof qrFn === "function" ? qrFn : () => false;
  if (!config().webhookUrl) {
    console.log(
      "[botAlerts] BOT_ALERT_WEBHOOK_URL not set — deeper alerts disabled"
    );
    return;
  }
  console.log(
    `[botAlerts] Webhook alerts enabled (${config().type}), disconnect after ${
      config().disconnectMs / 60000
    }m, state check every ${config().stateIntervalMs / 60000}m`
  );
  startPeriodicStateCheck(client);
}

function notifyAuthFailure(msg) {
  if (!config().webhookUrl) return;
  sendBotAlert(
    `[Livsight bot] AUTH FAILURE — session may need re-linking.\n${String(
      msg
    ).slice(0, 1500)}`
  );
}

function notifyDisconnected(reason) {
  if (!config().webhookUrl) return;
  lastDisconnectReason = String(reason || "unknown");
  clearDisconnectAlertTimer();
  const ms = config().disconnectMs;
  disconnectTimer = setTimeout(() => {
    disconnectTimer = null;
    sendBotAlert(
      `[Livsight bot] Still disconnected after ${ms / 60000} min. Reason: ${lastDisconnectReason}`
    );
  }, ms);
}

function notifyReady() {
  clearDisconnectAlertTimer();
  clearQrStaleTimer();
  firstNotConnectedAt = null;
}

function onQrShown() {
  if (!config().webhookUrl) return;
  scheduleQrStaleAlert(config().qrStaleMs);
}

function notifyClientError(error) {
  if (!config().webhookUrl) return;
  const msg = error?.message || String(error);
  alertWithCooldown(
    "client-error",
    `[Livsight bot] Client error (throttled):\n${msg.slice(0, 1500)}`,
    config().errorCooldownMs
  );
}

/** WhatsApp → DB delivery insert failed (throttled). */
function notifyDeliverySaveFailed(detail) {
  if (!config().webhookUrl) return;
  const cooldown =
    Number(process.env.BOT_ALERT_DELIVERY_DB_COOLDOWN_MS) || 300000;
  alertWithCooldown(
    "delivery-db-error",
    `[Livsight bot] Delivery failed to save to DB:\n${String(detail).slice(0, 1500)}`,
    cooldown
  );
}

/** Reminders worker: poll/mark DB threw (throttled). */
function notifyRemindersTickFailed(err) {
  if (!config().webhookUrl) return;
  const cooldown =
    Number(process.env.BOT_ALERT_REMINDERS_TICK_COOLDOWN_MS) || 600000;
  const msg = err?.message || String(err);
  alertWithCooldown(
    "reminders-tick",
    `[Livsight bot] Reminders worker tick failed:\n${msg.slice(0, 1500)}`,
    cooldown
  );
}

/**
 * Bot came online and WhatsApp `ready` fired.
 * Default: one Discord/Slack message per process (avoids spam on reconnect).
 * Set BOT_ALERT_STARTUP_EVERY_READY=true for a message on every `ready`.
 * Set BOT_ALERT_STARTUP_ENABLED=false to disable entirely.
 */
function notifyStartup(durationSeconds) {
  if (!config().webhookUrl) return;
  const disabled =
    process.env.BOT_ALERT_STARTUP_ENABLED === "false" ||
    process.env.BOT_ALERT_STARTUP_ENABLED === "0";
  if (disabled) return;
  const everyReady =
    process.env.BOT_ALERT_STARTUP_EVERY_READY === "true" ||
    process.env.BOT_ALERT_STARTUP_EVERY_READY === "1";
  if (!everyReady && startupWebhookSent) return;
  startupWebhookSent = true;
  sendBotAlert(
    `[Livsight bot] Bot is online and ready (startup: ${durationSeconds}s).`
  );
}

/** Message event handler threw unexpectedly (throttled). */
function notifyMessageError(error, from) {
  if (!config().webhookUrl) return;
  const msg = error?.message || String(error);
  alertWithCooldown(
    "message-error",
    `[Livsight bot] Error processing message from ${from || "unknown"}:\n${msg.slice(0, 1500)}`,
    config().errorCooldownMs
  );
}

/** Daily report generation or send failed (throttled). */
function notifyReportFailed(error) {
  if (!config().webhookUrl) return;
  const msg = error?.message || String(error);
  alertWithCooldown(
    "report-failed",
    `[Livsight bot] Daily report failed:\n${msg.slice(0, 1500)}`,
    config().errorCooldownMs
  );
}

/** API route threw an unexpected error (DB connection down, unhandled 500, etc.) — throttled. */
function notifyApiError(method, path, error) {
  if (!config().webhookUrl) return;
  const msg = error?.message || String(error);
  alertWithCooldown(
    `api-error:${method}:${path}`,
    `[Livsight API] Error on ${method} ${path}:\n${msg.slice(0, 1500)}`,
    config().errorCooldownMs
  );
}

/** Uncaught process-level error (throttled). */
function notifyProcessError(kind, error) {
  if (!config().webhookUrl) return;
  const msg = error?.message || String(error);
  alertWithCooldown(
    `process-error-${kind}`,
    `[Livsight bot] Process ${kind}:\n${msg.slice(0, 1500)}`,
    config().errorCooldownMs
  );
}

/** One or more reminder sends failed or skipped as send in this tick (throttled). */
function notifyRemindersSendFailures({ count, sample }) {
  if (!config().webhookUrl || !count) return;
  const cooldown =
    Number(process.env.BOT_ALERT_REMINDERS_SEND_COOLDOWN_MS) || 600000;
  alertWithCooldown(
    "reminders-send-batch",
    `[Livsight bot] ${count} reminder target(s) failed or could not send (this poll cycle). Example: ${String(sample || "").slice(0, 500)}`,
    cooldown
  );
}

function startPeriodicStateCheck(client) {
  if (!config().webhookUrl || stateWatchTimer) return;

  const tick = async () => {
    if (getQrShown()) {
      firstNotConnectedAt = null;
      return;
    }
    if (Date.now() - processStart < config().stateGraceMs) return;

    try {
      const state = await client.getState();
      if (state === "CONNECTED") {
        firstNotConnectedAt = null;
        return;
      }
      if (firstNotConnectedAt == null) firstNotConnectedAt = Date.now();
      if (Date.now() - firstNotConnectedAt >= config().notConnectedMs) {
        alertWithCooldown(
          "not-connected",
          `[Livsight bot] WhatsApp state is not CONNECTED for >${
            config().notConnectedMs / 60000
          } min (current: ${state}). Process may be up but session is not ready.`,
          Math.min(config().notConnectedMs, 30 * 60 * 1000)
        );
      }
    } catch {
      // getState can throw before the client is initialised; ignore
    }
  };

  stateWatchTimer = setInterval(
    tick,
    config().stateIntervalMs
  );
  stateWatchTimer.unref?.();
}

module.exports = {
  init,
  notifyAuthFailure,
  notifyDisconnected,
  notifyReady,
  onQrShown,
  notifyClientError,
  notifyDeliverySaveFailed,
  notifyRemindersTickFailed,
  notifyRemindersSendFailures,
  notifyStartup,
  notifyMessageError,
  notifyReportFailed,
  notifyProcessError,
  notifyApiError,
};
