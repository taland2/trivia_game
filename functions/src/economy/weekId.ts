// Weekly-leaderboard bucket id (GDD §7, doc 08 §2). The week resets Monday 00:00
// Asia/Jerusalem; the id is the ISO week of that local date, e.g. "2026-W24".
// Hand-rolled (no date library): Node's ICU gives DST-correct local Y-M-D via
// Intl, and the ISO-week math is a few lines. weekId must use the ISO week-
// NUMBERING year (not the calendar year): late-December dates can belong to W01
// of the next year, and Jan 1 can belong to W52/W53 of the previous year.

// Extract the Asia/Jerusalem local calendar date for an instant. en-CA formats as
// YYYY-MM-DD, which parses cleanly. DST (IST/IDT) is handled by the timezone db.
function jerusalemYmd(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// ISO-8601 week number + week-numbering year for a local calendar date. The
// standard Thursday rule: a week belongs to the year that owns its Thursday.
function isoWeek(year: number, month: number, day: number): {
  isoYear: number;
  week: number;
} {
  // Work in a UTC date purely as a calendar (no timezone semantics needed now).
  const date = new Date(Date.UTC(year, month - 1, day));
  // ISO weekday: Mon=1..Sun=7.
  const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  // Shift to the Thursday of this week; that Thursday's year is the ISO year.
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  // Week number = weeks elapsed since the year's first Thursday (Jan 1 + offset).
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return { isoYear, week };
}

// Format "2026-W24" — zero-padded two-digit week.
export function weekId(date: Date): string {
  const { year, month, day } = jerusalemYmd(date);
  const { isoYear, week } = isoWeek(year, month, day);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
