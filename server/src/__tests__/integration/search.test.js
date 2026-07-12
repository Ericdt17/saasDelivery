"use strict";

const request = require("supertest");
const { createTestToken } = require("../helpers/createAuthToken");

jest.mock("../../db", () => ({
  adapter: { query: jest.fn(), type: "sqlite" },
  getAllDeliveries: jest.fn(),
  getDeliveryById: jest.fn(),
  createDelivery: jest.fn(),
  updateDelivery: jest.fn(),
  deleteDelivery: jest.fn(),
  getDeliveryHistory: jest.fn(),
  saveHistory: jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  createAgency: jest.fn(),
  getAgencyByEmail: jest.fn(),
  getAllAgencies: jest.fn(),
  getAgencyById: jest.fn(),
  updateAgency: jest.fn(),
  deleteAgency: jest.fn(),
  getAllGroups: jest.fn(),
  getGroupById: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getAllTariffs: jest.fn(),
  getTariffById: jest.fn(),
  createTariff: jest.fn(),
  updateTariff: jest.fn(),
  deleteTariff: jest.fn(),
  getDailyStats: jest.fn(),
  searchDeliveries: jest.fn(),
}));

const { searchDeliveries } = require("../../db");
const app = require("../../api/server");

const token = createTestToken({ userId: 1, agencyId: 1 });

describe("GET /api/v1/search", () => {
  it("returns 400 when q is missing or empty", async () => {
    const resNoParam = await request(app)
      .get("/api/v1/search")
      .set("Authorization", `Bearer ${token}`);
    expect(resNoParam.status).toBe(400);
    expect(resNoParam.body.success).toBe(false);

    const resBlank = await request(app)
      .get("/api/v1/search?q=   ")
      .set("Authorization", `Bearer ${token}`);
    expect(resBlank.status).toBe(400);
  });

  it("returns search results and count", async () => {
    const rows = [{ id: 1, phone: "0612345678" }];
    searchDeliveries.mockResolvedValueOnce(rows);

    const res = await request(app)
      .get("/api/v1/search?q=612")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(rows);
    expect(res.body.count).toBe(1);
    expect(res.body.query).toBe("612");
    expect(searchDeliveries).toHaveBeenCalledWith("612", 1);
  });
});
