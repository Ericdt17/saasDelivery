/**
 * Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications/)
 */

const logger = require("../logger");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

function buildHeaders() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  return headers;
}

/**
 * @param {Array<{ to: string, title?: string, body?: string, data?: object, sound?: string }>} messages
 */
async function sendExpoPushMessages(messages) {
  if (!messages || !messages.length) {
    return;
  }

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn(
          { status: res.status, body: json },
          "Expo push HTTP error"
        );
      } else if (json.errors && json.errors.length) {
        logger.warn({ errors: json.errors }, "Expo push reported errors");
      }
    } catch (err) {
      logger.error({ err }, "Expo push request failed");
    }
  }
}

/**
 * Fire-and-forget: notify creating vendor when agency updates delivery status.
 * @param {{ tokens: string[], deliveryId: number, newStatus: string, customerName?: string|null }} opts
 */
function notifyVendorDeliveryStatusChange({
  tokens,
  deliveryId,
  newStatus,
  customerName,
}) {
  const title = "Mise à jour de livraison";
  const label = customerName
    ? String(customerName).trim().slice(0, 80)
    : null;
  const body = label
    ? `Nouveau statut : ${newStatus} — ${label}`
    : `Nouveau statut : ${newStatus}`;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    data: {
      deliveryId: String(deliveryId),
      url: `/livraison-detail/${deliveryId}`,
    },
  }));

  void sendExpoPushMessages(messages).catch((err) =>
    logger.error({ err }, "Expo push batch failed")
  );
}

module.exports = {
  sendExpoPushMessages,
  notifyVendorDeliveryStatusChange,
};
