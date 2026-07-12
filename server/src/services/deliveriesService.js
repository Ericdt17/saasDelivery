/**
 * Deliveries service layer.
 *
 * Goals:
 * - Keep route handlers thin (validation + response shaping)
 * - Centralize scoping rules (agency/vendor)
 * - Centralize delivery fee + amount_paid derivation logic
 * - Centralize vendor push trigger decision on status transitions
 *
 * This module is dependency-injected for testability.
 */
const { computeTariffPending, computeAmountPaidAfterFee } = require("../lib/deliveryCalculations");

function resolveAgencyIdFromUser(user) {
  if (!user) return null;
  return user.agencyId !== null && user.agencyId !== undefined ? user.agencyId : user.userId;
}

function toInt(v, fallback = null) {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(v, fallback = 0) {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Apply the same automatic tariff logic used by the existing routes.
 *
 * @param {{
 *   agencyId: number|null,
 *   status: string,
 *   quartier?: string|null,
 *   amount_due: number,
 *   amount_paid: number,
 *   delivery_fee?: number|undefined|null
 * }} input
 * @param {{ getTariffByAgencyAndQuartier: (agencyId:number, quartier:string)=>Promise<any> }} deps
 */
async function applyAutomaticTariffLogic(input, deps) {
  const {
    agencyId,
    status,
    quartier,
    amount_due,
    amount_paid,
    delivery_fee,
  } = input;

  const parsedAmountDue = toFloat(amount_due, 0);
  const parsedAmountPaid = toFloat(amount_paid, 0);
  const parsedDeliveryFee =
    delivery_fee !== undefined && delivery_fee !== null ? toFloat(delivery_fee, NaN) : undefined;

  let finalDeliveryFee = parsedDeliveryFee;
  let finalAmountPaid = parsedAmountPaid;

  if (parsedDeliveryFee === undefined || parsedDeliveryFee === null) {
    if (status === "pickup") {
      finalDeliveryFee = 1000;
      if (parsedAmountPaid === 0 && parsedAmountDue > 0) {
        finalAmountPaid = computeAmountPaidAfterFee(parsedAmountDue, finalDeliveryFee);
      }
    } else if (status === "present_ne_decroche_zone1") {
      finalDeliveryFee = 500;
      finalAmountPaid = 0;
    } else if (status === "present_ne_decroche_zone2") {
      finalDeliveryFee = 1000;
      finalAmountPaid = 0;
    } else if (status === "delivered" || status === "client_absent") {
      if (quartier && agencyId) {
        try {
          const tariffResult = await deps.getTariffByAgencyAndQuartier(agencyId, quartier);
          const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;
          if (tariff && tariff.tarif_amount) {
            finalDeliveryFee = toFloat(tariff.tarif_amount, 0);
            if (status === "delivered") {
              if (parsedAmountPaid === 0 && parsedAmountDue > 0) {
                finalAmountPaid = computeAmountPaidAfterFee(parsedAmountDue, finalDeliveryFee);
              }
            } else if (status === "client_absent") {
              finalAmountPaid = 0;
            }
          }
        } catch {
          // Preserve existing behavior: ignore tariff lookup failure.
        }
      }
    }
  } else {
    if (
      status === "client_absent" ||
      status === "present_ne_decroche_zone1" ||
      status === "present_ne_decroche_zone2"
    ) {
      finalAmountPaid = 0;
    } else if (status === "delivered" || status === "pickup") {
      if (parsedAmountPaid === 0 && parsedAmountDue > 0) {
        finalAmountPaid = computeAmountPaidAfterFee(parsedAmountDue, parsedDeliveryFee);
      }
    }
  }

  const tariff_pending = computeTariffPending(status, quartier, finalDeliveryFee);
  return { finalDeliveryFee, finalAmountPaid, tariff_pending };
}

function createDeliveriesService({ deliveriesRepo, tariffsRepo, pushPort, logger }) {
  if (!deliveriesRepo) throw new Error("deliveriesRepo is required");
  if (!tariffsRepo) throw new Error("tariffsRepo is required");
  if (!pushPort) throw new Error("pushPort is required");

  return {
    resolveAgencyIdFromUser,
    applyAutomaticTariffLogic: (input) =>
      applyAutomaticTariffLogic(input, {
        getTariffByAgencyAndQuartier: tariffsRepo.getTariffByAgencyAndQuartier,
      }),

    async listDeliveries({ user, query }) {
      const {
        page = 1,
        limit = 50,
        status,
        date,
        phone,
        startDate,
        endDate,
        sortBy = "created_at",
        sortOrder = "DESC",
        group_id,
        agency_id: queryAgencyId,
      } = query || {};

      let agency_id = null;
      if (user && user.role !== "super_admin") {
        agency_id = resolveAgencyIdFromUser(user);
      } else if (user && user.role === "super_admin" && queryAgencyId) {
        agency_id = toInt(queryAgencyId, null);
      }

      const effectiveGroupId =
        user?.role === "vendor" ? user.groupId : (group_id ? toInt(group_id, null) : null);

      return deliveriesRepo.getAllDeliveries({
        page: toInt(page, 1),
        limit: toInt(limit, 50),
        status,
        date,
        phone,
        startDate,
        endDate,
        sortBy,
        sortOrder,
        agency_id,
        group_id: effectiveGroupId,
      });
    },

    async getDelivery({ user, id }) {
      const result = await deliveriesRepo.getDeliveryById(toInt(id, 0));
      const delivery = Array.isArray(result) ? result[0] : result;
      if (!delivery) return null;
      if (user?.role === "vendor" && delivery.group_id !== user.groupId) {
        const err = new Error("Access denied to this delivery");
        err.statusCode = 403;
        throw err;
      }
      return delivery;
    },

    async bulkCreateDeliveries({ user, deliveries }) {
      if (user?.role === "vendor") {
        const err = new Error("Vendors cannot use bulk delivery creation");
        err.statusCode = 403;
        throw err;
      }
      if (!Array.isArray(deliveries)) {
        const err = new Error('Expected an array of deliveries in "deliveries" field');
        err.statusCode = 400;
        throw err;
      }
      if (deliveries.length === 0) {
        const err = new Error("Deliveries array cannot be empty");
        err.statusCode = 400;
        throw err;
      }
      if (deliveries.length > 100) {
        const err = new Error("Maximum 100 deliveries per bulk insert");
        err.statusCode = 400;
        throw err;
      }

      const results = { success: [], failed: [] };
      for (let i = 0; i < deliveries.length; i++) {
        const deliveryData = deliveries[i];
        try {
          const {
            phone,
            items,
            amount_due,
            amount_paid = 0,
            status = "pending",
            quartier,
            notes,
            carrier,
          } = deliveryData || {};

          if (!phone || !items || !amount_due) {
            results.failed.push({
              index: i,
              data: deliveryData,
              error: "Missing required fields: phone, items, amount_due",
            });
            continue;
          }

          const deliveryId = await deliveriesRepo.createDelivery({
            phone,
            items,
            amount_due: toFloat(amount_due, 0),
            amount_paid: toFloat(amount_paid, 0),
            status,
            quartier,
            notes,
            carrier,
          });

          const deliveryResult = await deliveriesRepo.getDeliveryById(deliveryId);
          const created = Array.isArray(deliveryResult) ? deliveryResult[0] : deliveryResult;
          results.success.push({ index: i, id: deliveryId, data: created });
        } catch (error) {
          results.failed.push({
            index: i,
            data: deliveryData,
            error: error?.message || String(error),
          });
        }
      }

      return results;
    },

    async createDeliveryAsAgency({ user, body }) {
      const agencyId = resolveAgencyIdFromUser(user);

      // Vendors must have both agencyId and groupId in their token (parity with existing route)
      if (user?.role === "vendor") {
        if (!user.agencyId || !user.groupId) {
          const err = new Error("Vendor account is not linked to an agency and group");
          err.statusCode = 400;
          err.error = "Invalid vendor token";
          throw err;
        }
      }

      const {
        phone,
        customer_name,
        items,
        amount_due,
        amount_paid = 0,
        status = "pending",
        quartier,
        notes,
        carrier,
        delivery_fee,
        group_id: bodyGroupId,
      } = body;

      // For vendors, always use token's group_id (ignore body)
      const group_id = user?.role === "vendor" ? user.groupId : bodyGroupId;

      const parsedAmountDue = toFloat(amount_due, 0);
      const parsedAmountPaid = toFloat(amount_paid, 0);
      const parsedStatus = status || "pending";

      const { finalDeliveryFee, finalAmountPaid, tariff_pending } =
        await applyAutomaticTariffLogic(
          {
            agencyId,
            status: parsedStatus,
            quartier,
            amount_due: parsedAmountDue,
            amount_paid: parsedAmountPaid,
            delivery_fee,
          },
          { getTariffByAgencyAndQuartier: tariffsRepo.getTariffByAgencyAndQuartier }
        );

      const deliveryId = await deliveriesRepo.createDelivery({
        phone,
        customer_name,
        items,
        amount_due: parsedAmountDue,
        amount_paid: finalAmountPaid,
        status: parsedStatus,
        quartier,
        notes,
        carrier,
        delivery_fee: finalDeliveryFee,
        tariff_pending,
        group_id: group_id !== undefined && group_id !== null ? toInt(group_id, undefined) : undefined,
        agency_id: agencyId,
      });

      const deliveryResult = await deliveriesRepo.getDeliveryById(deliveryId);
      return Array.isArray(deliveryResult) ? deliveryResult[0] : deliveryResult;
    },

    async createDeliveryAsVendor({ user, body }) {
      if (!user?.agencyId || !user?.groupId) {
        const err = new Error("Vendor account is not linked to an agency and group");
        err.statusCode = 400;
        err.error = "Invalid vendor token";
        throw err;
      }

      const {
        phone,
        customer_name,
        items,
        amount_due,
        amount_paid = 0,
        status = "pending",
        quartier,
        notes,
        carrier,
        delivery_fee,
      } = body;

      const parsedAmountDue = toFloat(amount_due, 0);
      const parsedAmountPaid = toFloat(amount_paid, 0);
      const parsedStatus = status || "pending";

      const { finalDeliveryFee, finalAmountPaid, tariff_pending } =
        await applyAutomaticTariffLogic(
          {
            agencyId: user.agencyId,
            status: parsedStatus,
            quartier,
            amount_due: parsedAmountDue,
            amount_paid: parsedAmountPaid,
            delivery_fee,
          },
          { getTariffByAgencyAndQuartier: tariffsRepo.getTariffByAgencyAndQuartier }
        );

      const deliveryId = await deliveriesRepo.createDelivery({
        phone,
        customer_name,
        items,
        amount_due: parsedAmountDue,
        amount_paid: finalAmountPaid,
        status: parsedStatus,
        quartier,
        notes,
        carrier,
        delivery_fee: finalDeliveryFee,
        tariff_pending,
        group_id: user.groupId,
        agency_id: user.agencyId,
        created_by_user_id: user.userId,
      });

      const deliveryResult = await deliveriesRepo.getDeliveryById(deliveryId);
      return Array.isArray(deliveryResult) ? deliveryResult[0] : deliveryResult;
    },

    async updateDelivery({ user, id, patch, actor }) {
      // Preserve existing behavior: vendor cannot modify deliveries via this endpoint
      if (user?.role === "vendor") {
        const err = new Error("Vendors cannot modify deliveries");
        err.statusCode = 403;
        throw err;
      }

      const deliveryId = toInt(id, 0);
      const existing = await deliveriesRepo.getDeliveryById(deliveryId);
      const delivery = Array.isArray(existing) ? existing[0] : existing;
      if (!delivery) {
        const err = new Error("Delivery not found");
        err.statusCode = 404;
        throw err;
      }

      const updates = { ...(patch || {}) };

      const statusChange = {
        toDelivered: updates.status === "delivered" && delivery.status !== "delivered",
        toClientAbsent: updates.status === "client_absent" && delivery.status !== "client_absent",
        toFailed: updates.status === "failed" && delivery.status !== "failed",
        toPickup: updates.status === "pickup" && delivery.status !== "pickup",
        toPresentZone1:
          updates.status === "present_ne_decroche_zone1" &&
          delivery.status !== "present_ne_decroche_zone1",
        toPresentZone2:
          updates.status === "present_ne_decroche_zone2" &&
          delivery.status !== "present_ne_decroche_zone2",
        fromDelivered:
          delivery.status === "delivered" &&
          updates.status !== "delivered" &&
          updates.status !== undefined,
        fromPresentZone1:
          delivery.status === "present_ne_decroche_zone1" &&
          updates.status !== "present_ne_decroche_zone1" &&
          updates.status !== undefined,
        fromPresentZone2:
          delivery.status === "present_ne_decroche_zone2" &&
          updates.status !== "present_ne_decroche_zone2" &&
          updates.status !== undefined,
      };

      const manualDeliveryFee = updates.delivery_fee !== undefined && updates.delivery_fee !== null;
      const currentDeliveryFee = toFloat(delivery.delivery_fee, 0);

      const throwHttp = (statusCode, body) => {
        const err = new Error(body?.message || body?.error || "Request failed");
        err.statusCode = statusCode;
        err.responseBody = body;
        throw err;
      };

      const applyTariffLogic = async (forceAmountPaidToZero = false) => {
        const agencyId = delivery.agency_id;
        const quartier = delivery.quartier || updates.quartier;

        if (!agencyId) {
          throwHttp(400, {
            success: false,
            error: "Missing agency information",
            message: "Cannot apply tariff: delivery has no agency_id",
          });
        }

        if (!quartier) {
          if (forceAmountPaidToZero) updates.amount_paid = 0;
          return;
        }

        // manual fee provided in request
        if (manualDeliveryFee && toFloat(updates.delivery_fee, 0) >= 0) {
          const manualFee = toFloat(updates.delivery_fee, 0);
          updates.delivery_fee = manualFee;
          if (forceAmountPaidToZero) {
            updates.amount_paid = 0;
            return;
          }
          if (updates.amount_paid === undefined) {
            const currentAmountPaid = toFloat(delivery.amount_paid, 0);
            const currentAmountDue = toFloat(delivery.amount_due, 0);
            if (currentAmountPaid === 0 && currentAmountDue > 0) {
              updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, manualFee);
            } else if (currentAmountPaid > 0) {
              updates.amount_paid = computeAmountPaidAfterFee(currentAmountPaid, manualFee);
            }
          }
          return;
        }

        // preserve existing fee on delivery if it exists
        if (currentDeliveryFee > 0) {
          const existingFee = toFloat(currentDeliveryFee, 0);
          updates.delivery_fee = existingFee;
          if (forceAmountPaidToZero) {
            updates.amount_paid = 0;
            return;
          }
          if (updates.amount_paid === undefined) {
            const currentAmountPaid = toFloat(delivery.amount_paid, 0);
            const currentAmountDue = toFloat(delivery.amount_due, 0);
            if (currentAmountPaid === 0 && currentAmountDue > 0) {
              updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, existingFee);
            } else if (currentAmountPaid > 0) {
              updates.amount_paid = computeAmountPaidAfterFee(currentAmountPaid, existingFee);
            }
          }
          return;
        }

        // lookup fee
        const tariffResult = await tariffsRepo.getTariffByAgencyAndQuartier(agencyId, quartier);
        const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;
        if (!tariff || !tariff.tarif_amount) {
          if (forceAmountPaidToZero) updates.amount_paid = 0;
          return;
        }

        const tariffAmount = toFloat(tariff.tarif_amount, 0);
        updates.delivery_fee = tariffAmount;
        if (forceAmountPaidToZero) {
          updates.amount_paid = 0;
          return;
        }

        if (updates.amount_paid === undefined) {
          const currentAmountPaid = toFloat(delivery.amount_paid, 0);
          const currentAmountDue = toFloat(delivery.amount_due, 0);
          if (currentAmountPaid === 0 && currentAmountDue > 0) {
            updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, tariffAmount);
          } else if (currentAmountPaid > 0 && currentAmountPaid < currentAmountDue) {
            updates.amount_paid = computeAmountPaidAfterFee(currentAmountPaid, tariffAmount);
          } else if (currentAmountPaid >= currentAmountDue && currentAmountDue > 0) {
            updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, tariffAmount);
          }
        }
      };

      // Case 1: to delivered
      if (statusChange.toDelivered) {
        await applyTariffLogic(false);
      }
      // Case 2: to client_absent
      else if (statusChange.toClientAbsent) {
        await applyTariffLogic(true);
      }
      // Case 2.5: quartier change while staying delivered
      else if (
        !statusChange.toDelivered &&
        !statusChange.toClientAbsent &&
        !statusChange.toFailed &&
        !statusChange.toPickup &&
        !statusChange.toPresentZone1 &&
        !statusChange.toPresentZone2 &&
        delivery.status === "delivered" &&
        updates.quartier &&
        updates.quartier !== delivery.quartier
      ) {
        if (!manualDeliveryFee) {
          const agencyId = delivery.agency_id;
          const newQuartier = updates.quartier;
          if (agencyId && newQuartier) {
            try {
              const tariffResult = await tariffsRepo.getTariffByAgencyAndQuartier(agencyId, newQuartier);
              const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;
              if (tariff && tariff.tarif_amount) {
                const newTariff = toFloat(tariff.tarif_amount, 0);
                updates.delivery_fee = newTariff;
                if (updates.amount_paid === undefined) {
                  const currentAmountDue = toFloat(updates.amount_due || delivery.amount_due, 0);
                  updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, newTariff);
                }
              }
            } catch {
              // preserve behavior: ignore lookup errors
            }
          }
        }
      }
      // Case 3: to failed
      else if (statusChange.toFailed) {
        updates.delivery_fee = 0;
        const curPaid = toFloat(delivery.amount_paid, 0);
        if (statusChange.fromDelivered && toFloat(delivery.delivery_fee, 0) > 0) {
          updates.amount_paid = 0;
        } else if (curPaid > 0) {
          updates.amount_paid = 0;
        }
      }
      // Case 4: to pickup
      else if (statusChange.toPickup) {
        const pickupTariff = 1000;
        const fee = manualDeliveryFee && toFloat(updates.delivery_fee, 0) >= 0 ? toFloat(updates.delivery_fee, 0) : pickupTariff;
        updates.delivery_fee = fee;
        if (updates.amount_paid === undefined) {
          const currentAmountDue = toFloat(delivery.amount_due, 0);
          if (currentAmountDue > 0) {
            updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, fee);
          }
        }
      }
      // Case 5: to present zone1
      else if (statusChange.toPresentZone1) {
        const zone1Tariff = manualDeliveryFee && toFloat(updates.delivery_fee, 0) >= 0 ? toFloat(updates.delivery_fee, 0) : 500;
        updates.delivery_fee = zone1Tariff;
        updates.amount_paid = 0;
      }
      // Case 6: to present zone2
      else if (statusChange.toPresentZone2) {
        const zone2Tariff = manualDeliveryFee && toFloat(updates.delivery_fee, 0) >= 0 ? toFloat(updates.delivery_fee, 0) : 1000;
        updates.delivery_fee = zone2Tariff;
        updates.amount_paid = 0;
      }
      // Case 7: leaving present zones
      else if (statusChange.fromPresentZone1 || statusChange.fromPresentZone2) {
        if (toFloat(delivery.delivery_fee, 0) > 0) {
          updates.delivery_fee = 0;
        }
      }
      // Case 8: leaving delivered to other status (not handled above)
      else if (
        statusChange.fromDelivered &&
        updates.status !== "client_absent" &&
        updates.status !== "failed" &&
        updates.status !== "pickup" &&
        updates.status !== "present_ne_decroche_zone1" &&
        updates.status !== "present_ne_decroche_zone2"
      ) {
        if (toFloat(delivery.delivery_fee, 0) > 0) {
          updates.delivery_fee = 0;
          updates.amount_paid = 0;
        }
      } else {
        // manual fee update even without status transition
        if (manualDeliveryFee && toFloat(updates.delivery_fee, 0) >= 0) {
          const manualFee = toFloat(updates.delivery_fee, 0);
          updates.delivery_fee = manualFee;
          const currentStatus = updates.status || delivery.status;
          const isDeliveredOrPickup = currentStatus === "delivered" || currentStatus === "pickup";
          if (isDeliveredOrPickup) {
            const currentAmountDue = toFloat(updates.amount_due || delivery.amount_due, 0);
            const previousFee = toFloat(delivery.delivery_fee, 0);
            const feeChanged = Math.abs(manualFee - previousFee) > 0.01;
            if (feeChanged) {
              updates.amount_paid = computeAmountPaidAfterFee(currentAmountDue, manualFee);
            } else if (updates.amount_paid === undefined) {
              updates.amount_paid = toFloat(delivery.amount_paid, 0);
            }
          }
        }

        // amount_due change while delivered recalculates amount_paid when not explicitly set
        if (
          updates.amount_due !== undefined &&
          toFloat(updates.amount_due, 0) !== toFloat(delivery.amount_due, 0) &&
          delivery.status === "delivered"
        ) {
          const newAmountDue = toFloat(updates.amount_due, 0);
          const fee = toFloat(updates.delivery_fee || delivery.delivery_fee, 0);
          if (updates.amount_paid === undefined && fee > 0) {
            updates.amount_paid = computeAmountPaidAfterFee(newAmountDue, fee);
          }
        }
      }

      const oldValues = {
        phone: delivery.phone,
        customer_name: delivery.customer_name,
        items: delivery.items,
        amount_due: delivery.amount_due,
        amount_paid: delivery.amount_paid,
        status: delivery.status,
        quartier: delivery.quartier,
        notes: delivery.notes,
        carrier: delivery.carrier,
        delivery_fee: delivery.delivery_fee,
      };

      // tariff_pending lifecycle automatic
      const effectiveStatus = updates.status !== undefined ? updates.status : delivery.status;
      const effectiveQuartier = updates.quartier !== undefined ? updates.quartier : delivery.quartier;
      const effectiveFee = updates.delivery_fee !== undefined ? updates.delivery_fee : delivery.delivery_fee;
      updates.tariff_pending = computeTariffPending(effectiveStatus, effectiveQuartier, effectiveFee);

      const oldStatus = delivery.status;

      await deliveriesRepo.updateDelivery(deliveryId, updates);

      const updated = await deliveriesRepo.getDeliveryById(deliveryId);
      const updatedDelivery = Array.isArray(updated) ? updated[0] : updated;
      if (!updatedDelivery) {
        const err = new Error("Delivery not found after update");
        err.statusCode = 404;
        throw err;
      }

      if (oldStatus !== updatedDelivery.status && updatedDelivery.created_by_user_id) {
        void Promise.resolve(
          deliveriesRepo.getExpoPushTokensForVendorUserIds([updatedDelivery.created_by_user_id])
        )
          .then((tokens) => {
            if (tokens && tokens.length) {
              pushPort.notifyVendorDeliveryStatusChange({
                tokens,
                deliveryId,
                newStatus: updatedDelivery.status,
                customerName: updatedDelivery.customer_name,
              });
            }
          })
          .catch((err) => logger?.error?.({ err }, "Vendor push token lookup failed"));
      }

      // history save (same mapping as route)
      const mappedActor = actor || user?.email || String(user?.userId || "unknown");
      const fieldMapping = {
        phone: { action: "updated_phone", fieldName: "Numéro de téléphone" },
        customer_name: { action: "updated_customer_name", fieldName: "Nom du client" },
        items: { action: "updated_items", fieldName: "Produits" },
        amount_due: { action: "updated_amount_due", fieldName: "Montant total" },
        amount_paid: { action: "updated_amount_paid", fieldName: "Montant encaissé" },
        status: { action: "updated_status", fieldName: "Statut" },
        quartier: { action: "updated_quartier", fieldName: "Quartier" },
        notes: { action: "updated_notes", fieldName: "Notes/Instructions" },
        carrier: { action: "updated_carrier", fieldName: "Transporteur" },
        delivery_fee: { action: "updated_delivery_fee", fieldName: "Frais de livraison" },
      };

      for (const [field, mapping] of Object.entries(fieldMapping)) {
        if (updates[field] !== undefined && updates[field] !== null) {
          const oldValue = oldValues[field];
          const newValue = updatedDelivery[field];
          if (oldValue !== newValue) {
            try {
              await deliveriesRepo.saveHistory({
                delivery_id: deliveryId,
                action: mapping.action,
                details: JSON.stringify({
                  field: mapping.fieldName,
                  old_value: oldValue,
                  new_value: newValue,
                  updated_by: mappedActor,
                }),
                actor: mappedActor,
              });
            } catch (historyError) {
              logger?.error?.({ err: historyError, field }, "Error saving delivery history");
            }
          }
        }
      }

      return { updatedDelivery, oldValues, updatesApplied: updates, deliveryBefore: delivery };
    },

    async deleteDelivery({ user, id }) {
      // Preserve existing behavior: vendor cannot delete via this endpoint (route currently blocks vendor on PUT, but DELETE endpoint checks vendor too)
      if (user?.role === "vendor") {
        const err = new Error("Vendors cannot delete deliveries");
        err.statusCode = 403;
        throw err;
      }
      const result = await deliveriesRepo.deleteDelivery(toInt(id, 0));
      return result;
    },

    async getDeliveryHistory({ user, id }) {
      // Preserve vendor access rule: vendor must belong to delivery.group_id
      const delivery = await this.getDelivery({ user, id });
      if (!delivery) {
        const err = new Error("Delivery not found");
        err.statusCode = 404;
        throw err;
      }
      return deliveriesRepo.getDeliveryHistory(toInt(id, 0));
    },

    async saveHistory(entry) {
      return deliveriesRepo.saveHistory(entry);
    },
  };
}

module.exports = {
  createDeliveriesService,
  resolveAgencyIdFromUser,
  applyAutomaticTariffLogic,
};

