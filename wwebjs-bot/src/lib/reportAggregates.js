"use strict";

/**
 * PDF group report aggregates — pure functions over delivery rows + optional standard tariffs map.
 * @param {Array<object>} deliveries
 * @param {Record<string, number>} standardTariffs quartier -> tarif_amount from DB
 */
function buildReportPdfData(deliveries, standardTariffs = {}) {
  const deliveriesWithTariffs = deliveries.filter(
    (d) =>
      d.status === "delivered" ||
      d.status === "client_absent" ||
      d.status === "pickup" ||
      d.status === "present_ne_decroche_zone1" ||
      d.status === "present_ne_decroche_zone2"
  );

  const deliveredAndPickupDeliveries = deliveries.filter(
    (d) => d.status === "delivered" || d.status === "pickup"
  );

  let totalEncaisse = 0;
  let totalTarifs = 0;
  const tarifsParQuartier = {};

  deliveredAndPickupDeliveries.forEach((delivery) => {
    const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
    const amountPaid = parseFloat(delivery.amount_paid) || 0;
    const amountPaidBrut = amountPaid + deliveryFee;
    totalEncaisse += amountPaidBrut;
  });

  const fixedStatusTarifs = {
    pickup: { label: "Au bureau", count: 0, total: 0, fixedTariff: 1000 },
    present_ne_decroche_zone1: {
      label: "CPCNDP Z1",
      count: 0,
      total: 0,
      fixedTariff: 500,
    },
    present_ne_decroche_zone2: {
      label: "CPCNDP Z2",
      count: 0,
      total: 0,
      fixedTariff: 1000,
    },
  };

  deliveriesWithTariffs.forEach((delivery) => {
    const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
    totalTarifs += deliveryFee;

    if (
      delivery.status === "pickup" ||
      delivery.status === "present_ne_decroche_zone1" ||
      delivery.status === "present_ne_decroche_zone2"
    ) {
      if (fixedStatusTarifs[delivery.status]) {
        fixedStatusTarifs[delivery.status].count += 1;
        fixedStatusTarifs[delivery.status].total += deliveryFee;
      }
    } else if (
      (delivery.status === "delivered" || delivery.status === "client_absent") &&
      delivery.quartier &&
      deliveryFee > 0
    ) {
      const tariffKey = `${delivery.quartier}_${deliveryFee}`;
      if (!tarifsParQuartier[tariffKey]) {
        tarifsParQuartier[tariffKey] = {
          quartier: delivery.quartier,
          count: 0,
          total: 0,
          deliveryFee: deliveryFee,
        };
      }
      tarifsParQuartier[tariffKey].count += 1;
      tarifsParQuartier[tariffKey].total += deliveryFee;
    }
  });

  const netARever = totalEncaisse - totalTarifs;

  // Normalise standardTariffs keys to lowercase for case-insensitive lookup
  const normalisedTariffs = {};
  Object.keys(standardTariffs).forEach((k) => {
    normalisedTariffs[k.toLowerCase()] = standardTariffs[k];
  });

  Object.keys(tarifsParQuartier).forEach((tariffKey) => {
    const quartierData = tarifsParQuartier[tariffKey];
    const standardTariff = normalisedTariffs[quartierData.quartier.toLowerCase()];
    if (
      standardTariff !== undefined &&
      Math.abs(quartierData.deliveryFee - standardTariff) < 0.01
    ) {
      quartierData.standardTariff = standardTariff;
    } else {
      quartierData.standardTariff = quartierData.deliveryFee;
    }
    quartierData.total = quartierData.deliveryFee * quartierData.count;
  });

  const allLivraisonsDetails = deliveries.map((delivery) => {
    const amountDue = parseFloat(delivery.amount_due) || 0;
    const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
    const amountPaid = parseFloat(delivery.amount_paid) || 0;
    let amountPaidBrut;
    if (delivery.status === "delivered" || delivery.status === "pickup") {
      amountPaidBrut = amountPaid + deliveryFee;
    } else if (delivery.status === "client_absent") {
      amountPaidBrut = deliveryFee;
    } else if (
      delivery.status === "present_ne_decroche_zone1" ||
      delivery.status === "present_ne_decroche_zone2"
    ) {
      amountPaidBrut = 0;
    } else {
      amountPaidBrut = amountPaid;
    }
    return {
      quartier: delivery.quartier || "",
      phone: delivery.phone || "",
      status: delivery.status || "pending",
      amountDue: amountDue,
      amountPaid: amountPaidBrut,
    };
  });

  return {
    totalEncaisse,
    totalTarifs,
    netARever,
    fixedStatusTarifs,
    tarifsParQuartier,
    allLivraisonsDetails,
  };
}

module.exports = {
  buildReportPdfData,
};
