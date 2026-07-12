"use strict";

const originalFetch = global.fetch;

describe("botAlerts startup notifications", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BOT_ALERT_WEBHOOK_URL;
    delete process.env.BOT_ALERT_STARTUP_ENABLED;
    delete process.env.DEPLOY_GIT_SHA;
    delete process.env.NODE_ENV;
    jest.resetModules();
  });

  it("buildApiStartupMessage includes port, commit, groups, and env", () => {
    process.env.DEPLOY_GIT_SHA = "abc1234";
    process.env.NODE_ENV = "production";
    const { buildApiStartupMessage } = require("../../lib/botAlerts");

    const message = buildApiStartupMessage({
      port: 3001,
      activeGroups: 94,
      gitSha: "def5678",
    });

    expect(message).toContain("LivSight API démarrée");
    expect(message).toContain("Port : 3001");
    expect(message).toContain("Commit : def5678");
    expect(message).toContain("94 groupes actifs");
    expect(message).toContain("Env : production");
  });

  it("notifyApiStartup posts to BOT_ALERT_WEBHOOK_URL when enabled", async () => {
    process.env.BOT_ALERT_WEBHOOK_URL = "https://discord.com/api/webhooks/test";
    process.env.BOT_ALERT_STARTUP_ENABLED = "true";

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { notifyApiStartup } = require("../../lib/botAlerts");
    await notifyApiStartup({ port: 3001, activeGroups: 12 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(process.env.BOT_ALERT_WEBHOOK_URL);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.content).toContain("LivSight API démarrée");
    expect(body.content).toContain("12 groupes actifs");
  });

  it("notifyApiStartup skips when BOT_ALERT_STARTUP_ENABLED=false", async () => {
    process.env.BOT_ALERT_WEBHOOK_URL = "https://discord.com/api/webhooks/test";
    process.env.BOT_ALERT_STARTUP_ENABLED = "false";

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { notifyApiStartup } = require("../../lib/botAlerts");
    await notifyApiStartup({ port: 3001, activeGroups: 12 });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("notifyApiStartup skips when webhook URL is unset", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const { notifyApiStartup } = require("../../lib/botAlerts");
    await notifyApiStartup({ port: 3001, activeGroups: 12 });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
