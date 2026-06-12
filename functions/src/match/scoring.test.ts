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
    ["easy", 0, 150], // instant: +50% of 100
    ["easy", 5_000, 125], // half time: +25%
    ["easy", 10_000, 100], // at the buzzer: base only
    ["medium", 0, 225], // instant: +50% of 150
    ["medium", 7_500, 188], // half of 15s: 187.5 → rounds to 188
    ["medium", 15_000, 150],
    ["hard", 0, 300], // instant: +50% of 200
    ["hard", 10_000, 250], // half of 20s
    ["hard", 20_000, 200],
  ] as const)(
    "%s answered correctly at %ims → %i points",
    (difficulty, elapsedMs, expected) => {
      const result = scoreAnswer(input(difficulty, { elapsedMs }));
      expect(result).toEqual({ points: expected, timedOut: false });
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
      { points: 0, timedOut: false },
    );
  });

  it("answer past limit + grace scores 0 and is flagged timed out", () => {
    const past = difficulties.easy.timeLimitMs + servingGraceMs + 1;
    expect(scoreAnswer(input("easy", { elapsedMs: past }))).toEqual({
      points: 0,
      timedOut: true,
    });
  });

  it("a correct answer inside the grace window earns base points, no bonus (doc 07 §2.2)", () => {
    const inGrace = difficulties.easy.timeLimitMs + servingGraceMs;
    expect(scoreAnswer(input("easy", { elapsedMs: inGrace }))).toEqual({
      points: difficulties.easy.basePoints,
      timedOut: false,
    });
  });

  it("a wrong answer past the window is still a timeout (GDD §3.2: no answer ⇒ wrong, 0)", () => {
    const past = difficulties.hard.timeLimitMs + servingGraceMs + 500;
    expect(
      scoreAnswer(input("hard", { correct: false, elapsedMs: past })),
    ).toEqual({ points: 0, timedOut: true });
  });
});

describe("scoreAnswer — robustness", () => {
  it("clamps negative elapsed time to the max bonus instead of exceeding it", () => {
    expect(scoreAnswer(input("easy", { elapsedMs: -200 })).points).toBe(150);
  });
});
