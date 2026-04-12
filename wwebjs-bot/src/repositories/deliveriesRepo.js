/**
 * Deliveries repository.
 *
 * Thin wrapper around the existing db module exports.
 * This enables service-layer unit tests without loading the full db adapter.
 */
const db = require("../db");

module.exports = {
  getAllDeliveries: db.getAllDeliveries,
  getDeliveryById: db.getDeliveryById,
  createDelivery: db.createDelivery,
  updateDelivery: db.updateDelivery,
  deleteDelivery: db.deleteDelivery,
  getDeliveryHistory: db.getDeliveryHistory,
  saveHistory: db.saveHistory,
  getExpoPushTokensForVendorUserIds: db.getExpoPushTokensForVendorUserIds,
};

