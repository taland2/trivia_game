import { describe, expect, it } from "vitest";
import { shuffleAnswers, type BankQuestion } from "./questionBank.js";

function makeQ(correctIx: number): BankQuestion {
  return {
    id: "q_test",
    text: "Sample question?",
    answers: ["A", "B", "C", "D"],
    correctIx,
    difficulty: "easy",
    language: "he",
    category: "general_knowledge",
  };
}

describe("shuffleAnswers", () => {
  it("returns all 4 original answers, just reordered", () => {
    const q = makeQ(0);
    const result = shuffleAnswers(q);
    expect(result.answers).toHaveLength(4);
    expect(new Set(result.answers)).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("remaps correctIx so the correct answer is still correct after shuffle", () => {
    for (let correctIx = 0; correctIx <= 3; correctIx++) {
      const q = makeQ(correctIx);
      const originalCorrect = q.answers[correctIx]!;
      const result = shuffleAnswers(q);
      expect(result.answers[result.correctIx]).toBe(originalCorrect);
    }
  });

  it("correctIx is always within [0,3]", () => {
    for (let i = 0; i < 20; i++) {
      const result = shuffleAnswers(makeQ(Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3));
      expect(result.correctIx).toBeGreaterThanOrEqual(0);
      expect(result.correctIx).toBeLessThanOrEqual(3);
    }
  });

  it("answers array length is always exactly 4", () => {
    const result = shuffleAnswers(makeQ(2));
    expect(result.answers).toHaveLength(4);
  });

  it("over many shuffles, the correct answer appears at each position roughly equally (distribution smoke test)", () => {
    const counts = [0, 0, 0, 0];
    const N = 200;
    for (let i = 0; i < N; i++) {
      const result = shuffleAnswers(makeQ(0));
      counts[result.correctIx]!++;
    }
    // Each position should appear at least 5% of the time in 200 trials.
    for (const c of counts) {
      expect(c).toBeGreaterThan(N * 0.05);
    }
  });
});
