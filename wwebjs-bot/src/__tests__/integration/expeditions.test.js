"use strict";

const request = require("supertest");
const { createTestToken, createSuperAdminToken } = require("../helpers/createAuthToken");

const mockCreateExpedition = jest.fn();
const mockGetExpeditions = jest.fn();
const mockGetExpeditionById = jest.fn();
const mockUpdateExpedition = jest.fn();
const mockDeleteExpedition = jest.fn();
const mockGetExpeditionStats = jest.fn();
const mockGetGroupById = jest.fn();

jest.mock("../../db", () => ({
  adapter: { query: jest.fn(), type: "sqlite" },
  createExpedition: mockCreateExpedition,
  getExpeditions: mockGetExpeditions,
  getExpeditionById: mockGetExpeditionById,
  updateExpedition: mockUpdateExpedition,
  deleteExpedition: mockDeleteExpedition,
  getExpeditionStats: mockGetExpeditionStats,
  getGroupById: mockGetGroupById,
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
  getAllGroups: jest.fn(),
  getGroupsByAgency: jest.fn(),
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
}));

const app = require("../../api/server");
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

describe("GET /api/v1/expeditions", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/expeditions");
    expect(res.status).toBe(401);
  });

  it("returns agency-scoped expeditions for agency users", async () => {
    mockGetExpeditions.mockResolvedValueOnce({
      expeditions: [{ id: 1, agency_id: 1, group_id: 3 }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get("/api/v1/expeditions")
      .set("Authorization", `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(mockGetExpeditions).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1 })
    );
    expect(res.body.success).toBe(true);
  });

  it("lets super admin filter by agency_id", async () => {
    mockGetExpeditions.mockResolvedValueOnce({
      expeditions: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get("/api/v1/expeditions?agency_id=7")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(mockGetExpeditions).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 7 })
    );
  });
});

describe("POST /api/v1/expeditions", () => {
  const validPayload = {
    group_id: 3,
    destination: "Yaounde",
    agence_de_voyage: "Finex",
    frais_de_course: 5000,
    frais_de_lagence_de_voyage: 3200,
    status: "en_attente",
  };

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/v1/expeditions")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send({ destination: "Yaounde" });

    expect(res.status).toBe(400);
  });

  it("returns 403 when agency tries to create for another agency group", async () => {
    mockGetGroupById.mockResolvedValueOnce({ id: 3, agency_id: 2, name: "Other" });

    const res = await request(app)
      .post("/api/v1/expeditions")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });

  it("creates expedition successfully", async () => {
    mockGetGroupById.mockResolvedValueOnce({ id: 3, agency_id: 1, name: "G1" });
    mockCreateExpedition.mockResolvedValueOnce(11);
    mockGetExpeditionById.mockResolvedValueOnce({ id: 11, ...validPayload, agency_id: 1 });

    const res = await request(app)
      .post("/api/v1/expeditions")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(mockCreateExpedition).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_id: 1,
        group_id: 3,
        destination: "Yaounde",
      })
    );
  });
});

describe("GET /api/v1/expeditions/:id", () => {
  it("returns 403 when agency accesses another agency expedition", async () => {
    mockGetExpeditionById.mockResolvedValueOnce({ id: 1, agency_id: 8, group_id: 3 });

    const res = await request(app)
      .get("/api/v1/expeditions/1")
      .set("Authorization", `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/v1/expeditions/:id", () => {
  it("validates negative frais_de_course", async () => {
    mockGetExpeditionById.mockResolvedValueOnce({ id: 5, agency_id: 1, group_id: 3 });

    const res = await request(app)
      .put("/api/v1/expeditions/5")
      .set("Authorization", `Bearer ${agencyToken}`)
      .send({ frais_de_course: -1 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/expeditions/stats/summary", () => {
  it("returns scoped stats", async () => {
    mockGetExpeditionStats.mockResolvedValueOnce({
      total_expeditions: 2,
      total_frais_de_course: 10000,
      total_frais_de_lagence_de_voyage: 7000,
    });

    const res = await request(app)
      .get("/api/v1/expeditions/stats/summary")
      .set("Authorization", `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(mockGetExpeditionStats).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1 })
    );
    expect(res.body.data.total_frais_de_lagence_de_voyage).toBe(7000);
  });
});

describe("DELETE /api/v1/expeditions/:id", () => {
  it("deletes expedition when authorized", async () => {
    mockGetExpeditionById.mockResolvedValueOnce({ id: 7, agency_id: 1, group_id: 3 });
    mockDeleteExpedition.mockResolvedValueOnce({ changes: 1 });

    const res = await request(app)
      .delete("/api/v1/expeditions/7")
      .set("Authorization", `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(mockDeleteExpedition).toHaveBeenCalledWith(7);
  });
});
