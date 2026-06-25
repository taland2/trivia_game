// Daily-challenge calendar-date helpers (GDD §5). A `dayId` is the user-LOCAL
// calendar date "YYYY-MM-DD" the daily set is keyed to (Wordle model). Pure, no
// Firebase — date-only math, deliberately timezone-free: a dayId is a label, and
// "the day after" / "is it in window" reason about the label, not an instant.

const DAY_MS = 24 * 60 * 60 * 1000;

// Parse "YYYY-MM-DD" to the UTC-midnight instant of that calendar date, or null.
// UTC is used purely as a fixed reference frame for date arithmetic.
export function dayIdToUtcMidnight(dayId: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayId)) return null;
  const ms = Date.parse(`${dayId}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return null;
  // Reject non-canonical dates (e.g. "2026-02-30" rolls over to March): round-trip.
  const back = new Date(ms).toISOString().slice(0, 10);
  return back === dayId ? ms : null;
}

// The calendar date immediately after `dayId`, as "YYYY-MM-DD".
export function dayAfter(dayId: string): string {
  const ms = dayIdToUtcMidnight(dayId);
  if (ms === null) throw new Error(`Invalid dayId: ${dayId}`);
  return new Date(ms + DAY_MS).toISOString().slice(0, 10);
}

// Is a client-claimed `dayId` within the server's sanity window (GDD §5)? The
// date's 24h UTC span, widened by ±windowMs, must contain the server instant.
// With windowMs = 14h this accepts every legitimate device timezone (UTC-12..+14)
// claiming "today", plus the natural roll-over slack at local midnight, and
// rejects anything further off (replay/spoof of a far-future or stale date).
export function isDayIdInWindow(
  dayId: string,
  now: Date,
  windowMs: number,
): boolean {
  const start = dayIdToUtcMidnight(dayId);
  if (start === null) return false;
  const t = now.getTime();
  return t >= start - windowMs && t < start + DAY_MS + windowMs;
}
