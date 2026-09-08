import { describe, it, expect } from "vitest";
import {
  enrollmentBadgeLabel,
  enrollmentBadgeVariant,
  attendanceStatusLabel,
  attendanceStatusClassName,
  formatSalary,
  formatCheckInTime,
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
