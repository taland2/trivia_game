import { describe, expect, it } from "vitest";
import { weekId } from "./weekId.js";

// All instants are UTC; weekId resolves them in Asia/Jerusalem then to ISO week.
describe("weekId (GDD §7, ISO week, Asia/Jerusalem)", () => {
  it("formats as ISO year + zero-padded week", () => {
    // 2026-06-18 is a Thursday → ISO week 25 of 2026.
    expect(weekId(new Date("2026-06-18T09:00:00Z"))).toBe("2026-W25");
  });

  it("uses the ISO week-numbering year, not the calendar year (late December)", () => {
    // 2025-12-29 (Mon) starts ISO week 1 of 2026, not week 53 of 2025.
    expect(weekId(new Date("2025-12-29T12:00:00Z"))).toBe("2026-W01");
  });

  it("uses the ISO week-numbering year for early January", () => {
    // 2027-01-01 (Fri) belongs to ISO week 53 of 2026.
    expect(weekId(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });

  it("rolls to a new week at the Monday boundary in local time", () => {
    // 2026-06-21 is a Sunday (W25); 2026-06-22 is a Monday (W26).
    expect(weekId(new Date("2026-06-21T20:00:00Z"))).toBe("2026-W25");
    expect(weekId(new Date("2026-06-22T08:00:00Z"))).toBe("2026-W26");
  });

  it("respects the Jerusalem offset across the UTC midnight boundary", () => {
    // 2026-06-21T21:30Z is 2026-06-22 00:30 IDT (UTC+3) — already Monday locally,
    // so it belongs to the next ISO week than the same UTC-day-Sunday instant.
    expect(weekId(new Date("2026-06-21T21:30:00Z"))).toBe("2026-W26");
  });

  it("handles a winter (IST, UTC+2) date correctly", () => {
    // 2026-01-15 is a Thursday → ISO week 3 of 2026.
    expect(weekId(new Date("2026-01-15T10:00:00Z"))).toBe("2026-W03");
  });
});
