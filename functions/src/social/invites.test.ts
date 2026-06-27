import { describe, expect, it } from "vitest";
import { generateCode, isInviteExhausted, inviteLink } from "./invites.js";

describe("generateCode", () => {
  it("is 8 chars of [A-Za-z0-9]", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCode();
      expect(c).toHaveLength(8);
      expect(/^[A-Za-z0-9]{8}$/.test(c)).toBe(true);
    }
  });

  it("is deterministic given a seeded rand (testability)", () => {
    const rand = () => 0; // always first char
    expect(generateCode(rand)).toBe("AAAAAAAA");
  });
});

describe("isInviteExhausted", () => {
  it("true at or above the cap", () => {
    expect(isInviteExhausted(50, 50)).toBe(true);
    expect(isInviteExhausted(51, 50)).toBe(true);
  });
  it("false below the cap", () => {
    expect(isInviteExhausted(0, 50)).toBe(false);
    expect(isInviteExhausted(49, 50)).toBe(false);
  });
});

describe("inviteLink", () => {
  it("builds a /i/{code} url", () => {
    expect(inviteLink("abcd1234")).toMatch(/\/i\/abcd1234$/);
  });
});
