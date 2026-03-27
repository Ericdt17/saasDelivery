"use strict";

jest.mock("../../db", () => ({
  getDueReminders: jest.fn(),
  markReminderSent: jest.fn(),
  markReminderFailed: jest.fn(),
}));

const db = require("../../db");
const { createRemindersWorker, phoneToChatId } = require("../../reminders/worker");

describe("reminders worker utils", () => {
  it("phoneToChatId strips non-digits and appends @c.us", () => {
    expect(phoneToChatId("+237 6 90-12-34-56")).toBe("237690123456@c.us");
  });

  it("phoneToChatId returns null for empty input", () => {
    expect(phoneToChatId("")).toBeNull();
    expect(phoneToChatId(null)).toBeNull();
  });
});

describe("createRemindersWorker", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("sends due reminders and marks them sent", async () => {
    const client = { sendMessage: jest.fn().mockResolvedValueOnce(true) };
    db.getDueReminders.mockResolvedValueOnce([
      { id: 1, contact_phone: "+237690000001", message: "Hello" },
    ]);
    db.markReminderSent.mockResolvedValueOnce({ changes: 1 });
    db.markReminderFailed.mockResolvedValue({ changes: 1 });

    const worker = createRemindersWorker({ client, pollIntervalMs: 999999, batchSize: 50, logger: { error: jest.fn() } });
    await worker.tick();

    expect(client.sendMessage).toHaveBeenCalledWith("237690000001@c.us", "Hello");
    expect(db.markReminderSent).toHaveBeenCalledWith(1);
    expect(db.markReminderFailed).not.toHaveBeenCalled();
  });

  it("marks reminder failed when sendMessage throws", async () => {
    const client = { sendMessage: jest.fn().mockRejectedValueOnce(new Error("send fail")) };
    db.getDueReminders.mockResolvedValueOnce([
      { id: 2, contact_phone: "+237690000002", message: "Hi" },
    ]);
    db.markReminderSent.mockResolvedValue({ changes: 1 });
    db.markReminderFailed.mockResolvedValueOnce({ changes: 1 });

    const worker = createRemindersWorker({ client, pollIntervalMs: 999999, batchSize: 50, logger: { error: jest.fn() } });
    await worker.tick();

    expect(db.markReminderFailed).toHaveBeenCalledWith(2, "send fail");
    expect(db.markReminderSent).not.toHaveBeenCalled();
  });
});

