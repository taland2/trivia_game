import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import {
  SubmitDailyAnswerRequestSchema,
  type Difficulty,
  type Streak,
  type DailyResult,
} from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { scoreAnswer } from "../match/scoring.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import {
  applyWeeklyPoints,
  weeklyPointsForDaily,
  xpForSubmit,
  xpForDailyCompletion,
  nextUserXp,
} from "../economy/grants.js";
import { dailyServingKey } from "./dailyServing.js";
import { nextStreak } from "./streak.js";
import { dailyPlayPath, type DailyPlayDoc } from "./types.js";

// v1_submitDailyAnswer (doc 07 §2.3, GDD §5). Mirrors v1_submitAnswer: server-
// authoritative timing, idempotency-guarded, scoring per §3.3. The 10th answer
// finishes the play — grants the completion XP + weekly points and advances the
// streak — and returns {dailyResult, streak}.
export const v1_submitDailyAnswer = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = SubmitDailyAnswerRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }
    const { dayId, qIx, answerIx, idempotencyKey } = parsed.data;

    const db = getFirestore();
    const balance = getBalance();
    const now = Timestamp.now();
    const lastQ = qIx === balance.daily.composition.length - 1;

    // Private serving (function-only): answer key + immutable scoring clock. Read
    // outside the transaction — it never changes after serving.
    const servingRef = db.doc(`servingsPrivate/${dailyServingKey(dayId, qIx, uid)}`);
    const privSnap = await servingRef.get();
    if (!privSnap.exists) {
      throw new HttpsError("not-found", "Serving not found", {
        reason: "daily-unavailable",
      });
    }
    const priv = privSnap.data()!;
    const servedAt = priv["servedAt"] as Timestamp;
    const timeLimitMs = priv["timeLimitMs"] as number;
    const correctIx = priv["correctIx"] as number;
    const difficulty = priv["difficulty"] as Difficulty;

    // Server-authoritative timing (doc 06 §4 — client times are display-only).
    const rawElapsedMs = now.toMillis() - servedAt.toMillis();
    const { basePoints: difficultyBase } = balance.difficulties[difficulty];
    const { points, basePoints, speedBonus, timedOut } = scoreAnswer({
      correct: answerIx === correctIx,
      elapsedMs: rawElapsedMs,
      timeLimitMs,
      graceMs: balance.servingGraceMs,
      basePoints: difficultyBase,
      speedBonusMax: balance.speedBonusMax,
    });
    // Clamp stored elapsed into [0, limit+grace] (clock skew / late submit).
    const elapsedMs = Math.min(
      Math.max(rawElapsedMs, 0),
      timeLimitMs + balance.servingGraceMs,
    );
    const correct = answerIx === correctIx && !timedOut;

    const iref = idempRef(db, uid, idempotencyKey);
    const playRef = db.doc(dailyPlayPath(uid, dayId));
    const userRef = db.doc(`users/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const cached = await readIdempotent(tx, iref);
      if (cached !== null) return cached;

      const playSnap = await tx.get(playRef);
      if (!playSnap.exists) {
        throw new HttpsError("not-found", "Daily not started", {
          reason: "daily-unavailable",
        });
      }
      const play = playSnap.data() as DailyPlayDoc;
      if (play.finishedAt) {
        throw new HttpsError("failed-precondition", "Daily already played", {
          reason: "daily-already-played",
        });
      }
      // Sequential answering (GDD §11): no skipping; a legit retry short-circuits
      // on the idempotency check above before reaching here.
      if (qIx !== play.answers.length) {
        throw new HttpsError("failed-precondition", "Answer questions in order", {
          reason: "out-of-order",
        });
      }

      // User doc read (reads precede writes): current xp + prior streak.
      const userSnap = await tx.get(userRef);
      const baseXp = (userSnap.data()?.["xp"] as number) ?? 0;
      const prevStreak = userSnap.data()?.["streak"] as Streak | undefined;

      // Record the answer.
      play.answers.push({ qIx, answerIx, correct, points, ms: elapsedMs });
      play.score += points;
      play.totalMs += elapsedMs;
      if (correct) play.correctCount += 1;

      let xpDelta = xpForSubmit(correct, balance);

      const res: {
        correctIx: number;
        points: number;
        basePoints: number;
        speedBonus: number;
        dailyDone?: boolean;
        dailyResult?: DailyResult;
        streak?: Streak;
      } = { correctIx, points, basePoints, speedBonus };

      // Accumulate every user-doc field into ONE merge write (a transaction must
      // not issue two sets to the same ref).
      const userUpdate: Record<string, unknown> = {};

      if (lastQ) {
        play.finishedAt = now;
        const streak = nextStreak(prevStreak, dayId);
        play.streakAfter = streak.count;
        userUpdate["streak"] = streak;

        xpDelta += xpForDailyCompletion(balance);
        const weeklyPoints = weeklyPointsForDaily(play.score, balance);
        applyWeeklyPoints(tx, db, now.toDate(), uid, weeklyPoints, "dailies");

        res.dailyDone = true;
        res.dailyResult = {
          dayId,
          score: play.score,
          correctCount: play.correctCount,
          totalMs: play.totalMs,
          weeklyPointsAwarded: weeklyPoints,
        };
        res.streak = streak;
      }

      if (xpDelta > 0) Object.assign(userUpdate, nextUserXp(baseXp, xpDelta, balance));
      if (Object.keys(userUpdate).length > 0) {
        tx.set(userRef, userUpdate, { merge: true });
      }
      tx.set(playRef, play);
      tx.update(servingRef, { answeredAt: now });
      writeIdempotent(tx, iref, res, now);
      return res;
    });

    return result;
  },
);
