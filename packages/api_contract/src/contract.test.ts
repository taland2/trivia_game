import { describe, expect, it } from "vitest";
import {
  ServingSchema,
  SubmitAnswerRequestSchema,
  SubmitAnswerResponseSchema,
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
      SubmitAnswerResponseSchema.parse({ correctIx: 1, points: 133 }),
    ).toEqual({ correctIx: 1, points: 133 });
  });

  it("rejects negative or fractional points (server rounds to integer)", () => {
    expect(() =>
      SubmitAnswerResponseSchema.parse({ correctIx: 1, points: -5 }),
    ).toThrow();
    expect(() =>
      SubmitAnswerResponseSchema.parse({ correctIx: 1, points: 133.5 }),
    ).toThrow();
  });
});
