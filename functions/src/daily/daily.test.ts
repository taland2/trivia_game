import { describe, expect, it } from "vitest";
import { dayAfter, dayIdToUtcMidnight, isDayIdInWindow } from "./dayId.js";
import { nextStreak } from "./streak.js";

const H = 60 * 60 * 1000;
const WINDOW = 14 * H;

describe("dayId helpers (GDD §5)", () => {
  it("parses canonical dates and rejects malformed / non-canonical ones", () => {
    expect(dayIdToUtcMidnight("2026-06-24")).toBe(Date.parse("2026-06-24T00:00:00Z"));
    expect(dayIdToUtcMidnight("2026-6-24")).toBeNull(); // not zero-padded
    expect(dayIdToUtcMidnight("2026-02-30")).toBeNull(); // rolls over → rejected
    expect(dayIdToUtcMidnight("garbage")).toBeNull();
  });

  it("dayAfter advances one calendar day, across month/year boundaries", () => {
    expect(dayAfter("2026-06-24")).toBe("2026-06-25");
    expect(dayAfter("2026-06-30")).toBe("2026-07-01");
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
  });
});

describe("isDayIdInWindow (±14h sanity window)", () => {
  const dayId = "2026-06-24";
  const midnight = Date.parse(`${dayId}T00:00:00Z`);

  it("accepts the matching UTC day", () => {
    expect(isDayIdInWindow(dayId, new Date(midnight + 6 * H), WINDOW)).toBe(true);
  });

  it("accepts up to 14h before the date starts (device ahead of UTC)", () => {
    expect(isDayIdInWindow(dayId, new Date(midnight - 13 * H), WINDOW)).toBe(true);
    expect(isDayIdInWindow(dayId, new Date(midnight - 15 * H), WINDOW)).toBe(false);
  });

  it("accepts up to 14h after the date ends (device behind UTC)", () => {
    expect(isDayIdInWindow(dayId, new Date(midnight + 24 * H + 13 * H), WINDOW)).toBe(true);
    expect(isDayIdInWindow(dayId, new Date(midnight + 24 * H + 15 * H), WINDOW)).toBe(false);
  });

  it("rejects malformed dayIds", () => {
    expect(isDayIdInWindow("nope", new Date(midnight), WINDOW)).toBe(false);
  });
});

describe("nextStreak (GDD §5 — consecutive days played)", () => {
  it("starts at 1 for the first ever play", () => {
    expect(nextStreak(null, "2026-06-24")).toEqual({ count: 1, lastDayId: "2026-06-24" });
  });

  it("increments on the next consecutive day", () => {
    expect(nextStreak({ count: 5, lastDayId: "2026-06-23" }, "2026-06-24")).toEqual({
      count: 6,
      lastDayId: "2026-06-24",
    });
  });

  it("resets to 1 after a gap", () => {
    expect(nextStreak({ count: 9, lastDayId: "2026-06-21" }, "2026-06-24")).toEqual({
      count: 1,
      lastDayId: "2026-06-24",
    });
  });

  it("is unchanged on a same-day re-entry", () => {
    const prev = { count: 4, lastDayId: "2026-06-24" };
    expect(nextStreak(prev, "2026-06-24")).toEqual(prev);
  });
});
