import { describe, it, expect } from "vitest";
import {
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  attendanceStatusLabel,
  attendanceStatusClassName,
  formatSalary,
  formatCheckInTime,
  buildEmployeeUpdatePayload,
  isManualAttendance,
  todayDateStringDouala,
  canMarkPresentManually,
  buildDayAttendanceRows,
} from "./hrUi";

describe("enrollmentBadgeLabel", () => {
  it("returns Enregistré when enrolled", () => {
    expect(enrollmentBadgeLabel(true)).toBe("Enregistré");
  });

  it("returns En attente when not enrolled", () => {
    expect(enrollmentBadgeLabel(false)).toBe("En attente");
  });
});

describe("enrollmentBadgeVariant", () => {
  it("uses default for enrolled and secondary otherwise", () => {
    expect(enrollmentBadgeVariant(true)).toBe("default");
    expect(enrollmentBadgeVariant(false)).toBe("secondary");
  });
});

describe("attendanceStatusLabel / className", () => {
  it("maps present / late / absent", () => {
    expect(attendanceStatusLabel("present")).toBe("Présent");
    expect(attendanceStatusLabel("late")).toBe("En retard");
    expect(attendanceStatusLabel("absent")).toBe("Absent");
    expect(attendanceStatusClassName("present")).toContain("green");
    expect(attendanceStatusClassName("late")).toContain("orange");
    expect(attendanceStatusClassName("absent")).toContain("red");
  });
});

describe("format helpers", () => {
  it("formats salary and empty check-in time", () => {
    expect(formatSalary(null)).toBe("—");
    expect(formatSalary(150000)).toMatch(/150/);
    expect(formatCheckInTime(null)).toBe("—");
  });
});

describe("buildEmployeeUpdatePayload", () => {
  it("maps form fields to an update payload", () => {
    expect(
      buildEmployeeUpdatePayload({
        fullName: "  Ada Lovelace  ",
        email: " ada@example.com ",
        phone: " 699 ",
        poste: " Agent ",
        salaryBase: "150000",
        isActive: false,
      })
    ).toEqual({
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "699",
      poste: "Agent",
      salary_base: 150000,
      is_active: false,
    });
  });

  it("treats blank optional fields as null and invalid salary as null", () => {
    expect(
      buildEmployeeUpdatePayload({
        fullName: "Ada",
        email: "ada@example.com",
        phone: "  ",
        poste: "",
        salaryBase: "abc",
        isActive: true,
      })
    ).toEqual({
      full_name: "Ada",
      email: "ada@example.com",
      phone: null,
      poste: null,
      salary_base: null,
      is_active: true,
    });
  });
});

describe("isManualAttendance", () => {
  it("is true only when face and GPS are both unverified", () => {
    expect(
      isManualAttendance({ face_verified: false, gps_verified: false })
    ).toBe(true);
    expect(
      isManualAttendance({ face_verified: true, gps_verified: false })
    ).toBe(false);
    expect(
      isManualAttendance({ face_verified: false, gps_verified: true })
    ).toBe(false);
  });
});

describe("todayDateStringDouala", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayDateStringDouala(new Date("2026-09-08T12:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });
});

describe("canMarkPresentManually", () => {
  it("is true for missing, absent, or late — false for present", () => {
    expect(canMarkPresentManually(null)).toBe(true);
    expect(canMarkPresentManually(undefined)).toBe(true);
    expect(canMarkPresentManually("absent")).toBe(true);
    expect(canMarkPresentManually("late")).toBe(true);
    expect(canMarkPresentManually("present")).toBe(false);
  });
});

describe("buildDayAttendanceRows", () => {
  it("fills absent for employees without attendance and sorts by name", () => {
    const rows = buildDayAttendanceRows(
      [
        {
          id: 2,
          full_name: "Zoe",
          email: "z@x.com",
          poste: null,
          is_active: true,
        },
        {
          id: 1,
          full_name: "Ada",
          email: "a@x.com",
          poste: "Agent",
          is_active: true,
        },
        {
          id: 3,
          full_name: "Skip",
          email: "s@x.com",
          poste: null,
          is_active: false,
        },
      ],
      [
        {
          id: 10,
          employee_id: 1,
          status: "late",
          check_in_time: "2026-09-08T08:00:00.000Z",
          face_verified: true,
          gps_verified: true,
        },
      ]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].full_name).toBe("Ada");
    expect(rows[0].status).toBe("late");
    expect(canMarkPresentManually(rows[0].status)).toBe(true);
    expect(rows[1].full_name).toBe("Zoe");
    expect(rows[1].status).toBe("absent");
    expect(canMarkPresentManually(rows[1].status)).toBe(true);
  });
});
