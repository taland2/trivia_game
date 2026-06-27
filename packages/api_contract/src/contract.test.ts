import { describe, expect, it } from "vitest";
import {
  ServingSchema,
  SubmitAnswerRequestSchema,
  SubmitAnswerResponseSchema,
  CreateDuelRequestSchema,
  StartRoundRequestSchema,
  StartRoundResponseSchema,
  StartRoundServedSchema,
  StartRoundOfferSchema,
  RoundResultSchema,
  MatchResultSchema,
  SendEmoteRequestSchema,
  SendEmoteResponseSchema,
  UsernameSchema,
  ClaimUsernameRequestSchema,
  SearchUsernameResponseSchema,
  SendFriendRequestResponseSchema,
  IssueInviteCodeResponseSchema,
  RedeemInviteCodeResponseSchema,
  DeleteAccountRequestSchema,
} from "./index.js";

const validServing = {
  servingId: "sv_abc123",
  qIx: 0,
  difficulty: "easy",
  timeLimitMs: 10000,
  text: "Which planet has the most moons?",
  answers: ["Jupiter", "Saturn", "Mars", "Neptune"],
};

describe("ServingSchema", () => {
  it("accepts the doc 07 §2.2 example payload", () => {
    expect(ServingSchema.parse(validServing)).toEqual(validServing);
  });

  it("requires exactly 4 answers", () => {
    expect(() =>
      ServingSchema.parse({ ...validServing, answers: ["A", "B", "C"] }),
    ).toThrow();
    expect(() =>
      ServingSchema.parse({
        ...validServing,
        answers: ["A", "B", "C", "D", "E"],
      }),
    ).toThrow();
  });

  // Guardrail #2 (doc 06 §5): the serving payload must never carry the correct
  // answer. The schema is strict, so a leaked field is a hard failure.
  it("rejects any payload carrying correct-answer information", () => {
    for (const leak of ["correctIx", "correct", "isCorrect", "answerKey"]) {
      expect(() =>
        ServingSchema.parse({ ...validServing, [leak]: 1 }),
      ).toThrow();
    }
  });
});

describe("SubmitAnswerRequestSchema", () => {
  const validRequest = {
    matchId: "m_1",
    roundIx: 0,
    qIx: 2,
    answerIx: 3,
    idempotencyKey: "7f9c24e5-2c3a-4b5d-9e8f-1a2b3c4d5e6f",
  };

  it("accepts a valid submission", () => {
    expect(SubmitAnswerRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it("accepts answerIx null as an explicit timeout report", () => {
    expect(
      SubmitAnswerRequestSchema.parse({ ...validRequest, answerIx: null })
        .answerIx,
    ).toBeNull();
  });

  it("rejects out-of-range indices", () => {
    expect(() =>
      SubmitAnswerRequestSchema.parse({ ...validRequest, answerIx: 4 }),
    ).toThrow();
    expect(() =>
      SubmitAnswerRequestSchema.parse({ ...validRequest, qIx: 3 }),
    ).toThrow();
    expect(() =>
      SubmitAnswerRequestSchema.parse({ ...validRequest, roundIx: 5 }),
    ).toThrow();
  });

  it("requires a UUID idempotency key (doc 07 §1)", () => {
    expect(() =>
      SubmitAnswerRequestSchema.parse({
        ...validRequest,
        idempotencyKey: "not-a-uuid",
      }),
    ).toThrow();
  });
});

describe("SubmitAnswerResponseSchema", () => {
  it("accepts a minimal scoring response", () => {
    expect(
      SubmitAnswerResponseSchema.parse({
        correctIx: 1,
        points: 133,
        basePoints: 100,
        speedBonus: 33,
      }),
    ).toEqual({ correctIx: 1, points: 133, basePoints: 100, speedBonus: 33 });
  });

  it("rejects negative or fractional points (server rounds to integer)", () => {
    expect(() =>
      SubmitAnswerResponseSchema.parse({
        correctIx: 1,
        points: -5,
        basePoints: 0,
        speedBonus: 0,
      }),
    ).toThrow();
    expect(() =>
      SubmitAnswerResponseSchema.parse({
        correctIx: 1,
        points: 133.5,
        basePoints: 100,
        speedBonus: 33.5,
      }),
    ).toThrow();
  });

  it("accepts an embedded round/match result on the closing answer", () => {
    const recapPlayer = (uid: string, score: number) => ({
      uid,
      score,
      totalMs: 12000,
      answers: [0, 1, 2].map((qIx) => ({
        qIx,
        difficulty: "easy" as const,
        correct: true,
        points: score / 3,
        ms: 4000,
      })),
    });
    const parsed = SubmitAnswerResponseSchema.parse({
      correctIx: 2,
      points: 150,
      basePoints: 100,
      speedBonus: 50,
      roundDone: true,
      roundResult: {
        roundIx: 0,
        winner: "uidA",
        players: [recapPlayer("uidA", 450), recapPlayer("uidB", 300)],
      },
      matchResult: {
        winner: "uidA",
        reason: "rounds",
        finalScore: { uidA: 3, uidB: 1 },
      },
    });
    expect(parsed.matchResult?.winner).toBe("uidA");
  });
});

describe("SendEmoteRequestSchema / SendEmoteResponseSchema", () => {
  const key = "00000000-0000-4000-8000-000000000000";

  it("requires matchId, a bounded emote key, and a UUID idempotency key", () => {
    expect(
      SendEmoteRequestSchema.parse({ matchId: "m1", emote: "fire", idempotencyKey: key }),
    ).toEqual({ matchId: "m1", emote: "fire", idempotencyKey: key });
    // empty/oversized emote and a non-uuid key are rejected; the allowed SET is
    // enforced server-side (balance), not in the contract.
    expect(() =>
      SendEmoteRequestSchema.parse({ matchId: "m1", emote: "", idempotencyKey: key }),
    ).toThrow();
    expect(() =>
      SendEmoteRequestSchema.parse({ matchId: "m1", emote: "fire", idempotencyKey: "nope" }),
    ).toThrow();
  });

  it("reports sent + non-negative remaining", () => {
    expect(SendEmoteResponseSchema.parse({ sent: true, remaining: 2 })).toEqual({
      sent: true,
      remaining: 2,
    });
    expect(() => SendEmoteResponseSchema.parse({ sent: true, remaining: -1 })).toThrow();
  });
});

describe("CreateDuelRequestSchema", () => {
  it("accepts opponent + category mode", () => {
    const key = "00000000-0000-4000-8000-000000000000";
    expect(
      CreateDuelRequestSchema.parse({
        opponentUid: "u2",
        categoryMode: "spin",
        idempotencyKey: key,
      }),
    ).toEqual({ opponentUid: "u2", categoryMode: "spin", idempotencyKey: key });
  });

  it("rejects an unknown category mode and extra fields", () => {
    expect(() =>
      CreateDuelRequestSchema.parse({ opponentUid: "u2", categoryMode: "wat" }),
    ).toThrow();
    expect(() =>
      CreateDuelRequestSchema.parse({
        opponentUid: "u2",
        categoryMode: "spin",
        sneaky: true,
      }),
    ).toThrow();
  });
});

describe("StartRoundRequestSchema / StartRoundResponseSchema", () => {
  const serving = (qIx: number) => ({
    servingId: `sv_${qIx}`,
    qIx,
    difficulty: "easy" as const,
    timeLimitMs: 10000,
    text: "Q?",
    answers: ["A", "B", "C", "D"],
  });
  const served = {
    roundIx: 0,
    category: "sports" as const,
    servings: [serving(0), serving(1), serving(2)],
  };

  it("requires a matchId; categoryId is optional but enum-constrained", () => {
    expect(StartRoundRequestSchema.parse({ matchId: "m1" })).toEqual({
      matchId: "m1",
    });
    expect(() => StartRoundRequestSchema.parse({})).toThrow();
    // categoryId must be one of the 8 launch categories (GDD §3.4).
    expect(() =>
      StartRoundRequestSchema.parse({ matchId: "m1", categoryId: "not_a_cat" }),
    ).toThrow();
  });

  it("accepts a served round with exactly 3 servings and a round in 0..4", () => {
    const parsed = StartRoundServedSchema.parse(served);
    expect(parsed.servings).toHaveLength(3);
    expect(() =>
      StartRoundServedSchema.parse({ ...served, roundIx: 5 }),
    ).toThrow();
  });

  it("carries spinResult only as an optional category in served responses", () => {
    expect(
      StartRoundServedSchema.parse({ ...served, spinResult: "sports" })
        .spinResult,
    ).toBe("sports");
    expect(() =>
      StartRoundServedSchema.parse({ ...served, spinResult: "wat" }),
    ).toThrow();
  });

  it("accepts the pick-mode locked offer of exactly 3 categories", () => {
    const offer = {
      needsPick: true as const,
      roundIx: 2,
      offered: ["sports", "music", "history"] as const,
    };
    expect(StartRoundOfferSchema.parse(offer).offered).toHaveLength(3);
    // The union resolves either variant.
    expect(StartRoundResponseSchema.parse(offer)).toMatchObject({
      needsPick: true,
    });
    expect(StartRoundResponseSchema.parse(served)).toMatchObject({
      category: "sports",
    });
  });
});

describe("RoundResultSchema / MatchResultSchema", () => {
  it("allows a uid or 'shared' as the round winner", () => {
    const players = ["uidA", "uidB"].map((uid) => ({
      uid,
      score: 300,
      totalMs: 9000,
      answers: [0, 1, 2].map((qIx) => ({
        qIx,
        difficulty: "medium" as const,
        correct: false,
        points: 0,
        ms: 3000,
      })),
    }));
    expect(
      RoundResultSchema.parse({ roundIx: 1, winner: "shared", players }).winner,
    ).toBe("shared");
  });

  it("constrains the match-result reason to the doc 08 enum", () => {
    expect(() =>
      MatchResultSchema.parse({
        winner: "uidA",
        reason: "rage_quit",
        finalScore: { uidA: 3, uidB: 0 },
      }),
    ).toThrow();
  });
});

describe("social schemas (Phase 8a)", () => {
  const key = "00000000-0000-4000-8000-000000000000";

  it("UsernameSchema enforces lowercase 3–20 [a-z0-9_]", () => {
    expect(UsernameSchema.parse("dana_k")).toBe("dana_k");
    for (const bad of ["ab", "a".repeat(21), "Dana", "has space", "emoji😀"]) {
      expect(() => UsernameSchema.parse(bad)).toThrow();
    }
  });

  it("ClaimUsername request is looser (server normalizes) but bounded + keyed", () => {
    expect(
      ClaimUsernameRequestSchema.parse({ username: "Dana_K", idempotencyKey: key }),
    ).toEqual({ username: "Dana_K", idempotencyKey: key });
    expect(() =>
      ClaimUsernameRequestSchema.parse({ username: "", idempotencyKey: key }),
    ).toThrow();
    expect(() =>
      ClaimUsernameRequestSchema.parse({ username: "x", idempotencyKey: "nope" }),
    ).toThrow();
  });

  it("SearchUsername response caps results at 10", () => {
    const hit = { uid: "u1", username: "abc", displayName: "ABC", avatarId: 0 };
    expect(SearchUsernameResponseSchema.parse({ results: [hit] }).results).toHaveLength(1);
    expect(() =>
      SearchUsernameResponseSchema.parse({ results: Array(11).fill(hit) }),
    ).toThrow();
  });

  it("friend-request state is constrained", () => {
    expect(
      SendFriendRequestResponseSchema.parse({ ok: true, state: "pending" }).state,
    ).toBe("pending");
    expect(() =>
      SendFriendRequestResponseSchema.parse({ ok: true, state: "ghosted" }),
    ).toThrow();
  });

  it("invite code is 8 chars + a URL link; redeem autoMatchId optional", () => {
    expect(
      IssueInviteCodeResponseSchema.parse({
        code: "abcd1234",
        link: "https://trivia.app/i/abcd1234",
      }).code,
    ).toBe("abcd1234");
    expect(() =>
      IssueInviteCodeResponseSchema.parse({ code: "short", link: "https://x/i/short" }),
    ).toThrow();
    expect(
      RedeemInviteCodeResponseSchema.parse({ friendUid: "u2" }).autoMatchId,
    ).toBeUndefined();
    expect(
      RedeemInviteCodeResponseSchema.parse({ friendUid: "u2", autoMatchId: "m1" })
        .autoMatchId,
    ).toBe("m1");
  });

  it("DeleteAccount requires the fixed confirm token", () => {
    expect(
      DeleteAccountRequestSchema.parse({ confirmPhrase: "DELETE", idempotencyKey: key })
        .confirmPhrase,
    ).toBe("DELETE");
    expect(() =>
      DeleteAccountRequestSchema.parse({ confirmPhrase: "delete", idempotencyKey: key }),
    ).toThrow();
  });
});
