import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import {
  SubmitAnswerRequestSchema,
  type Difficulty,
  type RecapPlayer,
  type RoundResult,
  type MatchResult,
} from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { scoreAnswer } from "./scoring.js";
import { servingKey } from "../serve/roundServing.js";
import { resolveRoundWinner, resolveMatchWinner } from "./resolveRound.js";
import { matchListEntryFor, matchListPath } from "./matchList.js";
import { deadlineFrom } from "./turn.js";
import {
  applyWeeklyPoints,
  weeklyPointsForWin,
  weeklyPointsForLoss,
  xpForSubmit,
  xpForCompletion,
  nextUserXp,
} from "../economy/grants.js";
import type { MatchDoc, RoundDoc, RoundPlayerState, RecapDoc } from "./types.js";

// Build the post-reveal recap player payload from a finished round's state.
function recapPlayer(
  uid: string,
  state: RoundPlayerState,
  difficulties: Difficulty[],
): RecapPlayer {
  return {
    uid,
    score: state.score,
    totalMs: state.totalMs,
    answers: state.answers
      .slice()
      .sort((x, y) => x.qIx - y.qIx)
      .map((a) => ({
        qIx: a.qIx,
        difficulty: difficulties[a.qIx]!,
        correct: a.correct,
        points: a.points,
        ms: a.ms,
      })),
  };
}

export const v1_submitAnswer = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = SubmitAnswerRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { matchId, roundIx, qIx, answerIx, idempotencyKey } = parsed.data;

  const db = getFirestore();
  const balance = getBalance();
  const now = Timestamp.now();

  // The serving key folds in the round's replay attempt (GDD §4.5), so read the
  // round's current attempt first; a missing round means nothing was served.
  const roundRef = db.doc(`matches/${matchId}/rounds/${roundIx}`);
  const preRoundSnap = await roundRef.get();
  if (!preRoundSnap.exists) {
    throw new HttpsError("not-found", "Round not started", { reason: "match" });
  }
  const attempt = (preRoundSnap.data() as RoundDoc).attempt;

  // Private serving (function-only) holds the answer key + the immutable scoring
  // clock. Read outside the transaction — it never changes after serving.
  const servingRef = db.doc(
    `servingsPrivate/${servingKey(matchId, roundIx, qIx, uid, attempt)}`,
  );
  const privSnap = await servingRef.get();
  if (!privSnap.exists) {
    throw new HttpsError("not-found", "Serving not found", { reason: "match" });
  }
  const priv = privSnap.data()!;
  const servedAt = priv["servedAt"] as Timestamp;
  const timeLimitMs = priv["timeLimitMs"] as number;
  const correctIx = priv["correctIx"] as number;
  const difficulty = priv["difficulty"] as Difficulty;

  // Server-authoritative timing (doc 06 §4 — client times are display-only).
  const elapsedMs = now.toMillis() - servedAt.toMillis();
  const { basePoints } = balance.difficulties[difficulty];
  const { points, timedOut } = scoreAnswer({
    correct: answerIx === correctIx,
    elapsedMs,
    timeLimitMs,
    graceMs: balance.servingGraceMs,
    basePoints,
    speedBonusMax: balance.speedBonusMax,
  });
  const correct = answerIx === correctIx && !timedOut;
  const lastQ = qIx === balance.match.roundComposition.length - 1;

  const idempRef = db.doc(`idempotency/${uid}_${idempotencyKey}`);
  const matchRef = db.doc(`matches/${matchId}`);

  // Everything that mutates match state runs in one transaction so two last
  // answers landing together resolve the round exactly once (doc 12 race test).
  const result = await db.runTransaction(async (tx) => {
    const idempSnap = await tx.get(idempRef);
    if (idempSnap.exists) {
      return idempSnap.data()!["result"];
    }

    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) {
      throw new HttpsError("not-found", "Match not found", { reason: "match" });
    }
    const match = matchSnap.data() as MatchDoc;
    if (!match.players.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a participant", {
        reason: "not-participant",
      });
    }
    if (match.state !== "active") {
      throw new HttpsError("failed-precondition", "Match is over", {
        reason: "match-finished",
      });
    }
    if (match.turnUid !== uid) {
      throw new HttpsError("failed-precondition", "Not your turn", {
        reason: "not-your-turn",
      });
    }

    const roundSnap = await tx.get(roundRef);
    if (!roundSnap.exists) {
      throw new HttpsError("not-found", "Round not started", { reason: "match" });
    }
    const round = roundSnap.data() as RoundDoc;

    const opponentUid = match.players.find((p) => p !== uid)!;

    // Read both players' user docs now (reads must precede writes in a txn) so XP
    // grants below are computed from current totals and written at the end. XP is
    // accumulated in memory; only players who actually earn XP get written.
    const userRefs: Record<string, FirebaseFirestore.DocumentReference> = {
      [uid]: db.doc(`users/${uid}`),
      [opponentUid]: db.doc(`users/${opponentUid}`),
    };
    const [mySnap, oppSnap] = await Promise.all([
      tx.get(userRefs[uid]!),
      tx.get(userRefs[opponentUid]!),
    ]);
    const baseXp: Record<string, number> = {
      [uid]: (mySnap.data()?.["xp"] as number) ?? 0,
      [opponentUid]: (oppSnap.data()?.["xp"] as number) ?? 0,
    };
    const xpDelta: Record<string, number> = { [uid]: 0, [opponentUid]: 0 };

    const me: RoundPlayerState = round.perPlayer[uid] ?? {
      done: false,
      score: 0,
      totalMs: 0,
      answers: [],
    };
    if (me.done || me.answers.some((a) => a.qIx === qIx)) {
      throw new HttpsError("failed-precondition", "Already answered", {
        reason: "already-answered",
      });
    }

    // Record this answer.
    me.answers.push({ qIx, answerIx, correct, points, ms: elapsedMs });
    me.score += points;
    me.totalMs += elapsedMs;
    if (lastQ) me.done = true;
    round.perPlayer[uid] = me;

    // XP: +perCorrect for a correct answer, every submit (GDD §8).
    xpDelta[uid]! += xpForSubmit(correct, balance);

    const oppDone = round.perPlayer[opponentUid]?.done === true;
    const bothDone = me.done && oppDone;

    const res: {
      correctIx: number;
      points: number;
      roundDone?: boolean;
      replay?: boolean;
      roundResult?: RoundResult;
      matchResult?: MatchResult;
    } = { correctIx, points };
    if (lastQ) res.roundDone = true;

    // Mutable copy of match fields we may change, for the matchList projection.
    let matchChanged = false;

    if (lastQ && bothDone) {
      const winner = resolveRoundWinner(
        { uid, score: me.score, totalMs: me.totalMs },
        {
          uid: opponentUid,
          score: round.perPlayer[opponentUid]!.score,
          totalMs: round.perPlayer[opponentUid]!.totalMs,
        },
      );

      if (winner === "shared") {
        // --- Exact points-and-time tie → replay the round (GDD §4.5) ----------
        // Flag the re-deal and hand the turn back to the starter; no reveal, no
        // round win, no score banked. The next v1_startRound re-deals fresh
        // questions (the picks happen outside this transaction). No round advance.
        round.winner = "shared";
        round.needsReplay = true;
        match.turnUid = round.starterUid;
        match.turnDeadline = deadlineFrom(now, balance);
        res.replay = true;
        matchChanged = true;
      } else {
        // --- Resolve the round (GDD §4.5) -------------------------------------
        round.winner = winner;
        match.roundWins[winner] = (match.roundWins[winner] ?? 0) + 1;
        // Weekly "match score" = winning rounds only (GDD §7, product decision):
        // bank the winner's score for this round; the loser banks nothing.
        match.scoreTotals[winner] =
          (match.scoreTotals[winner] ?? 0) + round.perPlayer[winner]!.score;

        // Reveal projection — written only now that both players are done.
        const recap: RecapDoc = {
          roundIx,
          category: round.category,
          winner,
          players: match.players.map((p) =>
            recapPlayer(p, round.perPlayer[p]!, round.difficulties),
          ),
          revealedAt: now,
        };
        tx.set(db.doc(`matches/${matchId}/recaps/${roundIx}`), recap);

        res.roundResult = {
          roundIx,
          winner,
          players: recap.players,
        };

        // --- Resolve the match if decided (GDD §4.1) --------------------------
        const matchWinner = resolveMatchWinner(
          match.roundWins,
          balance.match.roundsToWin,
        );
        if (matchWinner) {
          const matchLoser = match.players.find((p) => p !== matchWinner)!;
          match.state = "finished";
          match.turnUid = null;
          match.turnDeadline = null;
          match.finishedAt = now;

          // Economy on resolution (GDD §7/§8). Completion XP for both, +win bonus
          // for the winner; weekly points from the winning-rounds score totals.
          xpDelta[matchWinner]! += xpForCompletion(true, balance);
          xpDelta[matchLoser]! += xpForCompletion(false, balance);
          const winPoints = weeklyPointsForWin(
            match.scoreTotals[matchWinner] ?? 0,
            balance,
          );
          const lossPoints = weeklyPointsForLoss(
            match.scoreTotals[matchLoser] ?? 0,
            balance,
          );
          applyWeeklyPoints(tx, db, now.toDate(), matchWinner, winPoints, "duels");
          applyWeeklyPoints(tx, db, now.toDate(), matchLoser, lossPoints, "duels");

          match.result = {
            winner: matchWinner,
            reason: "rounds",
            finalScore: { ...match.roundWins },
            weeklyPointsAwarded: {
              [matchWinner]: winPoints,
              [matchLoser]: lossPoints,
            },
          };
          res.matchResult = match.result;
        } else {
          // Advance to the next round; its starter (GDD §4.2 alternation) leads.
          match.currentRound = roundIx + 1;
          match.turnUid = match.players[match.currentRound % 2]!;
          match.turnDeadline = deadlineFrom(now, balance);
        }
        matchChanged = true;
      }
    } else if (lastQ && !bothDone) {
      // First player finished the round — hand the same round to the opponent.
      match.turnUid = opponentUid;
      match.turnDeadline = deadlineFrom(now, balance);
      matchChanged = true;
    }

    tx.set(roundRef, round);
    tx.update(servingRef, { answeredAt: now });

    // Persist XP for any player who earned some (recomputed level from total).
    for (const p of match.players) {
      if (xpDelta[p]! > 0) {
        tx.set(
          userRefs[p]!,
          nextUserXp(baseXp[p]!, xpDelta[p]!, balance),
          { merge: true },
        );
      }
    }

    if (matchChanged) {
      tx.set(matchRef, match);
      for (const p of match.players) {
        tx.set(
          db.doc(matchListPath(p, matchId)),
          matchListEntryFor(matchId, match, p, now),
        );
      }
    }

    tx.set(idempRef, { result: res, createdAt: now });
    return res;
  });

  return result;
});
