"use strict";

jest.mock("../../db", () => ({
  pollQueuedReminderTargets: jest.fn(),
  markReminderTargetProcessing: jest.fn(),
  updateReminderTargetStatus: jest.fn(),
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
    db.pollQueuedReminderTargets.mockResolvedValueOnce([
      {
        target_id: 1,
        reminder_id: 10,
        target_type: "quick_number",
        target_value: "+237690000001",
        message: "Hello",
        timezone: "UTC",
        window_start: null,
        window_end: null,
        send_interval_min_sec: 0,
        send_interval_max_sec: 0,
      },
    ]);
    db.markReminderTargetProcessing.mockResolvedValueOnce({ changes: 1 });
    db.updateReminderTargetStatus.mockResolvedValue({ changes: 1 });

    const worker = createRemindersWorker({ client, pollIntervalMs: 999999, batchSize: 50, logger: { error: jest.fn() } });
    await worker.tick();

    expect(client.sendMessage).toHaveBeenCalledWith("237690000001@c.us", "Hello");
    expect(db.updateReminderTargetStatus).toHaveBeenCalledWith(1, "sent", null);
  });

  it("marks reminder failed when sendMessage throws", async () => {
    const client = { sendMessage: jest.fn().mockRejectedValueOnce(new Error("send fail")) };
    db.pollQueuedReminderTargets.mockResolvedValueOnce([
      {
        target_id: 2,
        reminder_id: 11,
        target_type: "quick_number",
        target_value: "+237690000002",
        message: "Hi",
        timezone: "UTC",
        window_start: null,
        window_end: null,
        send_interval_min_sec: 0,
        send_interval_max_sec: 0,
      },
    ]);
    db.markReminderTargetProcessing.mockResolvedValueOnce({ changes: 1 });
    db.updateReminderTargetStatus.mockResolvedValueOnce({ changes: 1 });

    const worker = createRemindersWorker({ client, pollIntervalMs: 999999, batchSize: 50, logger: { error: jest.fn() } });
    await worker.tick();

    expect(db.updateReminderTargetStatus).toHaveBeenCalledWith(2, "failed", "send fail");
  });
});

