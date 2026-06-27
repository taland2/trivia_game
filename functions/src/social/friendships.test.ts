import { describe, expect, it } from "vitest";
import { pairId, friendshipPath, eitherBlocks } from "./friendships.js";

describe("pairId", () => {
  it("is order-independent (one doc per pair)", () => {
    expect(pairId("a", "b")).toBe("a_b");
    expect(pairId("b", "a")).toBe("a_b");
    expect(pairId("zoe", "amy")).toBe("amy_zoe");
  });
  it("friendshipPath uses the sorted id", () => {
    expect(friendshipPath("b", "a")).toBe("friendships/a_b");
  });
});

describe("eitherBlocks", () => {
  it("true when A blocks B", () => {
    expect(eitherBlocks(["b"], [], "a", "b")).toBe(true);
  });
  it("true when B blocks A (the reverse direction)", () => {
    expect(eitherBlocks([], ["a"], "a", "b")).toBe(true);
  });
  it("false when neither blocks", () => {
    expect(eitherBlocks(["x"], ["y"], "a", "b")).toBe(false);
  });
});
