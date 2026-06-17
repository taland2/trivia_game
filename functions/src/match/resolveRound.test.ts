import { describe, expect, it } from "vitest";
import { resolveRoundWinner, resolveMatchWinner } from "./resolveRound.js";

describe("resolveRoundWinner (GDD §4.5)", () => {
  it("awards the round to the higher total score", () => {
    expect(
      resolveRoundWinner(
        { uid: "a", score: 420, totalMs: 9000 },
        { uid: "b", score: 300, totalMs: 5000 },
      ),
    ).toBe("a");
    expect(
      resolveRoundWinner(
        { uid: "a", score: 300, totalMs: 5000 },
        { uid: "b", score: 420, totalMs: 9000 },
      ),
    ).toBe("b");
  });

  it("breaks a points tie by lower total answer time", () => {
    expect(
      resolveRoundWinner(
        { uid: "a", score: 300, totalMs: 12000 },
        { uid: "b", score: 300, totalMs: 8000 },
      ),
    ).toBe("b");
  });

  it("returns 'shared' on an exact points-and-time tie (Phase 4 replay edge)", () => {
    expect(
      resolveRoundWinner(
        { uid: "a", score: 300, totalMs: 8000 },
        { uid: "b", score: 300, totalMs: 8000 },
      ),
    ).toBe("shared");
  });
});

describe("resolveMatchWinner (GDD §4.1, best-of-5 → 3)", () => {
  it("is undecided below the threshold", () => {
    expect(resolveMatchWinner({ a: 2, b: 2 }, 3)).toBeNull();
    expect(resolveMatchWinner({ a: 0, b: 0 }, 3)).toBeNull();
  });

  it("declares the player who reaches the win threshold", () => {
    expect(resolveMatchWinner({ a: 3, b: 0 }, 3)).toBe("a"); // 3-0 sweep
    expect(resolveMatchWinner({ a: 2, b: 3 }, 3)).toBe("b"); // 2-3 decider
  });
});
