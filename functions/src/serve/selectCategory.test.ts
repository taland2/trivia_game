import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@trivia/api-contract";
import {
  chooseAutoCategory,
  chooseSpinCategory,
  offerPickCategories,
} from "./selectCategory.js";

const ALL = [...CATEGORIES];

describe("chooseSpinCategory (GDD §4.3 spin)", () => {
  it("always lands on one of the 8 launch categories", () => {
    for (let i = 0; i < 50; i++) {
      expect(ALL).toContain(chooseSpinCategory());
    }
  });
});

describe("chooseAutoCategory (GDD §4.3 auto, no-repeat)", () => {
  it("never repeats a used category while unused ones remain", () => {
    const used = ALL.slice(0, 7); // 7 used, exactly 1 unused
    for (let i = 0; i < 50; i++) {
      expect(chooseAutoCategory(used)).toBe(ALL[7]);
    }
  });

  it("excludes every used category when several remain unused", () => {
    const used = ALL.slice(0, 3);
    for (let i = 0; i < 50; i++) {
      expect(used).not.toContain(chooseAutoCategory(used));
    }
  });

  it("resets to the full set once all categories are used", () => {
    for (let i = 0; i < 20; i++) {
      expect(ALL).toContain(chooseAutoCategory(ALL));
    }
  });
});

describe("offerPickCategories (GDD §4.3 pick)", () => {
  it("offers exactly 3 distinct valid categories", () => {
    for (let i = 0; i < 50; i++) {
      const offer = offerPickCategories([]);
      expect(offer).toHaveLength(3);
      expect(new Set(offer).size).toBe(3);
      offer.forEach((c) => expect(ALL).toContain(c));
    }
  });

  it("prefers unused categories when at least 3 remain", () => {
    const used = ALL.slice(0, 5); // 3 unused remain
    for (let i = 0; i < 50; i++) {
      const offer = offerPickCategories(used);
      offer.forEach((c) => expect(used).not.toContain(c));
    }
  });

  it("still returns 3 by filling from used when fewer than 3 are unused", () => {
    const used = ALL.slice(0, 7); // only 1 unused
    for (let i = 0; i < 50; i++) {
      const offer = offerPickCategories(used);
      expect(offer).toHaveLength(3);
      expect(offer).toContain(ALL[7]); // the lone unused is always offered
    }
  });
});
