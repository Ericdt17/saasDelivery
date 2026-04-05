"use strict";

const {
  validateAndNormalizeAiDelivery,
  normalizePhoneString,
  coerceAmountFromModel,
  extractDeliveryWithAI,
} = require("../../lib/aiDeliveryExtract");

describe("normalizePhoneString", () => {
  it("normalizes 9-digit Cameroon phone", () => {
    expect(normalizePhoneString("6 12 34 56 78")).toBe("612345678");
  });

  it("returns null for invalid input", () => {
    expect(normalizePhoneString("")).toBe(null);
    expect(normalizePhoneString("12345")).toBe(null);
  });
});

describe("coerceAmountFromModel", () => {
  it("parses k suffix", () => {
    expect(coerceAmountFromModel("15k")).toBe(15000);
    expect(coerceAmountFromModel("18K")).toBe(18000);
  });

  it("accepts plain numbers", () => {
    expect(coerceAmountFromModel(6000)).toBe(6000);
    expect(coerceAmountFromModel("12000")).toBe(12000);
  });

  it("rejects tiny amounts", () => {
    expect(coerceAmountFromModel(50)).toBe(null);
  });
});

describe("validateAndNormalizeAiDelivery", () => {
  it("accepts model aligned with text (phone + amount from text)", () => {
    const text = "612345678\n2 robes\n15k\nAkwa";
    const out = validateAndNormalizeAiDelivery(
      { phone: "612345678", product: "2 robes", amount: 15000, location: "akwa" },
      text
    );
    expect(out).not.toBeNull();
    expect(out.phone).toBe("612345678");
    expect(out.amount_due).toBe(15000);
    expect(out.items).toMatch(/robe/i);
  });

  it("rejects when model amount disagrees with text beyond tolerance", () => {
    const text = "612345678\nx\n15k\nAkwa";
    const out = validateAndNormalizeAiDelivery(
      { phone: "612345678", product: "x", amount: 99999, location: "" },
      text
    );
    expect(out).toBeNull();
  });

  it("uses model phone and amount when text has no extractable fields", () => {
    const text = "please deliver to customer";
    const out = validateAndNormalizeAiDelivery(
      { phone: "612345678", product: "shoes", amount: 5000, location: "" },
      text
    );
    expect(out).not.toBeNull();
    expect(out.phone).toBe("612345678");
    expect(out.amount_due).toBe(5000);
  });

  it("returns null when neither text nor model yields a valid phone", () => {
    const text = "random chat no digits";
    const out = validateAndNormalizeAiDelivery(
      { phone: "", product: "x", amount: 5000, location: "" },
      text
    );
    expect(out).toBeNull();
  });

  it("accepts model-only phone when text has labeled number", () => {
    const text = "Numéro : 612345678\nMontant : 8000\nMakepe";
    const out = validateAndNormalizeAiDelivery(
      { phone: "612345678", product: "pack", amount: 8000, location: "Makepe" },
      text
    );
    expect(out).not.toBeNull();
    expect(out.amount_due).toBe(8000);
  });
});

describe("extractDeliveryWithAI", () => {
  it("returns no_api_key when key missing", async () => {
    const result = await extractDeliveryWithAI("hello", {
      OPENAI_API_KEY: null,
      AI_DELIVERY_TIMEOUT_MS: 5000,
      AI_DELIVERY_MAX_TOKENS: 300,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_api_key");
  });
});
