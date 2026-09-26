"use strict";

const {
  sendTextDm,
  sendDocumentDm,
  WhatsAppBotError,
  isWhatsAppBotEnabled,
} = require("../../lib/whatsappBotClient");

describe("whatsappBotClient", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.WHATSAPP_BOT_BASE_URL = "http://bot.test:3099/";
    process.env.WHATSAPP_BOT_INTERNAL_TOKEN = "secret-token";
    process.env.WHATSAPP_BOT_ENABLED = "true";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.WHATSAPP_BOT_BASE_URL;
    delete process.env.WHATSAPP_BOT_INTERNAL_TOKEN;
    delete process.env.WHATSAPP_BOT_ENABLED;
  });

  function mockJson(status, body) {
    global.fetch.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
  }

  it("isWhatsAppBotEnabled reflects WHATSAPP_BOT_ENABLED", () => {
    expect(isWhatsAppBotEnabled()).toBe(true);
    process.env.WHATSAPP_BOT_ENABLED = "false";
    expect(isWhatsAppBotEnabled()).toBe(false);
  });

  it("POSTs text DM with internal token", async () => {
    mockJson(200, {
      success: true,
      sent: true,
      recipient: "237690000000@c.us",
      message_id: "msg-1",
    });

    const result = await sendTextDm({
      recipientPhone: "690000000",
      message: "Voici votre bulletin",
    });

    expect(result.messageId).toBe("msg-1");
    const [url, opts] = global.fetch.mock.calls[0];
    expect(String(url)).toBe("http://bot.test:3099/internal/send-text-dm");
    expect(opts.headers["X-Bot-Internal-Token"]).toBe("secret-token");
    expect(JSON.parse(opts.body).message).toBe("Voici votre bulletin");
  });

  it("POSTs PDF DM with internal token", async () => {
    mockJson(200, {
      success: true,
      sent: true,
      recipient: "237690000000@c.us",
      message_id: "msg-1",
      filename: "bulletin.pdf",
    });

    const result = await sendDocumentDm({
      recipientPhone: "690000000",
      filename: "bulletin.pdf",
      pdfBase64: "JVBERi0=",
      caption: "Bulletin",
    });

    expect(result.messageId).toBe("msg-1");
    const [url] = global.fetch.mock.calls[0];
    expect(String(url)).toBe("http://bot.test:3099/internal/send-document-dm");
  });

  it("throws when disabled", async () => {
    process.env.WHATSAPP_BOT_ENABLED = "false";
    await expect(
      sendTextDm({ recipientPhone: "690000000", message: "x" })
    ).rejects.toMatchObject({ code: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws unauthorized on 401", async () => {
    mockJson(401, { error: "unauthorized" });
    await expect(
      sendTextDm({ recipientPhone: "690000000", message: "x" })
    ).rejects.toBeInstanceOf(WhatsAppBotError);
  });
});
