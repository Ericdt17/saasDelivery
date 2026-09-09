/**
 * Optional ops alerts: Discord or Slack incoming webhook.
 * Set BOT_ALERT_WEBHOOK_URL (and optionally BOT_ALERT_WEBHOOK_TYPE).
 * Recruitment applications: RECRUITMENT_ALERT_WEBHOOK_URL (separate channel).
 * HR check-in errors: HR_ALERT_WEBHOOK_URL (separate channel).
 */

const lastCooldownSent = new Map();

function config() {
  const webhookUrl = (process.env.BOT_ALERT_WEBHOOK_URL || "").trim();
  return {
    webhookUrl,
    type: inferWebhookType(webhookUrl),
    errorCooldownMs:
      Number(process.env.BOT_ALERT_ERROR_COOLDOWN_MS) || 15 * 60 * 1000,
  };
}

function hrCooldownMs() {
  const n = Number(process.env.HR_ALERT_COOLDOWN_MS);
  return Number.isFinite(n) && n >= 0 ? n : 5 * 60 * 1000;
}

function startupAlertsEnabled() {
  const flag = (process.env.BOT_ALERT_STARTUP_ENABLED || "true").toLowerCase();
  return flag !== "false" && flag !== "0";
}

function inferWebhookType(url) {
  const explicit = (process.env.BOT_ALERT_WEBHOOK_TYPE || "").toLowerCase();
  if (explicit === "slack" || explicit === "discord") return explicit;
  if ((url || "").includes("hooks.slack.com")) return "slack";
  return "discord";
}

function recruitmentWebhookUrl() {
  return (process.env.RECRUITMENT_ALERT_WEBHOOK_URL || "").trim();
}

function hrWebhookUrl() {
  return (process.env.HR_ALERT_WEBHOOK_URL || "").trim();
}

function recruitmentDashboardUrl() {
  const explicit = (process.env.RECRUITMENT_DASHBOARD_URL || "").trim();
  const fromOrigins = (process.env.ALLOWED_ORIGINS || "").split(",")[0]?.trim() || "";
  const base = (explicit || fromOrigins).replace(/\/$/, "");
  return base ? `${base}/recruitment/applications` : null;
}

const EDUCATION_LABELS = {
  bac: "Bac",
  licence: "Licence",
  master: "Master",
  doctorat: "Doctorat",
};

const TRANSPORT_LABELS = {
  scooter: "Scooter",
  velo: "Vélo",
  voiture: "Voiture",
  apied: "À pied",
};

const AVAILABILITY_LABELS = {
  plein: "Temps plein",
  partiel: "Temps partiel",
  weekend: "Week-end",
};

const LANGUAGE_LABELS = {
  francais: "Français",
  anglais: "Anglais",
};

function label(map, value) {
  if (!value) return null;
  return map[value] || value;
}

function formatLanguages(value) {
  if (!value) return null;
  return value
    .split(",")
    .map((code) => LANGUAGE_LABELS[code.trim()] || code.trim())
    .join(", ");
}

function formatYesNo(value) {
  if (!value) return null;
  if (value === "oui") return "Oui";
  if (value === "non") return "Non";
  return value;
}

function discordLink(labelText, url) {
  if (!url) return null;
  return `${labelText} : ${url}`;
}

function buildRecruitmentAlertMessage(app) {
  const jobMeta = [app.jobType, app.jobLocation].filter(Boolean).join(" · ");
  const lines = [
    `🆕 **Nouvelle candidature** #${app.applicationId}`,
    `Poste : ${app.jobTitle}${jobMeta ? ` (${jobMeta})` : ""}`,
    "",
    "**Identité**",
    `Nom : ${app.fullName}`,
    `Téléphone : ${app.phone}`,
  ];

  if (app.email) lines.push(`Email : ${app.email}`);
  if (app.quartier) lines.push(`Quartier : ${app.quartier}`);

  const educationLevel = label(EDUCATION_LABELS, app.educationLevel);
  if (educationLevel || app.fieldOfStudy || app.schoolName) {
    lines.push("", "**Formation**");
    if (educationLevel) lines.push(`Niveau d'études : ${educationLevel}`);
    if (app.fieldOfStudy) lines.push(`Filière : ${app.fieldOfStudy}`);
    if (app.schoolName) lines.push(`École : ${app.schoolName}`);
  }

  const languages = formatLanguages(app.languages);
  if (languages) lines.push("", `**Langues** : ${languages}`);

  const employed = formatYesNo(app.currentlyEmployed);
  const otherCompany = formatYesNo(app.inOtherCompany);
  if (employed || otherCompany) {
    lines.push("", "**Situation professionnelle**");
    if (employed) lines.push(`En poste actuellement : ${employed}`);
    if (otherCompany) lines.push(`Dans une autre boîte : ${otherCompany}`);
  }

  const transport = label(TRANSPORT_LABELS, app.transport);
  const availability = label(AVAILABILITY_LABELS, app.availability);
  if (transport || availability) {
    lines.push("", "**Mobilité**");
    if (transport) lines.push(`Transport : ${transport}`);
    if (availability) lines.push(`Disponibilité : ${availability}`);
  }

  const docLines = [
    discordLink("Photo", app.photoUrl),
    discordLink("CV", app.cvUrl),
    discordLink("Lettre de motivation", app.coverLetterUrl),
  ].filter(Boolean);
  if (docLines.length) {
    lines.push("", "**Documents**", ...docLines);
  }

  if (Array.isArray(app.answers) && app.answers.length) {
    lines.push("", "**Réponses aux questions**");
    for (const item of app.answers) {
      lines.push(`• ${item.questionText} → ${item.answerText}`);
    }
  }

  const dashboardUrl = recruitmentDashboardUrl();
  if (dashboardUrl) {
    lines.push("", `Dashboard : ${dashboardUrl}`);
  }

  let message = lines.join("\n");
  if (message.length > 2000) {
    message = `${message.slice(0, 1997)}...`;
  }
  return message;
}

function buildHrCheckinAlertMessage({
  kind,
  email,
  message,
  detail,
  path,
} = {}) {
  const lines = ["**[LivSight HR]**"];
  if (kind) lines.push(`Kind : ${kind}`);
  if (email) lines.push(`Email : ${email}`);
  if (path) lines.push(`Path : ${path}`);
  if (message) lines.push(`Message : ${String(message).slice(0, 500)}`);
  if (detail) lines.push(`Detail : ${String(detail).slice(0, 500)}`);
  let text = lines.join("\n");
  if (text.length > 2000) {
    text = `${text.slice(0, 1997)}...`;
  }
  return text;
}

async function postToWebhook(webhookUrl, text) {
  if (!webhookUrl) return;

  const type = inferWebhookType(webhookUrl);
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

async function sendBotAlert(text) {
  const { webhookUrl } = config();
  await postToWebhook(webhookUrl, text);
}

function alertWithCooldown(key, text, cooldownMs) {
  const now = Date.now();
  const last = lastCooldownSent.get(key) || 0;
  if (now - last < cooldownMs) return;
  lastCooldownSent.set(key, now);
  sendBotAlert(text);
}

function hrAlertWithCooldown(key, cooldownMs) {
  const now = Date.now();
  const last = lastCooldownSent.get(key) || 0;
  if (now - last < cooldownMs) return false;
  lastCooldownSent.set(key, now);
  return true;
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

/** New recruitment application — fire-and-forget, never blocks the HTTP response. */
async function notifyNewApplication(app) {
  const webhookUrl = recruitmentWebhookUrl();
  if (!webhookUrl) return;

  await postToWebhook(webhookUrl, buildRecruitmentAlertMessage(app));
}

/**
 * HR check-in / client errors — dedicated channel, throttled per kind+email|ip.
 * Fire-and-forget; never throws to callers.
 */
async function notifyHrCheckinAlert({
  kind,
  email,
  message,
  detail,
  path,
  ip,
} = {}) {
  const webhookUrl = hrWebhookUrl();
  if (!webhookUrl) return;

  const identity =
    (email && String(email).trim().toLowerCase()) || ip || "unknown";
  const key = `hr:${kind || "other"}:${identity}`;
  const text = buildHrCheckinAlertMessage({
    kind,
    email,
    message,
    detail,
    path,
  });
  if (!hrAlertWithCooldown(key, hrCooldownMs())) return;

  await postToWebhook(webhookUrl, text);
}

function buildApiStartupMessage({ port, activeGroups, gitSha } = {}) {
  const lines = ["✅ **LivSight API démarrée**"];

  if (port != null) {
    lines.push(`Port : ${port}`);
  }

  const sha = (gitSha || process.env.DEPLOY_GIT_SHA || "").trim();
  if (sha) {
    lines.push(`Commit : ${sha}`);
  }

  if (activeGroups != null) {
    lines.push(`DB : ok · ${activeGroups} groupes actifs`);
  } else {
    lines.push("DB : ok");
  }

  lines.push(`Env : ${process.env.NODE_ENV || "development"}`);

  return lines.join("\n");
}

/** API finished startup (migrations + DB ready) — fire-and-forget. */
async function notifyApiStartup({ port, activeGroups, gitSha } = {}) {
  if (!startupAlertsEnabled() || !config().webhookUrl) return;

  await postToWebhook(
    config().webhookUrl,
    buildApiStartupMessage({ port, activeGroups, gitSha })
  );
}

module.exports = {
  notifyApiError,
  notifyNewApplication,
  notifyApiStartup,
  notifyHrCheckinAlert,
  buildApiStartupMessage,
  buildHrCheckinAlertMessage,
};
