import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { decideCancel } from "./cancelMatch.js";
import type { MatchDoc } from "../match/types.js";

function match(over: Partial<MatchDoc>): MatchDoc {
  return {
    mode: "async_duel",
    categoryMode: "spin",
    players: ["a", "b"],
    state: "active",
    roundWins: { a: 0, b: 0 },
    scoreTotals: { a: 0, b: 0 },
    currentRound: 0,
    turnUid: "a",
    turnDeadline: Timestamp.fromMillis(0),
    language: "he",
    isStrangerMatch: false,
    usedCategories: [],
    result: null,
    createdAt: Timestamp.fromMillis(0),
    finishedAt: null,
    ...over,
  };
}

describe("decideCancel", () => {
  it("cancels an active match between the exact pair", () => {
    expect(decideCancel(match({}), "a", "b")).toBe(true);
    expect(decideCancel(match({}), "b", "a")).toBe(true);
  });

  it("does not cancel a finished/forfeited/cancelled match", () => {
    expect(decideCancel(match({ state: "finished" }), "a", "b")).toBe(false);
    expect(decideCancel(match({ state: "forfeited" }), "a", "b")).toBe(false);
    expect(decideCancel(match({ state: "cancelled" }), "a", "b")).toBe(false);
  });

  it("does not cancel a match that isn't between this pair", () => {
    expect(decideCancel(match({ players: ["a", "c"] }), "a", "b")).toBe(false);
  });
});
