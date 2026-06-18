import { describe, expect, it } from "vitest";
import {
  weeklyPointsForWin,
  weeklyPointsForLoss,
  weeklyPointsForForfeitWin,
  xpForSubmit,
  xpForCompletion,
  levelForXp,
  nextUserXp,
} from "./grants.js";
import { defaultBalance as b } from "../config/balance.js";

describe("weekly point formulas (GDD §7)", () => {
  it("match win = flat + round(score / divisor)", () => {
    expect(weeklyPointsForWin(0, b)).toBe(100);
    expect(weeklyPointsForWin(1240, b)).toBe(112); // 100 + round(12.4)
    expect(weeklyPointsForWin(1250, b)).toBe(113); // 100 + round(12.5)
  });

  it("match loss (played) = round(score / divisor), no flat", () => {
    expect(weeklyPointsForLoss(0, b)).toBe(0);
    expect(weeklyPointsForLoss(840, b)).toBe(8);
    expect(weeklyPointsForLoss(850, b)).toBe(9);
  });

  it("forfeit win = flat, independent of score", () => {
    expect(weeklyPointsForForfeitWin(b)).toBe(100);
  });
});

describe("XP formulas (GDD §8)", () => {
  it("awards perCorrect XP only for correct answers", () => {
    expect(xpForSubmit(true, b)).toBe(2);
    expect(xpForSubmit(false, b)).toBe(0);
  });

  it("completion XP adds the win bonus only for the winner", () => {
    expect(xpForCompletion(false, b)).toBe(20);
    expect(xpForCompletion(true, b)).toBe(50); // 20 + 30
  });
});

describe("levelForXp (curve: 100 × n^1.5)", () => {
  it("is at least level 1 for any non-positive xp", () => {
    expect(levelForXp(0, b)).toBe(1);
    expect(levelForXp(-5, b)).toBe(1);
    expect(levelForXp(50, b)).toBe(1);
  });

  it("crosses level thresholds at base × n^1.5", () => {
    // L2 needs 100×2^1.5 ≈ 282.8 ; L3 needs 100×3^1.5 ≈ 519.6
    expect(levelForXp(282, b)).toBe(1);
    expect(levelForXp(283, b)).toBe(2);
    expect(levelForXp(519, b)).toBe(2);
    expect(levelForXp(520, b)).toBe(3);
  });

  it("is monotonic non-decreasing in xp", () => {
    let prev = 1;
    for (let xp = 0; xp <= 20_000; xp += 137) {
      const lvl = levelForXp(xp, b);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });
});

describe("nextUserXp", () => {
  it("adds the delta and recomputes the level from the total", () => {
    expect(nextUserXp(280, 3, b)).toEqual({ xp: 283, level: 2 });
    expect(nextUserXp(0, 0, b)).toEqual({ xp: 0, level: 1 });
  });
});
