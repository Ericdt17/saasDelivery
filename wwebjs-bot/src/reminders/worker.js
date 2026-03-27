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

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await db.getDueReminders({ limit: batchSize });
      const rows = Array.isArray(due) ? due : [];

      for (const r of rows) {
        const chatId = phoneToChatId(r.contact_phone);
        if (!chatId) {
          await markReminderFailed(r.id, "Invalid contact phone");
          continue;
        }

        try {
          await client.sendMessage(chatId, String(r.message || ""));
          await db.markReminderSent(r.id);
        } catch (err) {
          await db.markReminderFailed(r.id, err?.message || String(err));
        }
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

