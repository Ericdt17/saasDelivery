/**
 * Unit tests for client/src/services/hr.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";

vi.mock("@/services/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import * as apiModule from "@/services/api";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  enrollEmployeeFace,
  listAttendances,
  createManualAttendance,
  getAttendancesSummary,
  sendPayslipWhatsapp,
  type HrEmployee,
  type HrAttendance,
} from "@/services/hr";

const mockApiGet = apiModule.apiGet as unknown as MockInstance;
const mockApiPost = apiModule.apiPost as unknown as MockInstance;
const mockApiPatch = apiModule.apiPatch as unknown as MockInstance;
const mockApiDelete = apiModule.apiDelete as unknown as MockInstance;

const employeeFixture: HrEmployee = {
  id: 1,
  full_name: "Jean Dupont",
  email: "jean.dupont@example.com",
  phone: null,
  poste: "Livreur",
  salary_base: 150000,
  payroll_eligible_from: "2026-01-01",
  is_active: true,
  is_enrolled: false,
  enrolled_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const attendanceFixture: HrAttendance = {
  id: 10,
  employee_id: 1,
  date: "2026-09-08",
  check_in_time: "2026-09-08T07:00:00.000Z",
  status: "present",
  face_verified: true,
  gps_verified: true,
  latitude: 3.8721,
  longitude: 11.5137,
  created_at: "2026-09-08T07:00:00.000Z",
  full_name: "Jean Dupont",
  email: "jean.dupont@example.com",
  poste: "Livreur",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listEmployees", () => {
  it("calls GET /api/v1/hr/employees and unwraps data", async () => {
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: [employeeFixture],
    });
    const rows = await listEmployees();
    expect(mockApiGet).toHaveBeenCalledWith("/api/v1/hr/employees");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("jean.dupont@example.com");
  });

  it("throws when success is false", async () => {
    mockApiGet.mockResolvedValueOnce({
      success: false,
      error: "boom",
    });
    await expect(listEmployees()).rejects.toThrow(/boom|Impossible/);
  });
});

describe("createEmployee", () => {
  it("posts payload to /employees", async () => {
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: employeeFixture,
    });
    const row = await createEmployee({
      full_name: "Jean Dupont",
      email: "jean.dupont@example.com",
    });
    expect(mockApiPost).toHaveBeenCalledWith("/api/v1/hr/employees", {
      full_name: "Jean Dupont",
      email: "jean.dupont@example.com",
    });
    expect(row.id).toBe(1);
  });
});

describe("updateEmployee", () => {
  it("patches /employees/:id with partial fields", async () => {
    mockApiPatch.mockResolvedValueOnce({
      success: true,
      data: { ...employeeFixture, poste: "Superviseur", is_active: false },
    });
    const row = await updateEmployee(1, {
      poste: "Superviseur",
      is_active: false,
    });
    expect(mockApiPatch).toHaveBeenCalledWith("/api/v1/hr/employees/1", {
      poste: "Superviseur",
      is_active: false,
    });
    expect(row.poste).toBe("Superviseur");
    expect(row.is_active).toBe(false);
  });
});

describe("deleteEmployee", () => {
  it("deletes /employees/:id and unwraps soft-deleted employee", async () => {
    mockApiDelete.mockResolvedValueOnce({
      success: true,
      data: { ...employeeFixture, is_active: false },
    });
    const row = await deleteEmployee(1);
    expect(mockApiDelete).toHaveBeenCalledWith("/api/v1/hr/employees/1");
    expect(row.is_active).toBe(false);
  });

  it("throws when success is false", async () => {
    mockApiDelete.mockResolvedValueOnce({
      success: false,
      error: "not found",
    });
    await expect(deleteEmployee(999)).rejects.toThrow(/not found|Impossible/);
  });
});

describe("enrollEmployeeFace", () => {
  it("posts face_descriptor array", async () => {
    const descriptor = Array.from({ length: 128 }, (_, i) => i * 0.01);
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: { ...employeeFixture, is_enrolled: true },
    });
    await enrollEmployeeFace(1, descriptor);
    expect(mockApiPost).toHaveBeenCalledWith("/api/v1/hr/employees/1/enroll", {
      face_descriptor: descriptor,
    });
  });
});

describe("listAttendances", () => {
  it("passes month/year/employee_id query params", async () => {
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: [attendanceFixture],
    });
    const rows = await listAttendances({ month: 9, year: 2026, employee_id: 1 });
    expect(mockApiGet).toHaveBeenCalledWith("/api/v1/hr/attendances", {
      employee_id: 1,
      date: undefined,
      month: 9,
      year: 2026,
    });
    expect(rows[0].status).toBe("present");
  });
});

describe("createManualAttendance", () => {
  it("posts employee_id, date and status to /attendances", async () => {
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: {
        ...attendanceFixture,
        face_verified: false,
        gps_verified: false,
        latitude: null,
        longitude: null,
      },
    });
    const row = await createManualAttendance({
      employee_id: 1,
      date: "2026-09-08",
      status: "present",
    });
    expect(mockApiPost).toHaveBeenCalledWith("/api/v1/hr/attendances", {
      employee_id: 1,
      date: "2026-09-08",
      status: "present",
    });
    expect(row.face_verified).toBe(false);
    expect(row.gps_verified).toBe(false);
  });

  it("can post status absent", async () => {
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: { ...attendanceFixture, status: "absent", check_in_time: null },
    });
    await createManualAttendance({
      employee_id: 1,
      date: "2026-09-07",
      status: "absent",
    });
    expect(mockApiPost).toHaveBeenCalledWith("/api/v1/hr/attendances", {
      employee_id: 1,
      date: "2026-09-07",
      status: "absent",
    });
  });
});

describe("getAttendancesSummary", () => {
  it("calls summary endpoint", async () => {
    mockApiGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          employee_id: 1,
          full_name: "Jean Dupont",
          email: "jean.dupont@example.com",
          poste: "Livreur",
          days_present: 2,
          days_late: 1,
          days_absent: 3,
          weekdays_elapsed: 6,
        },
      ],
    });
    const rows = await getAttendancesSummary({ month: 9, year: 2026 });
    expect(mockApiGet).toHaveBeenCalledWith("/api/v1/hr/attendances/summary", {
      month: 9,
      year: 2026,
    });
    expect(rows[0].days_absent).toBe(3);
  });

  it("calls apiPost for sendPayslipWhatsapp", async () => {
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: {
        sent: true,
        recipient: "237690000000@c.us",
        message_id: "msg-1",
        filename: "Bulletin-paie-Jean-Dupont-2026-09.pdf",
      },
    });
    const result = await sendPayslipWhatsapp(1, { month: 9, year: 2026 });
    expect(mockApiPost).toHaveBeenCalledWith(
      "/api/v1/hr/employees/1/payslip/send-whatsapp?month=9&year=2026"
    );
    expect(result.sent).toBe(true);
    expect(result.message_id).toBe("msg-1");
  });
});
