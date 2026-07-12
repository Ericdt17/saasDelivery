"use strict";

const {
  computeTariffPending,
  roundAmount,
  computeAmountPaidAfterFee,
} = require("../../lib/deliveryCalculations");

describe("computeTariffPending", () => {
  it("returns true when status=pending, quartier set, no fee", () => {
    expect(computeTariffPending("pending", "Akwa", null)).toBe(true);
  });

  it("returns true when fee is 0", () => {
    expect(computeTariffPending("pending", "Makepe", 0)).toBe(true);
  });

  it("returns false when delivery_fee > 0", () => {
    expect(computeTariffPending("pending", "Bonapriso", 1000)).toBe(false);
  });

  it("returns false when status is not pending", () => {
    expect(computeTariffPending("delivered", "Akwa", null)).toBe(false);
    expect(computeTariffPending("failed", "Akwa", null)).toBe(false);
    expect(computeTariffPending("pickup", "Akwa", null)).toBe(false);
  });

  it("returns false when quartier is missing", () => {
    expect(computeTariffPending("pending", null, null)).toBe(false);
    expect(computeTariffPending("pending", "", null)).toBe(false);
    expect(computeTariffPending("pending", "   ", null)).toBe(false);
  });

  it("is case-insensitive for status", () => {
    expect(computeTariffPending("PENDING", "Akwa", null)).toBe(true);
  });
});

describe("roundAmount", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundAmount(10.999)).toBe(11);
    expect(roundAmount(10.005)).toBeCloseTo(10.01);
    expect(roundAmount(10.004)).toBeCloseTo(10);
  });

  it("handles whole numbers", () => {
    expect(roundAmount(15000)).toBe(15000);
  });
});

describe("computeAmountPaidAfterFee", () => {
  it("subtracts delivery_fee from amount_due", () => {
    expect(computeAmountPaidAfterFee(5000, 1000)).toBe(4000);
  });

  it("returns 0 when fee exceeds amount_due (never negative)", () => {
    expect(computeAmountPaidAfterFee(500, 1000)).toBe(0);
  });

  it("handles fixed pickup tariff of 1000", () => {
    expect(computeAmountPaidAfterFee(15000, 1000)).toBe(14000);
  });

  it("handles fixed zone1 tariff of 500", () => {
    expect(computeAmountPaidAfterFee(3000, 500)).toBe(2500);
  });
});
