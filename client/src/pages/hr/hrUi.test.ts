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
  normalizeAttendanceDate,
  currentMonthYearDouala,
  monthInputValue,
  parseMonthInput,
  formatMonthLabelFr,
  canMarkPresentManually,
  canSetAttendanceStatus,
  listWorkdaysInMonth,
  buildEmployeeMonthDayRows,
  buildDayAttendanceRows,
  buildHrDashboardStats,
  formatAttendanceRatePct,
  formatPayrollAmount,
  estimateEmployeePayDue,
  estimateEmployeePenalties,
  estimateEmployeePenaltyBreakdown,
  formatPenaltyBreakdownLines,
  countWorkdaysInMonth,
  estimateDayPenaltyRates,
  formatDayPenaltyRateLines,
  buildEmployeeDetailStats,
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
    expect(attendanceStatusLabel("late")).toBe("En retard (½ j)");
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

describe("month picker helpers", () => {
  it("builds and parses YYYY-MM", () => {
    expect(monthInputValue(2026, 9)).toBe("2026-09");
    expect(parseMonthInput("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthInput("bad")).toBeNull();
    expect(parseMonthInput("2026-13")).toBeNull();
  });

  it("reads current Douala month and French label", () => {
    const { year, month } = currentMonthYearDouala(
      new Date("2026-09-08T12:00:00Z")
    );
    expect(year).toBe(2026);
    expect(month).toBe(9);
    expect(formatMonthLabelFr(2026, 9)).toMatch(/septembre/i);
    expect(formatMonthLabelFr(2026, 9)).toContain("2026");
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

describe("canSetAttendanceStatus", () => {
  it("allows switching to a different status; null counts as absent", () => {
    expect(canSetAttendanceStatus("present", "absent")).toBe(true);
    expect(canSetAttendanceStatus("absent", "present")).toBe(true);
    expect(canSetAttendanceStatus(null, "absent")).toBe(false);
    expect(canSetAttendanceStatus("present", "present")).toBe(false);
    expect(canSetAttendanceStatus("late", "present")).toBe(true);
    expect(canSetAttendanceStatus("absent", "late")).toBe(true);
    expect(canSetAttendanceStatus("late", "absent")).toBe(true);
    expect(canSetAttendanceStatus("present", "late")).toBe(true);
    expect(canSetAttendanceStatus("late", "late")).toBe(false);
  });
});

describe("normalizeAttendanceDate", () => {
  it("keeps YYYY-MM-DD and fixes timezone-shifted ISO timestamps", () => {
    expect(normalizeAttendanceDate("2026-09-08")).toBe("2026-09-08");
    // node-pg DATE for 2026-09-08 in UTC+2 → previous UTC evening in JSON
    expect(normalizeAttendanceDate("2026-09-07T22:00:00.000Z")).toBe(
      "2026-09-08"
    );
    // UTC+1 shift
    expect(normalizeAttendanceDate("2026-09-07T23:00:00.000Z")).toBe(
      "2026-09-08"
    );
    // UTC server / CI: midnight UTC stays the same calendar day
    expect(normalizeAttendanceDate("2026-09-08T00:00:00.000Z")).toBe(
      "2026-09-08"
    );
  });
});

describe("listWorkdaysInMonth / buildEmployeeMonthDayRows", () => {
  it("lists Mon–Sat up to asOf and skips Sunday", () => {
    const days = listWorkdaysInMonth(2026, 9, "2026-09-07");
    expect(days[0]).toBe("2026-09-01");
    expect(days).toContain("2026-09-05"); // Saturday
    expect(days).not.toContain("2026-09-06"); // Sunday
    expect(days.at(-1)).toBe("2026-09-07");
  });

  it("fills missing days as absent and sorts newest first", () => {
    const rows = buildEmployeeMonthDayRows(
      2026,
      9,
      [
        {
          id: 1,
          date: "2026-09-07T22:00:00.000Z",
          status: "present",
          check_in_time: "2026-09-02T07:00:00.000Z",
          face_verified: true,
          gps_verified: true,
        },
      ],
      "2026-09-08"
    );
    expect(rows.find((r) => r.date === "2026-09-08")?.status).toBe("present");
  });

  it("fills missing days as absent and sorts newest first (plain date)", () => {
    const rows = buildEmployeeMonthDayRows(
      2026,
      9,
      [
        {
          id: 1,
          date: "2026-09-02",
          status: "present",
          check_in_time: "2026-09-02T07:00:00.000Z",
          face_verified: true,
          gps_verified: true,
        },
      ],
      "2026-09-03"
    );
    expect(rows.map((r) => r.date)).toEqual([
      "2026-09-03",
      "2026-09-02",
      "2026-09-01",
    ]);
    expect(rows[0].status).toBe("absent");
    expect(rows[1].status).toBe("present");
    expect(rows[1].attendance_id).toBe(1);
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

describe("buildHrDashboardStats", () => {
  const employees = [
    { id: 1, is_active: true, salary_base: 300000 },
    { id: 2, is_active: true, salary_base: 200000 },
    { id: 3, is_active: false, salary_base: 100000 },
  ];

  it("counts active employees and present/late today among actives only", () => {
    const stats = buildHrDashboardStats({
      employees,
      todayAttendances: [
        { employee_id: 1, status: "present" },
        { employee_id: 2, status: "late" },
        { employee_id: 3, status: "present" },
        { employee_id: 99, status: "present" },
      ],
      monthSummary: [],
      workdaysInMonth: 20,
    });
    expect(stats.activeCount).toBe(2);
    expect(stats.presentToday).toBe(2);
    expect(stats.lateDaysMonth).toBe(0);
    expect(stats.attendanceRatePct).toBeNull();
    expect(stats.basePayroll).toBe(500000);
    expect(stats.estimatedPayroll).toBe(500000);
  });

  it("ignores absent and non-check-in statuses for presentToday", () => {
    const stats = buildHrDashboardStats({
      employees,
      todayAttendances: [
        { employee_id: 1, status: "absent" },
        { employee_id: 2, status: "present" },
      ],
      monthSummary: [],
      workdaysInMonth: 20,
    });
    expect(stats.presentToday).toBe(1);
  });

  it("aggregates month late days and attendance rate", () => {
    const stats = buildHrDashboardStats({
      employees,
      todayAttendances: [],
      monthSummary: [
        {
          employee_id: 1,
          days_present: 8,
          days_late: 2,
          weekdays_elapsed: 12,
        },
        {
          employee_id: 2,
          days_present: 10,
          days_late: 0,
          weekdays_elapsed: 12,
        },
      ],
      workdaysInMonth: 20,
    });
    expect(stats.lateDaysMonth).toBe(2);
    // (8+2+10+0) / (12+12) = 20/24 ≈ 83.333 → round to 83
    expect(stats.attendanceRatePct).toBe(83);
  });

  it("excludes inactive employees from month rate, late days, and payroll", () => {
    const stats = buildHrDashboardStats({
      employees,
      todayAttendances: [{ employee_id: 3, status: "late" }],
      monthSummary: [
        {
          employee_id: 1,
          days_present: 10,
          days_late: 0,
          days_absent: 0,
          weekdays_elapsed: 10,
        },
        {
          employee_id: 3,
          days_present: 0,
          days_late: 5,
          days_absent: 5,
          weekdays_elapsed: 10,
        },
      ],
      workdaysInMonth: 20,
    });
    expect(stats.activeCount).toBe(2);
    expect(stats.presentToday).toBe(0);
    expect(stats.lateDaysMonth).toBe(0);
    expect(stats.attendanceRatePct).toBe(100);
    expect(stats.basePayroll).toBe(500000);
    // emp1: no absences → full 300000; emp2: no summary → full 200000
    expect(stats.estimatedPayroll).toBe(500000);
  });

  it("returns null attendance rate when weekdays_elapsed sum is 0", () => {
    const stats = buildHrDashboardStats({
      employees: [],
      todayAttendances: [],
      monthSummary: [{ days_present: 0, days_late: 0, weekdays_elapsed: 0 }],
      workdaysInMonth: 20,
    });
    expect(stats.attendanceRatePct).toBeNull();
  });

  it("estimates payroll with late=0.5 and absent=0 on full-month basis", () => {
    // Ada 300k: 5 absent + 1.5 late over 20-day month → penalties 97500 → pay 202500
    // Jean 200k: always present → 200000
    const stats = buildHrDashboardStats({
      employees,
      todayAttendances: [],
      monthSummary: [
        {
          employee_id: 1,
          days_present: 12,
          days_late: 3,
          days_absent: 5,
          weekdays_elapsed: 20,
        },
        {
          employee_id: 2,
          days_present: 20,
          days_late: 0,
          days_absent: 0,
          weekdays_elapsed: 20,
        },
      ],
      workdaysInMonth: 20,
    });
    expect(stats.basePayroll).toBe(500000);
    expect(stats.estimatedPayroll).toBe(402500);
  });
});

describe("estimateEmployeePayDue", () => {
  it("is base salary minus full-month penalties", () => {
    expect(
      estimateEmployeePayDue({
        salaryBase: 300000,
        daysPresent: 12,
        daysLate: 3,
        daysAbsent: 5,
        workdaysInMonth: 20,
      })
    ).toBe(202500);
  });

  it("returns null when month has no workdays", () => {
    expect(
      estimateEmployeePayDue({
        salaryBase: 300000,
        daysPresent: 0,
        daysLate: 0,
        workdaysInMonth: 0,
      })
    ).toBeNull();
  });
});

describe("estimateEmployeePenalties", () => {
  it("uses full-month day rate (absent + half late)", () => {
    expect(
      estimateEmployeePenalties({
        salaryBase: 300000,
        daysPresent: 12,
        daysLate: 3,
        daysAbsent: 5,
        workdaysInMonth: 20,
      })
    ).toBe(97500);
  });

  it("matches unit cost × absences mid-month (Eric example)", () => {
    // 100000 / 26 ≈ 3846 per day × 2 absences = 7692
    expect(
      estimateEmployeePenalties({
        salaryBase: 100000,
        daysPresent: 6,
        daysLate: 0,
        daysAbsent: 2,
        weekdaysElapsed: 8,
        workdaysInMonth: 26,
      })
    ).toBe(7692);
  });

  it("is zero when always present", () => {
    expect(
      estimateEmployeePenalties({
        salaryBase: 200000,
        daysPresent: 20,
        daysLate: 0,
        daysAbsent: 0,
        workdaysInMonth: 20,
      })
    ).toBe(0);
  });

  it("returns null when month has no workdays", () => {
    expect(
      estimateEmployeePenalties({
        salaryBase: 300000,
        daysPresent: 0,
        daysLate: 0,
        workdaysInMonth: 0,
      })
    ).toBeNull();
  });
});

describe("estimateEmployeePenaltyBreakdown", () => {
  it("splits late vs absent amounts like a key map", () => {
    const b = estimateEmployeePenaltyBreakdown({
      salaryBase: 300000,
      daysPresent: 12,
      daysLate: 3,
      daysAbsent: 5,
      workdaysInMonth: 20,
    });
    expect(b).toEqual({ late: 22500, absent: 75000, total: 97500 });
  });
});

describe("formatPenaltyBreakdownLines", () => {
  it("formats key = value lines", () => {
    const lines = formatPenaltyBreakdownLines({
      late: 22500,
      absent: 75000,
      total: 97500,
    });
    expect(lines[0]).toMatch(/^Pénalité retard = /);
    expect(lines[0]).toMatch(/22/);
    expect(lines[1]).toMatch(/^Pénalité absence = /);
    expect(lines[2]).toMatch(/^Total pénalités = /);
  });

  it("uses em dash when breakdown is null", () => {
    const lines = formatPenaltyBreakdownLines(null);
    expect(lines.every((l) => l.includes("—"))).toBe(true);
  });
});

describe("day penalty rates (employee-facing)", () => {
  it("counts full-month workdays and unit costs", () => {
    expect(countWorkdaysInMonth(2026, 9)).toBe(26);
    expect(
      estimateDayPenaltyRates({ salaryBase: 300000, workdaysInMonth: 26 })
    ).toEqual({ costLateDay: 5769, costAbsentDay: 11538 });
  });

  it("formats rate lines", () => {
    const lines = formatDayPenaltyRateLines({
      costLateDay: 5769,
      costAbsentDay: 11538,
    });
    expect(lines[0]).toMatch(/^1 jour de retard = /);
    expect(lines[1]).toMatch(/^1 jour d'absence = /);
  });
});

describe("formatAttendanceRatePct", () => {
  it("formats percent or em dash when null", () => {
    expect(formatAttendanceRatePct(83)).toBe("83 %");
    expect(formatAttendanceRatePct(null)).toBe("—");
  });
});

describe("formatPayrollAmount", () => {
  it("formats francs or em dash when null", () => {
    expect(formatPayrollAmount(202500)).toMatch(/202/);
    expect(formatPayrollAmount(202500)).toMatch(/F$/);
    expect(formatPayrollAmount(null)).toBe("—");
  });
});

describe("buildEmployeeDetailStats", () => {
  it("builds Ada month stats with payroll estimate", () => {
    const stats = buildEmployeeDetailStats({
      salaryBase: 300000,
      workdaysInMonth: 20,
      summary: {
        days_present: 12,
        days_late: 3,
        days_absent: 5,
        weekdays_elapsed: 20,
      },
    });
    expect(stats.daysPresent).toBe(12);
    expect(stats.daysLate).toBe(3);
    expect(stats.daysAbsent).toBe(5);
    expect(stats.attendanceRatePct).toBe(75); // (12+3)/20
    expect(stats.salaryBase).toBe(300000);
    expect(stats.estimatedPay).toBe(202500);
    expect(stats.penalties).toBe(97500);
    expect(stats.penaltyLate).toBe(22500);
    expect(stats.penaltyAbsent).toBe(75000);
  });

  it("uses full-month rates for mid-month absences (Eric example)", () => {
    const stats = buildEmployeeDetailStats({
      salaryBase: 100000,
      workdaysInMonth: 26,
      summary: {
        days_present: 6,
        days_late: 0,
        days_absent: 2,
        weekdays_elapsed: 8,
      },
    });
    expect(stats.attendanceRatePct).toBe(75);
    expect(stats.penalties).toBe(7692);
    expect(stats.penaltyAbsent).toBe(7692);
    expect(stats.estimatedPay).toBe(92308);
  });

  it("handles missing summary", () => {
    const stats = buildEmployeeDetailStats({
      salaryBase: 150000,
      workdaysInMonth: 26,
      summary: null,
    });
    expect(stats.daysPresent).toBe(0);
    expect(stats.attendanceRatePct).toBeNull();
    expect(stats.estimatedPay).toBe(150000);
    expect(stats.penalties).toBe(0);
    expect(stats.penaltyLate).toBe(0);
    expect(stats.penaltyAbsent).toBe(0);
    expect(stats.salaryBase).toBe(150000);
  });
});
