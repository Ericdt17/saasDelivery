"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createPayslipDownloadLink,
  resolvePayslipDownloadCode,
  DEFAULT_TTL_SECONDS,
  CODE_LENGTH,
} = require("../../lib/payslipDownloadToken");

describe("payslipDownloadLink (short codes)", () => {
  const prevPublic = process.env.PUBLIC_API_BASE_URL;
  const prevFile = process.env.PAYSLIP_LINKS_FILE;
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `payslip-links-${process.pid}-${Date.now()}.json`
    );
    process.env.PAYSLIP_LINKS_FILE = tmpFile;
    process.env.PUBLIC_API_BASE_URL = "http://api.test:3000";
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
    if (prevPublic === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = prevPublic;
    if (prevFile === undefined) delete process.env.PAYSLIP_LINKS_FILE;
    else process.env.PAYSLIP_LINKS_FILE = prevFile;
  });

  it("creates a short alphanumeric URL without query token", () => {
    const { code, url } = createPayslipDownloadLink({
      employeeId: 7,
      year: 2026,
      month: 9,
    });
    expect(code).toHaveLength(CODE_LENGTH);
    expect(code).toMatch(/^[A-Za-z0-9]+$/);
    expect(url).toBe(`http://api.test:3000/api/v1/hr/p/${code}`);
    expect(url).not.toMatch(/token=/);
    expect(url).not.toMatch(/_/);
  });

  it("resolves a created code", () => {
    const { code } = createPayslipDownloadLink({
      employeeId: 7,
      year: 2026,
      month: 9,
    });
    const verified = resolvePayslipDownloadCode(code);
    expect(verified.ok).toBe(true);
    expect(verified.employeeId).toBe(7);
    expect(verified.year).toBe(2026);
    expect(verified.month).toBe(9);
  });

  it("rejects unknown code", () => {
    expect(resolvePayslipDownloadCode("noSuchCode1")).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("rejects expired code", () => {
    const { code } = createPayslipDownloadLink({
      employeeId: 1,
      year: 2026,
      month: 1,
      ttlSeconds: 1,
    });
    const store = JSON.parse(fs.readFileSync(tmpFile, "utf8"));
    store[code].exp = Math.floor(Date.now() / 1000) - 10;
    fs.writeFileSync(tmpFile, JSON.stringify(store));
    expect(resolvePayslipDownloadCode(code)).toEqual({
      ok: false,
      error: "expired",
    });
  });

  it("defaults TTL to 7 days", () => {
    expect(DEFAULT_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });
});
