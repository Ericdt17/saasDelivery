"use strict";

const request = require("supertest");
const { createTestToken, createSuperAdminToken } = require("../helpers/createAuthToken");

const mockCreateAgencyReminderContact = jest.fn();
const mockGetAgencyReminderContacts = jest.fn();
const mockGetAgencyReminderContactById = jest.fn();
const mockUpdateAgencyReminderContact = jest.fn();
const mockDeleteAgencyReminderContact = jest.fn();

const mockCreateReminder = jest.fn();
const mockGetReminders = jest.fn();
const mockGetReminderById = jest.fn();
const mockGetReminderTargets = jest.fn();
const mockCancelReminder = jest.fn();
const mockDeleteReminder = jest.fn();
const mockRetryReminderFailed = jest.fn();
const mockGetGroupsByAgency = jest.fn();
const mockGetAllActiveGroupsForBroadcast = jest.fn();

jest.mock("../../db", () => ({
  adapter: { query: jest.fn(), type: "sqlite" },

  // reminders contacts
  createAgencyReminderContact: mockCreateAgencyReminderContact,
  getAgencyReminderContacts: mockGetAgencyReminderContacts,
  getAgencyReminderContactById: mockGetAgencyReminderContactById,
  updateAgencyReminderContact: mockUpdateAgencyReminderContact,
  deleteAgencyReminderContact: mockDeleteAgencyReminderContact,

  // reminders
  createReminder: mockCreateReminder,
  getReminders: mockGetReminders,
  getReminderById: mockGetReminderById,
  getReminderTargets: mockGetReminderTargets,
  cancelReminder: mockCancelReminder,
  deleteReminder: mockDeleteReminder,
  retryReminderFailed: mockRetryReminderFailed,
  getGroupsByAgency: mockGetGroupsByAgency,
  getAllActiveGroupsForBroadcast: mockGetAllActiveGroupsForBroadcast,

  // stubs required by mounted routes
  getAllDeliveries: jest.fn(),
  getDeliveryById: jest.fn(),
  createDelivery: jest.fn(),
  updateDelivery: jest.fn(),
  deleteDelivery: jest.fn(),
  getDeliveryHistory: jest.fn(),
  saveHistory: jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  getDeliveryStats: jest.fn(),
  getAgencyByEmail: jest.fn(),
  createAgency: jest.fn(),
  getAllAgencies: jest.fn(),
  getAgencyById: jest.fn(),
  updateAgency: jest.fn(),
  deleteAgency: jest.fn(),
  findAgencyByCode: jest.fn(),
  getAllGroups: jest.fn(),
  getGroupById: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  hardDeleteGroup: jest.fn(),
  getAllTariffs: jest.fn(),
  getTariffsByAgency: jest.fn(),
  getTariffById: jest.fn(),
  createTariff: jest.fn(),
  updateTariff: jest.fn(),
  deleteTariff: jest.fn(),
  getDeliveries: jest.fn(),
  getDailyStats: jest.fn(),
  searchDeliveries: jest.fn(),
  // expeditions stubs
  createExpedition: jest.fn(),
  getExpeditions: jest.fn(),
  getExpeditionById: jest.fn(),
  updateExpedition: jest.fn(),
  deleteExpedition: jest.fn(),
  getExpeditionStats: jest.fn(),
}));

const app = require("../../api/server");
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

describe("Reminder contacts", () => {
  it("GET /api/v1/reminder-contacts returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/reminder-contacts");
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/reminder-contacts scopes by agency for agency users", async () => {
    mockGetAgencyReminderContacts.mockResolvedValueOnce([{ id: 1, agency_id: 1 }]);
    const res = await request(app)
      .get("/api/v1/reminder-contacts")
      .set("Authorization", `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(mockGetAgencyReminderContacts).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1 })
    );
  });

  it("POST /api/v1/reminder-contacts forces agency_id for agency users", async () => {
    mockCreateAgencyReminderContact.mockResolvedValueOnce(10);
    mockGetAgencyReminderContactById.mockResolvedValueOnce({ id: 10, agency_id: 1 });

    const res = await request(app)
      .post("/api/v1/reminder-contacts")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send({ label: "Chef", phone: "+237 690 000 000", agency_id: 999 });

    expect(res.status).toBe(201);
    expect(mockCreateAgencyReminderContact).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1 })
    );
  });

  it("POST /api/v1/reminder-contacts requires agency_id for super admin", async () => {
    const res = await request(app)
      .post("/api/v1/reminder-contacts")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ label: "Chef", phone: "+237690000000" });

    expect(res.status).toBe(400);
  });
});

describe("Reminders", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("GET /api/v1/reminders returns progress_percent values", async () => {
    mockGetReminders.mockResolvedValueOnce([
      { id: 1, total_targets: 10, sent_count: 4, failed_count: 1, skipped_count: 1 },
      { id: 2, total_targets: 0, sent_count: 0, failed_count: 0, skipped_count: 0 },
    ]);

    const res = await request(app)
      .get("/api/v1/reminders?agency_id=1")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].progress_percent).toBe(60);
    expect(res.body.data[1].progress_percent).toBe(0);
  });

  it("GET /api/v1/reminders/:id returns 404 when reminder missing", async () => {
    mockGetReminderById.mockResolvedValueOnce(null);
    const res = await request(app)
      .get("/api/v1/reminders/999")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/reminders/:id blocks agency user from another agency", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 77, agency_id: 999 });
    const res = await request(app)
      .get("/api/v1/reminders/77")
      .set("Authorization", `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/v1/reminders/:id blocks agency user from global broadcast reminder", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 88, agency_id: null, audience_mode: "all_groups" });
    const res = await request(app)
      .get("/api/v1/reminders/88")
      .set("Authorization", `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/v1/reminders/:id includes targets when allowed", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 55, agency_id: 1, status: "scheduled" });
    mockGetReminderTargets.mockResolvedValueOnce([{ id: 1, target_type: "contact", target_value: "237690000111" }]);
    const res = await request(app)
      .get("/api/v1/reminders/55")
      .set("Authorization", `Bearer ${agencyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.targets).toHaveLength(1);
  });

  it("POST /api/v1/reminders is super admin only", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send({ agency_id: 1, contact_id: 1, message: "Hi", send_at: new Date().toISOString() });

    expect(res.status).toBe(403);
  });

  it("POST /api/v1/reminders validates contact belongs to agency", async () => {
    mockGetAgencyReminderContacts.mockResolvedValueOnce([]);

    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ agency_id: 1, contact_ids: [1], audience_mode: "contacts", message: "Hi", send_at: new Date().toISOString() });

    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders schedules reminder", async () => {
    mockGetAgencyReminderContacts.mockResolvedValueOnce([{ id: 2, agency_id: 1, phone: "+237690000111" }]);
    mockCreateReminder.mockResolvedValueOnce(55);
    mockGetReminderById.mockResolvedValueOnce({ id: 55, agency_id: 1, status: "scheduled" });

    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ agency_id: 1, contact_ids: [2], audience_mode: "contacts", message: "Hi", send_at: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(mockCreateReminder).toHaveBeenCalled();
  });

  it("POST /api/v1/reminders validates audience mode", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ agency_id: 1, audience_mode: "bad_mode", message: "Hi", send_at: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders validates interval values", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "quick_numbers",
        quick_numbers: ["+237690000001"],
        send_interval_min_sec: 120,
        send_interval_max_sec: 60,
        message: "Hi",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders validates HH:mm window format", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "quick_numbers",
        quick_numbers: ["+237690000001"],
        window_start: "25:99",
        message: "Hi",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders validates send_at datetime", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "quick_numbers",
        quick_numbers: ["+237690000001"],
        message: "Hi",
        send_at: "not-a-date",
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders with groups builds targets", async () => {
    mockGetGroupsByAgency.mockResolvedValueOnce([
      { id: 10, whatsapp_group_id: "group-10@g.us" },
      { id: 11, whatsapp_group_id: "group-11@g.us" },
    ]);
    mockCreateReminder.mockResolvedValueOnce(66);
    mockGetReminderById.mockResolvedValueOnce({ id: 66, agency_id: 1, status: "scheduled" });
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "groups",
        group_ids: [10],
        message: "Group reminder",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect(mockCreateReminder).toHaveBeenCalledWith(expect.objectContaining({
      audience_mode: "groups",
      targets: [{ target_type: "group", target_value: "group-10@g.us" }],
    }));
  });

  it("POST /api/v1/reminders with all_groups builds targets without agency_id", async () => {
    mockGetAllActiveGroupsForBroadcast.mockResolvedValueOnce([
      { id: 1, whatsapp_group_id: "a@g.us" },
      { id: 2, whatsapp_group_id: "b@g.us" },
    ]);
    mockCreateReminder.mockResolvedValueOnce(77);
    mockGetReminderById.mockResolvedValueOnce({ id: 77, agency_id: null, status: "scheduled", audience_mode: "all_groups" });
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        audience_mode: "all_groups",
        message: "Broadcast",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect(mockCreateReminder).toHaveBeenCalledWith(expect.objectContaining({
      agency_id: null,
      audience_mode: "all_groups",
      targets: [
        { target_type: "group", target_value: "a@g.us" },
        { target_type: "group", target_value: "b@g.us" },
      ],
    }));
  });

  it("POST /api/v1/reminders with all_groups rejects when no active groups", async () => {
    mockGetAllActiveGroupsForBroadcast.mockResolvedValueOnce([]);
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        audience_mode: "all_groups",
        message: "Broadcast",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
    expect(mockCreateReminder).not.toHaveBeenCalled();
  });

  it("POST /api/v1/reminders requires agency_id when not all_groups", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        audience_mode: "contacts",
        contact_ids: [1],
        message: "Hi",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders with quick_numbers normalizes and deduplicates targets", async () => {
    mockCreateReminder.mockResolvedValueOnce(67);
    mockGetReminderById.mockResolvedValueOnce({ id: 67, agency_id: 1, status: "scheduled" });
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "quick_numbers",
        quick_numbers: ["+237 690 00 00 01", "237690000001", "invalid-number"],
        message: "Quick reminder",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect(mockCreateReminder).toHaveBeenCalledWith(expect.objectContaining({
      targets: [{ target_type: "quick_number", target_value: "237690000001" }],
    }));
  });

  it("POST /api/v1/reminders rejects when no valid target exists", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "quick_numbers",
        quick_numbers: ["---", ""],
        message: "Quick reminder",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders rejects contact_id not in agency", async () => {
    mockGetAgencyReminderContacts.mockResolvedValueOnce([{ id: 3, agency_id: 1, phone: "+237690000333" }]);
    mockGetAgencyReminderContactById.mockResolvedValueOnce({ id: 3, agency_id: 2 });
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        agency_id: 1,
        audience_mode: "contacts",
        contact_id: 3,
        contact_ids: [3],
        message: "Hi",
        send_at: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders/:id/cancel returns 404 when reminder missing", async () => {
    mockGetReminderById.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/v1/reminders/10/cancel")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it("POST /api/v1/reminders/:id/cancel cancels when reminder exists", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 10, status: "running" });
    mockCancelReminder.mockResolvedValueOnce({ changes: 1 });
    const res = await request(app)
      .post("/api/v1/reminders/10/cancel")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(mockCancelReminder).toHaveBeenCalledWith(10);
  });

  it("DELETE /api/v1/reminders/:id deletes reminder when found", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 11, status: "scheduled" });
    mockDeleteReminder.mockResolvedValueOnce({ changes: 1 });
    const res = await request(app)
      .delete("/api/v1/reminders/11")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(mockDeleteReminder).toHaveBeenCalledWith(11);
  });

  it("POST /api/v1/reminders/:id/retry-failed rejects cancelled reminders", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 12, status: "cancelled" });
    const res = await request(app)
      .post("/api/v1/reminders/12/retry-failed")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders/:id/retry-failed calls retry action", async () => {
    mockGetReminderById.mockResolvedValueOnce({ id: 55, status: "running" });
    mockRetryReminderFailed.mockResolvedValueOnce({ changes: 1 });
    const res = await request(app)
      .post("/api/v1/reminders/55/retry-failed")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(mockRetryReminderFailed).toHaveBeenCalledWith(55);
  });
});

