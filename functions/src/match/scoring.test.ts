import { describe, expect, it } from "vitest";
import { defaultBalance } from "../config/balance.js";
import { scoreAnswer, type ScoringInput } from "./scoring.js";

const { difficulties, speedBonusMax, servingGraceMs } = defaultBalance;

function input(
  difficulty: keyof typeof difficulties,
  overrides: Partial<ScoringInput> = {},
): ScoringInput {
  const d = difficulties[difficulty];
  return {
    correct: true,
    elapsedMs: 0,
    timeLimitMs: d.timeLimitMs,
    graceMs: servingGraceMs,
    basePoints: d.basePoints,
    speedBonusMax,
    ...overrides,
  };
}

// GDD §3.3: points = base × (1 + 0.5 × time_remaining / time_limit) if correct.
describe("scoreAnswer — GDD §3.3 formula table", () => {
  it.each([
    // [difficulty, elapsedMs, expected points]
    // ── Easy (base 100, limit 10 000ms) ──────────────────────────────────────
    ["easy", 0, 150],      // instant: 100 × (1 + 0.5×1.0) = 150
    ["easy", 2_500, 138],  // 75% remaining: 100 × 1.375 = 137.5 → 138
    ["easy", 5_000, 125],  // 50% remaining: 100 × 1.25 = 125
    ["easy", 7_500, 113],  // 25% remaining: 100 × 1.125 = 112.5 → 113
    ["easy", 10_000, 100], // at the buzzer: base only
    // ── Medium (base 150, limit 15 000ms) ────────────────────────────────────
    ["medium", 0, 225],     // 150 × 1.5 = 225
    ["medium", 7_500, 188], // 187.5 → 188
    ["medium", 15_000, 150],
    // ── Hard (base 200, limit 20 000ms) ──────────────────────────────────────
    ["hard", 0, 300],       // 200 × 1.5 = 300
    ["hard", 5_000, 275],   // 75% remaining: 200 × 1.375 = 275
    ["hard", 10_000, 250],  // 50% remaining: 200 × 1.25 = 250
    ["hard", 15_000, 225],  // 25% remaining: 200 × 1.125 = 225
    ["hard", 20_000, 200],  // at the buzzer: base only
  ] as const)(
    "%s answered correctly at %ims → %i points",
    (difficulty, elapsedMs, expected) => {
      const result = scoreAnswer(input(difficulty, { elapsedMs }));
      expect(result.points).toBe(expected);
      expect(result.timedOut).toBe(false);
      // H6 invariant: the returned split always reconstructs the total, and the
      // base is the difficulty's flat base.
      expect(result.basePoints).toBe(difficulties[difficulty].basePoints);
      expect(result.basePoints + result.speedBonus).toBe(expected);
    },
  );

  it("rounds to the nearest integer", () => {
    // easy at 3,333ms: remaining 6,667/10,000 → 100 × 1.33335 = 133.335 → 133
    expect(scoreAnswer(input("easy", { elapsedMs: 3_333 })).points).toBe(133);
    // easy at 3,300ms: 100 × 1.335 = 133.5 → 134
    expect(scoreAnswer(input("easy", { elapsedMs: 3_300 })).points).toBe(134);
  });
});

describe("scoreAnswer — wrong answers and timeouts", () => {
  it("wrong answer scores 0 regardless of speed", () => {
    expect(scoreAnswer(input("easy", { correct: false, elapsedMs: 0 }))).toEqual(
      { points: 0, basePoints: 0, speedBonus: 0, timedOut: false },
    );
  });

  it("answer past limit + grace scores 0 and is flagged timed out", () => {
    const past = difficulties.easy.timeLimitMs + servingGraceMs + 1;
    expect(scoreAnswer(input("easy", { elapsedMs: past }))).toEqual({
      points: 0,
      basePoints: 0,
      speedBonus: 0,
      timedOut: true,
    });
  });

  it("a correct answer inside the grace window earns base points, no bonus (doc 07 §2.2)", () => {
    const inGrace = difficulties.easy.timeLimitMs + servingGraceMs;
    expect(scoreAnswer(input("easy", { elapsedMs: inGrace }))).toEqual({
      points: difficulties.easy.basePoints,
      basePoints: difficulties.easy.basePoints,
      speedBonus: 0,
      timedOut: false,
    });
  });

  it("a wrong answer past the window is still a timeout (GDD §3.2: no answer ⇒ wrong, 0)", () => {
    const past = difficulties.hard.timeLimitMs + servingGraceMs + 500;
    expect(
      scoreAnswer(input("hard", { correct: false, elapsedMs: past })),
    ).toEqual({ points: 0, basePoints: 0, speedBonus: 0, timedOut: true });
  });
});

describe("scoreAnswer — robustness", () => {
  it("clamps negative elapsed time to the max bonus instead of exceeding it", () => {
    expect(scoreAnswer(input("easy", { elapsedMs: -200 })).points).toBe(150);
  });
});
