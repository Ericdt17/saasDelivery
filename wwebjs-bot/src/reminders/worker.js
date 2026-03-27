/**
 * Reminders worker
 * Polls the DB for due reminders and sends WhatsApp messages.
 */

const db = require("../db");

function phoneToChatId(phone) {
  // WhatsApp expects digits only for c.us
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `${digits}@c.us`;
}

function createRemindersWorker({ client, pollIntervalMs = 60000, batchSize = 50, logger = console }) {
  let timer = null;
  let running = false;

  const parseMinutes = (hhmm) => {
    if (!hhmm || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const isNowInWindow = (timezone, windowStart, windowEnd) => {
    if (!windowStart || !windowEnd) return true;
    const now = new Date();
    const locale = now.toLocaleString("en-GB", { hour12: false, timeZone: timezone || "UTC", hour: "2-digit", minute: "2-digit" });
    const [h, m] = locale.split(":").map((v) => Number(v));
    const nowMin = h * 60 + m;
    const start = parseMinutes(windowStart);
    const end = parseMinutes(windowEnd);
    if (start === null || end === null) return true;
    if (start <= end) return nowMin >= start && nowMin <= end;
    return nowMin >= start || nowMin <= end;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const toTargetChatId = (target) => {
    if (target.target_type === "group") {
      return String(target.target_value || "").endsWith("@g.us")
        ? String(target.target_value)
        : `${String(target.target_value)}@g.us`;
    }
    return phoneToChatId(target.target_value);
  };

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await db.pollQueuedReminderTargets({ limit: batchSize });
      const rows = Array.isArray(due) ? due : [];

      for (const r of rows) {
        await db.markReminderTargetProcessing(r.reminder_id);
        if (!isNowInWindow(r.timezone, r.window_start, r.window_end)) {
          await db.updateReminderTargetStatus(r.target_id, "skipped", "Outside configured send window");
          continue;
        }
        const chatId = toTargetChatId(r);
        if (!chatId) {
          await db.updateReminderTargetStatus(r.target_id, "failed", "Invalid target phone");
          continue;
        }

        try {
          await client.sendMessage(chatId, String(r.message || ""));
          await db.updateReminderTargetStatus(r.target_id, "sent", null);
        } catch (err) {
          await db.updateReminderTargetStatus(r.target_id, "failed", err?.message || String(err));
        }
        const min = Number(r.send_interval_min_sec ?? 60);
        const max = Number(r.send_interval_max_sec ?? 120);
        await sleep(randomInt(min, max) * 1000);
      }
    } catch (err) {
      logger.error?.("Reminders worker tick failed:", err);
    } finally {
      running = false;
    }
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(() => void tick(), pollIntervalMs);
    // Run once at startup
    void tick();
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  return { start, stop, tick, phoneToChatId };
}

module.exports = { createRemindersWorker, phoneToChatId };

