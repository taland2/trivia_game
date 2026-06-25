import { describe, expect, it } from "vitest";
import { buildBoardRows, boardPath, dailyFriendScorePath, type BoardMember } from "./boards.js";

const m = (uid: string, points: number, level = 1): BoardMember => ({
  uid,
  name: uid,
  avatarId: 0,
  level,
  points,
});

describe("buildBoardRows ranking (GDD §7)", () => {
  it("sorts by points descending and assigns 1-based ranks", () => {
    const rows = buildBoardRows([m("a", 50), m("b", 300), m("c", 120)]);
    expect(rows.map((r) => [r.uid, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("breaks a points tie by level descending", () => {
    const rows = buildBoardRows([m("a", 100, 2), m("b", 100, 5)]);
    expect(rows.map((r) => r.uid)).toEqual(["b", "a"]);
  });

  it("breaks a points+level tie deterministically by uid", () => {
    const rows = buildBoardRows([m("zoe", 100, 3), m("amy", 100, 3)]);
    expect(rows.map((r) => r.uid)).toEqual(["amy", "zoe"]);
  });

  it("handles a solo viewer (no friends)", () => {
    const rows = buildBoardRows([m("solo", 0)]);
    expect(rows).toEqual([
      { uid: "solo", name: "solo", avatarId: 0, level: 1, points: 0, rank: 1 },
    ]);
  });

  it("handles the empty case", () => {
    expect(buildBoardRows([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [m("a", 1), m("b", 2)];
    buildBoardRows(input);
    expect(input.map((x) => x.uid)).toEqual(["a", "b"]);
  });
});

describe("projection paths", () => {
  it("builds the weekly board + daily friendScore paths", () => {
    expect(boardPath("2026-W26", "u1")).toBe("weekly/2026-W26/boards/u1");
    expect(dailyFriendScorePath("2026-06-25", "u1")).toBe(
      "daily/2026-06-25/friendScores/u1",
    );
  });
});
