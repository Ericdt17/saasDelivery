"use strict";

const originalFetch = global.fetch;

describe("botAlerts HR check-in notifications", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.HR_ALERT_WEBHOOK_URL;
    delete process.env.HR_ALERT_COOLDOWN_MS;
    jest.resetModules();
  });

  it("buildHrCheckinAlertMessage formats kind, email, message, path", () => {
    const { buildHrCheckinAlertMessage } = require("../../lib/botAlerts");
    const text = buildHrCheckinAlertMessage({
      kind: "geo_denied",
      email: "ada@example.com",
      message: "Position refused",
      detail: "code=1",
      path: "/api/v1/hr/checkin/client-error",
    });
    expect(text).toContain("[LivSight HR]");
    expect(text).toContain("geo_denied");
    expect(text).toContain("ada@example.com");
    expect(text).toContain("Position refused");
    expect(text).toContain("code=1");
    expect(text).toContain("/api/v1/hr/checkin/client-error");
    expect(text.length).toBeLessThanOrEqual(2000);
  });

  it("notifyHrCheckinAlert posts to HR_ALERT_WEBHOOK_URL", async () => {
    process.env.HR_ALERT_WEBHOOK_URL = "https://discord.com/api/webhooks/hr-test";
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { notifyHrCheckinAlert } = require("../../lib/botAlerts");
    await notifyHrCheckinAlert({
      kind: "face_mismatch",
      email: "ada@example.com",
      message: "Face mismatch",
      path: "/api/v1/hr/checkin",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(
      "https://discord.com/api/webhooks/hr-test"
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.content).toContain("face_mismatch");
    expect(body.content).toContain("ada@example.com");
  });

  it("notifyHrCheckinAlert skips when webhook URL is unset", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const { notifyHrCheckinAlert } = require("../../lib/botAlerts");
    await notifyHrCheckinAlert({
      kind: "out_of_range",
      email: "ada@example.com",
      message: "Too far",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("notifyHrCheckinAlert respects cooldown for same kind+email", async () => {
    process.env.HR_ALERT_WEBHOOK_URL = "https://discord.com/api/webhooks/hr-test";
    process.env.HR_ALERT_COOLDOWN_MS = "60000";
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { notifyHrCheckinAlert } = require("../../lib/botAlerts");
    await notifyHrCheckinAlert({
      kind: "geo_denied",
      email: "ada@example.com",
      message: "first",
    });
    await notifyHrCheckinAlert({
      kind: "geo_denied",
      email: "ada@example.com",
      message: "second",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
