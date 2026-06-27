import { describe, expect, it } from "vitest";
import { normalizeUsername, validateUsername } from "./username.js";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  Dana_K  ")).toBe("dana_k");
    expect(normalizeUsername("ALLCAPS")).toBe("allcaps");
  });
});

describe("validateUsername", () => {
  it("accepts legal handles", () => {
    for (const ok of ["dana", "dana_k", "abc", "a".repeat(20), "user_123"]) {
      expect(validateUsername(ok)).toBeNull();
    }
  });

  it("rejects bad charset/length as 'invalid'", () => {
    for (const bad of ["ab", "a".repeat(21), "Dana", "has space", "dot.dot", "emoji😀", "שלום"]) {
      expect(validateUsername(bad)).toBe("invalid");
    }
  });

  it("rejects profanity (including embedded) as 'profane'", () => {
    expect(validateUsername("fuck")).toBe("profane");
    expect(validateUsername("xfuckx")).toBe("profane");
    expect(validateUsername("clean_name")).toBeNull();
  });
});
