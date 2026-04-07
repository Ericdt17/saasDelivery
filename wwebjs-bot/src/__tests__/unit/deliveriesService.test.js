const { createDeliveriesService } = require("../../services/deliveriesService");

function makeService(overrides = {}) {
  const deliveriesRepo = {
    getAllDeliveries: jest.fn(),
    getDeliveryById: jest.fn(),
    createDelivery: jest.fn(),
    updateDelivery: jest.fn(),
    deleteDelivery: jest.fn(),
    getDeliveryHistory: jest.fn(),
    saveHistory: jest.fn(),
    getExpoPushTokensForVendorUserIds: jest.fn(),
    ...(overrides.deliveriesRepo || {}),
  };

  const tariffsRepo = {
    getTariffByAgencyAndQuartier: jest.fn(),
    ...(overrides.tariffsRepo || {}),
  };

  const pushPort = {
    notifyVendorDeliveryStatusChange: jest.fn(),
    ...(overrides.pushPort || {}),
  };

  const logger = {
    error: jest.fn(),
    ...(overrides.logger || {}),
  };

  const service = createDeliveriesService({ deliveriesRepo, tariffsRepo, pushPort, logger });
  return { service, deliveriesRepo, tariffsRepo, pushPort, logger };
}

describe("deliveriesService", () => {
  test("listDeliveries: vendor ignores query group_id and uses token groupId", async () => {
    const { service, deliveriesRepo } = makeService();
    deliveriesRepo.getAllDeliveries.mockResolvedValue({ deliveries: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });

    const user = { role: "vendor", userId: 10, agencyId: 7, groupId: 5 };
    await service.listDeliveries({
      user,
      query: { page: "1", limit: "50", group_id: "999" },
    });

    expect(deliveriesRepo.getAllDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 5, agency_id: 7 })
    );
  });

  test("createDeliveryAsVendor: sets created_by_user_id = userId", async () => {
    const { service, deliveriesRepo, tariffsRepo } = makeService();
    tariffsRepo.getTariffByAgencyAndQuartier.mockResolvedValue({ tarif_amount: 1500 });
    deliveriesRepo.createDelivery.mockResolvedValue(123);
    deliveriesRepo.getDeliveryById.mockResolvedValue([{ id: 123 }]);

    const user = { role: "vendor", userId: 44, agencyId: 2, groupId: 9 };
    await service.createDeliveryAsVendor({
      user,
      body: { phone: "690123456", items: "Colis", amount_due: 10000, status: "pending" },
    });

    expect(deliveriesRepo.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ created_by_user_id: 44, agency_id: 2, group_id: 9 })
    );
  });

  test("updateDelivery: triggers vendor push when status changes and created_by_user_id exists", async () => {
    const { service, deliveriesRepo, pushPort } = makeService();

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([{ id: 1, status: "pending", created_by_user_id: 11, customer_name: "A", group_id: 2, agency_id: 1 }])
      .mockResolvedValueOnce([{ id: 1, status: "delivered", created_by_user_id: 11, customer_name: "A", group_id: 2, agency_id: 1 }]);

    deliveriesRepo.getExpoPushTokensForVendorUserIds.mockResolvedValue(["ExponentPushToken[abc]"]);
    deliveriesRepo.updateDelivery.mockResolvedValue({ changes: 1 });

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 1 },
      id: 1,
      patch: { status: "delivered" },
    });

    // fire-and-forget chain runs synchronously up to the .then attachment; wait a tick
    await Promise.resolve();

    expect(pushPort.notifyVendorDeliveryStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 1, newStatus: "delivered" })
    );
  });

  test("updateDelivery: does not trigger vendor push when status unchanged", async () => {
    const { service, deliveriesRepo, pushPort } = makeService();

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([{ id: 1, status: "pending", created_by_user_id: 11, customer_name: "A", group_id: 2, agency_id: 1 }])
      .mockResolvedValueOnce([{ id: 1, status: "pending", created_by_user_id: 11, customer_name: "A", group_id: 2, agency_id: 1 }]);

    deliveriesRepo.getExpoPushTokensForVendorUserIds.mockResolvedValue(["ExponentPushToken[abc]"]);
    deliveriesRepo.updateDelivery.mockResolvedValue({ changes: 1 });

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 1 },
      id: 1,
      patch: { notes: "no status change" },
    });

    await Promise.resolve();

    expect(pushPort.notifyVendorDeliveryStatusChange).not.toHaveBeenCalled();
  });

  test("updateDelivery: pending -> delivered applies quartier tariff and derives amount_paid from amount_due", async () => {
    const { service, deliveriesRepo, tariffsRepo } = makeService();

    tariffsRepo.getTariffByAgencyAndQuartier.mockResolvedValue({ tarif_amount: 2000 });

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([
        {
          id: 1,
          status: "pending",
          agency_id: 7,
          quartier: "Bastos",
          amount_due: 10000,
          amount_paid: 0,
          delivery_fee: 0,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          status: "delivered",
          agency_id: 7,
          quartier: "Bastos",
          amount_due: 10000,
          amount_paid: 8000,
          delivery_fee: 2000,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ]);

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 7 },
      id: 1,
      patch: { status: "delivered" },
      actor: "tester@example.com",
    });

    expect(tariffsRepo.getTariffByAgencyAndQuartier).toHaveBeenCalledWith(7, "Bastos");
    expect(deliveriesRepo.updateDelivery).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "delivered", delivery_fee: 2000, amount_paid: 8000 })
    );
  });

  test("updateDelivery: delivered -> failed clears delivery_fee and amount_paid", async () => {
    const { service, deliveriesRepo } = makeService();

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([
        {
          id: 2,
          status: "delivered",
          agency_id: 7,
          quartier: "Bastos",
          amount_due: 10000,
          amount_paid: 8000,
          delivery_fee: 2000,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 2,
          status: "failed",
          agency_id: 7,
          quartier: "Bastos",
          amount_due: 10000,
          amount_paid: 0,
          delivery_fee: 0,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ]);

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 7 },
      id: 2,
      patch: { status: "failed" },
      actor: "tester@example.com",
    });

    expect(deliveriesRepo.updateDelivery).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ status: "failed", delivery_fee: 0, amount_paid: 0 })
    );
  });

  test("updateDelivery: delivered quartier change recomputes tariff when no manual fee", async () => {
    const { service, deliveriesRepo, tariffsRepo } = makeService();

    tariffsRepo.getTariffByAgencyAndQuartier.mockResolvedValue({ tarif_amount: 1500 });

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([
        {
          id: 3,
          status: "delivered",
          agency_id: 7,
          quartier: "Old",
          amount_due: 10000,
          amount_paid: 9000,
          delivery_fee: 1000,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 3,
          status: "delivered",
          agency_id: 7,
          quartier: "New",
          amount_due: 10000,
          amount_paid: 8500,
          delivery_fee: 1500,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ]);

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 7 },
      id: 3,
      patch: { quartier: "New" },
      actor: "tester@example.com",
    });

    expect(tariffsRepo.getTariffByAgencyAndQuartier).toHaveBeenCalledWith(7, "New");
    expect(deliveriesRepo.updateDelivery).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ quartier: "New", delivery_fee: 1500, amount_paid: 8500 })
    );
  });

  test("updateDelivery: to pickup applies fixed fee 1000 and derives amount_paid from amount_due", async () => {
    const { service, deliveriesRepo } = makeService();

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([
        {
          id: 4,
          status: "pending",
          agency_id: 7,
          quartier: "X",
          amount_due: 10000,
          amount_paid: 0,
          delivery_fee: 0,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 4,
          status: "pickup",
          agency_id: 7,
          quartier: "X",
          amount_due: 10000,
          amount_paid: 9000,
          delivery_fee: 1000,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ]);

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 7 },
      id: 4,
      patch: { status: "pickup" },
      actor: "tester@example.com",
    });

    expect(deliveriesRepo.updateDelivery).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ status: "pickup", delivery_fee: 1000, amount_paid: 9000 })
    );
  });

  test("updateDelivery: to present_ne_decroche_zone1 forces amount_paid=0 and fee=500", async () => {
    const { service, deliveriesRepo } = makeService();

    deliveriesRepo.getDeliveryById
      .mockResolvedValueOnce([
        {
          id: 5,
          status: "pending",
          agency_id: 7,
          quartier: "X",
          amount_due: 10000,
          amount_paid: 0,
          delivery_fee: 0,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 5,
          status: "present_ne_decroche_zone1",
          agency_id: 7,
          quartier: "X",
          amount_due: 10000,
          amount_paid: 0,
          delivery_fee: 500,
          created_by_user_id: 11,
          customer_name: "A",
        },
      ]);

    await service.updateDelivery({
      user: { role: "agency", userId: 1, agencyId: 7 },
      id: 5,
      patch: { status: "present_ne_decroche_zone1" },
      actor: "tester@example.com",
    });

    expect(deliveriesRepo.updateDelivery).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ status: "present_ne_decroche_zone1", delivery_fee: 500, amount_paid: 0 })
    );
  });

  test("getDelivery: returns null when delivery does not exist", async () => {
    const { service, deliveriesRepo } = makeService();
    deliveriesRepo.getDeliveryById.mockResolvedValue(null);

    const result = await service.getDelivery({
      user: { role: "agency", userId: 1, agencyId: 1 },
      id: 999,
    });

    expect(result).toBeNull();
  });

  test("getDelivery: vendor returns delivery when group_id matches token groupId", async () => {
    const { service, deliveriesRepo } = makeService();
    const row = { id: 42, group_id: 5, status: "delivered" };
    deliveriesRepo.getDeliveryById.mockResolvedValue([row]);

    const result = await service.getDelivery({
      user: { role: "vendor", userId: 10, agencyId: 7, groupId: 5 },
      id: 42,
    });

    expect(result).toEqual(row);
  });

  test("getDelivery: vendor throws 403 when group_id does not match", async () => {
    const { service, deliveriesRepo } = makeService();
    deliveriesRepo.getDeliveryById.mockResolvedValue([{ id: 42, group_id: 99 }]);

    await expect(
      service.getDelivery({
        user: { role: "vendor", userId: 10, agencyId: 7, groupId: 5 },
        id: 42,
      })
    ).rejects.toMatchObject({ statusCode: 403, message: "Access denied to this delivery" });
  });
});

