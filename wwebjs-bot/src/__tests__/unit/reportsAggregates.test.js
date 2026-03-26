"use strict";

const { buildReportPdfData } = require("../../lib/reportAggregates");

describe("buildReportPdfData", () => {
  it("computes totalEncaisse from delivered and pickup only (amount_paid + delivery_fee)", () => {
    const deliveries = [
      {
        status: "delivered",
        quartier: "A",
        delivery_fee: 100,
        amount_paid: 900,
        amount_due: 1000,
      },
      {
        status: "pickup",
        quartier: "",
        delivery_fee: 1000,
        amount_paid: 0,
        amount_due: 0,
      },
      {
        status: "client_absent",
        quartier: "B",
        delivery_fee: 200,
        amount_paid: 0,
        amount_due: 0,
      },
    ];
    const out = buildReportPdfData(deliveries, {});
    // delivered: 900+100=1000; pickup: 0+1000=1000; client_absent does not add to encaisse
    expect(out.totalEncaisse).toBe(2000);
    expect(out.totalTarifs).toBe(100 + 1000 + 200);
    expect(out.netARever).toBe(out.totalEncaisse - out.totalTarifs);
  });

  it("groups quartier tariffs for delivered and client_absent with delivery_fee > 0", () => {
    const deliveries = [
      {
        status: "delivered",
        quartier: "Hay Hassani",
        delivery_fee: 150,
        amount_paid: 0,
        amount_due: 150,
      },
      {
        status: "client_absent",
        quartier: "Hay Hassani",
        delivery_fee: 150,
        amount_paid: 0,
        amount_due: 150,
      },
    ];
    const standardTariffs = { "Hay Hassani": 150 };
    const out = buildReportPdfData(deliveries, standardTariffs);
    const key = "Hay Hassani_150";
    expect(out.tarifsParQuartier[key]).toBeDefined();
    expect(out.tarifsParQuartier[key].count).toBe(2);
    expect(out.tarifsParQuartier[key].standardTariff).toBe(150);
    expect(out.tarifsParQuartier[key].total).toBe(300);
  });

  it("uses delivery_fee as standardTariff when DB standard differs from delivery_fee", () => {
    const deliveries = [
      {
        status: "delivered",
        quartier: "X",
        delivery_fee: 200,
        amount_paid: 0,
        amount_due: 200,
      },
    ];
    const out = buildReportPdfData(deliveries, { X: 150 });
    const key = "X_200";
    expect(out.tarifsParQuartier[key].standardTariff).toBe(200);
  });

  it("counts fixed-status pickup and present zones in fixedStatusTarifs", () => {
    const deliveries = [
      {
        status: "pickup",
        quartier: "",
        delivery_fee: 1000,
        amount_paid: 0,
        amount_due: 0,
      },
      {
        status: "present_ne_decroche_zone1",
        quartier: "",
        delivery_fee: 500,
        amount_paid: 0,
        amount_due: 0,
      },
      {
        status: "present_ne_decroche_zone2",
        quartier: "",
        delivery_fee: 1000,
        amount_paid: 0,
        amount_due: 0,
      },
    ];
    const out = buildReportPdfData(deliveries, {});
    expect(out.fixedStatusTarifs.pickup.count).toBe(1);
    expect(out.fixedStatusTarifs.pickup.total).toBe(1000);
    expect(out.fixedStatusTarifs.present_ne_decroche_zone1.total).toBe(500);
    expect(out.fixedStatusTarifs.present_ne_decroche_zone2.total).toBe(1000);
  });

  it("netARever does not include expedition fees (those are deducted in the route, not here)", () => {
    // buildReportPdfData is a pure delivery aggregator.
    // The expedition fee deduction (resteAPercevoir) is computed by the PDF route separately.
    const deliveries = [
      { status: "delivered", quartier: "Akwa", delivery_fee: 1000, amount_paid: 9000, amount_due: 10000 },
    ];
    const out = buildReportPdfData(deliveries, {});
    // netARever = totalEncaisse - totalTarifs = 10000 - 1000 = 9000
    expect(out.netARever).toBe(9000);
    // The caller (route) then subtracts expedition frais_de_course from netARever to get resteAPercevoir
  });

  it("maps allLivraisonsDetails amountPaid by status rules", () => {
    const deliveries = [
      {
        status: "delivered",
        quartier: "A",
        delivery_fee: 10,
        amount_paid: 90,
        amount_due: 100,
        phone: "1",
      },
      {
        status: "pickup",
        quartier: "",
        delivery_fee: 1000,
        amount_paid: 0,
        amount_due: 0,
        phone: "2",
      },
      {
        status: "client_absent",
        quartier: "B",
        delivery_fee: 50,
        amount_paid: 0,
        amount_due: 50,
        phone: "3",
      },
      {
        status: "present_ne_decroche_zone1",
        quartier: "",
        delivery_fee: 500,
        amount_paid: 0,
        amount_due: 0,
        phone: "4",
      },
      {
        status: "pending",
        quartier: "C",
        delivery_fee: 0,
        amount_paid: 0,
        amount_due: 100,
        phone: "5",
      },
    ];
    const out = buildReportPdfData(deliveries, {});
    const byPhone = Object.fromEntries(
      out.allLivraisonsDetails.map((d) => [d.phone, d.amountPaid])
    );
    expect(byPhone["1"]).toBe(100);
    expect(byPhone["2"]).toBe(1000);
    expect(byPhone["3"]).toBe(50);
    expect(byPhone["4"]).toBe(0);
    expect(byPhone["5"]).toBe(0);
  });
});
