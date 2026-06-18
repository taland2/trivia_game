import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { decideForfeit } from "./sweepForfeits.js";
import type { MatchDoc } from "./types.js";

const NOW = Timestamp.fromMillis(1_000_000_000_000);

function activeMatch(over: Partial<MatchDoc> = {}): MatchDoc {
  return {
    mode: "async_duel",
    categoryMode: "spin",
    players: ["a", "b"],
    state: "active",
    roundWins: { a: 1, b: 0 },
    scoreTotals: { a: 0, b: 0 },
    currentRound: 1,
    turnUid: "b",
    turnDeadline: Timestamp.fromMillis(NOW.toMillis() - 1), // expired
    language: "he",
    isStrangerMatch: false,
    usedCategories: [],
    result: null,
    createdAt: NOW,
    finishedAt: null,
    ...over,
  };
}

describe("decideForfeit (GDD §4.4)", () => {
  it("forfeits an expired active match against the player on turn", () => {
    expect(decideForfeit(activeMatch(), NOW)).toEqual({
      winner: "a",
      loser: "b",
    });
  });

  it("does not forfeit before the deadline", () => {
    const m = activeMatch({
      turnDeadline: Timestamp.fromMillis(NOW.toMillis() + 1),
    });
    expect(decideForfeit(m, NOW)).toBeNull();
  });

  it("treats the deadline as inclusive (exactly now forfeits, matching the <= query)", () => {
    const m = activeMatch({ turnDeadline: NOW });
    expect(decideForfeit(m, NOW)).toEqual({ winner: "a", loser: "b" });
  });

  it("ignores non-active matches", () => {
    expect(decideForfeit(activeMatch({ state: "finished" }), NOW)).toBeNull();
    expect(decideForfeit(activeMatch({ state: "forfeited" }), NOW)).toBeNull();
    expect(decideForfeit(activeMatch({ state: "cancelled" }), NOW)).toBeNull();
  });

  it("ignores a match with no live turn or no deadline", () => {
    expect(decideForfeit(activeMatch({ turnUid: null }), NOW)).toBeNull();
    expect(decideForfeit(activeMatch({ turnDeadline: null }), NOW)).toBeNull();
  });
});
