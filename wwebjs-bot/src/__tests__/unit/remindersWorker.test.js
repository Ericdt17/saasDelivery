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

  it("marks target skipped when outside configured window", async () => {
    const client = { sendMessage: jest.fn() };
    const localeSpy = jest.spyOn(Date.prototype, "toLocaleString").mockReturnValue("12:00");
    db.pollQueuedReminderTargets.mockResolvedValueOnce([
      {
        target_id: 3,
        reminder_id: 12,
        target_type: "quick_number",
        target_value: "+237690000003",
        message: "Outside window",
        timezone: "UTC",
        window_start: "13:00",
        window_end: "14:00",
        send_interval_min_sec: 0,
        send_interval_max_sec: 0,
      },
    ]);
    db.markReminderTargetProcessing.mockResolvedValueOnce({ changes: 1 });
    db.updateReminderTargetStatus.mockResolvedValueOnce({ changes: 1 });

    const worker = createRemindersWorker({ client, pollIntervalMs: 999999, batchSize: 50, logger: { error: jest.fn() } });
    await worker.tick();

    expect(client.sendMessage).not.toHaveBeenCalled();
    expect(db.updateReminderTargetStatus).toHaveBeenCalledWith(3, "skipped", "Outside configured send window");
    localeSpy.mockRestore();
  });

  it("marks target failed when chat id is invalid", async () => {
    const client = { sendMessage: jest.fn() };
    db.pollQueuedReminderTargets.mockResolvedValueOnce([
      {
        target_id: 4,
        reminder_id: 13,
        target_type: "quick_number",
        target_value: "",
        message: "Invalid target",
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

    expect(client.sendMessage).not.toHaveBeenCalled();
    expect(db.updateReminderTargetStatus).toHaveBeenCalledWith(4, "failed", "Invalid target phone");
  });

  it("sends group targets with @g.us suffix", async () => {
    const client = { sendMessage: jest.fn().mockResolvedValueOnce(true) };
    db.pollQueuedReminderTargets.mockResolvedValueOnce([
      {
        target_id: 5,
        reminder_id: 14,
        target_type: "group",
        target_value: "123456",
        message: "Group ping",
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

    expect(client.sendMessage).toHaveBeenCalledWith("123456@g.us", "Group ping");
    expect(db.updateReminderTargetStatus).toHaveBeenCalledWith(5, "sent", null);
  });

  it("logs worker errors when polling fails", async () => {
    const logger = { error: jest.fn() };
    const client = { sendMessage: jest.fn() };
    db.pollQueuedReminderTargets.mockRejectedValueOnce(new Error("db down"));

    const worker = createRemindersWorker({ client, pollIntervalMs: 999999, batchSize: 50, logger });
    await worker.tick();

    expect(logger.error).toHaveBeenCalled();
  });
});

