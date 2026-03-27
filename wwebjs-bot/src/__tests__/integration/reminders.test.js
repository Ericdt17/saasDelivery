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
const mockCancelReminder = jest.fn();

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
  cancelReminder: mockCancelReminder,

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
  getGroupsByAgency: jest.fn(),
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
  it("POST /api/v1/reminders is super admin only", async () => {
    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send({ agency_id: 1, contact_id: 1, message: "Hi", send_at: new Date().toISOString() });

    expect(res.status).toBe(403);
  });

  it("POST /api/v1/reminders validates contact belongs to agency", async () => {
    mockGetAgencyReminderContactById.mockResolvedValueOnce({ id: 1, agency_id: 2 });

    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ agency_id: 1, contact_id: 1, message: "Hi", send_at: new Date().toISOString() });

    expect(res.status).toBe(400);
  });

  it("POST /api/v1/reminders schedules reminder", async () => {
    mockGetAgencyReminderContactById.mockResolvedValueOnce({ id: 2, agency_id: 1 });
    mockCreateReminder.mockResolvedValueOnce(55);
    mockGetReminderById.mockResolvedValueOnce({ id: 55, agency_id: 1, status: "scheduled" });

    const res = await request(app)
      .post("/api/v1/reminders")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ agency_id: 1, contact_id: 2, message: "Hi", send_at: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(mockCreateReminder).toHaveBeenCalled();
  });
});

