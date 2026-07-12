/**
 * Push notifications port.
 *
 * Wraps the Expo push helper so services can depend on an interface that can
 * be stubbed in unit tests.
 */
const { notifyVendorDeliveryStatusChange } = require("../lib/expoPush");

module.exports = {
  notifyVendorDeliveryStatusChange,
};

