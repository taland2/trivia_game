import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { StartDailyRequestSchema, type StartDailyResponse } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { isDayIdInWindow } from "./dayId.js";
import {
  loadDailySet,
  loadServedDaily,
  serveDailyForPlayer,
  loadQuestions,
} from "./dailyServing.js";
import { dailyPlayPath, type DailyPlayDoc } from "./types.js";

// v1_startDaily (doc 07 §2.3, GDD §5): unlock today's daily set for the caller.
// Idempotent like v1_startRound — a resume returns the identical servings (same
// shuffle, same scoring clock) from servingsPrivate; it never re-deals.
export const v1_startDaily = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = StartDailyRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { dayId } = parsed.data;

  const db = getFirestore();
  const balance = getBalance();
  const count = balance.daily.composition.length;
  const now = Timestamp.now();

  // GDD §5 ±14h sanity window — a far-off claimed date is rejected outright.
  if (!isDayIdInWindow(dayId, now.toDate(), balance.daily.windowMs)) {
    throw new HttpsError("invalid-argument", "Day out of window", {
      reason: "day-out-of-window",
    });
  }

  // One attempt per day (GDD §5): a finished play blocks a fresh start. An
  // in-progress play falls through to the resume path below.
  const playRef = db.doc(dailyPlayPath(uid, dayId));
  const playSnap = await playRef.get();
  if (playSnap.exists && (playSnap.data() as DailyPlayDoc).finishedAt) {
    throw new HttpsError("failed-precondition", "Daily already played", {
      reason: "daily-already-played",
    });
  }

  // Resume: the player was already served this day — return the same servings.
  const alreadyServed = await loadServedDaily(db, { dayId, uid, count });
  if (alreadyServed) {
    return { dailyId: dayId, servings: alreadyServed } satisfies StartDailyResponse;
  }

  // First start: load the curated set for the player's language, serve a per-
  // player shuffle, open the play. Language comes from the minimal users/{uid}
  // doc (written client-side at sign-in, GDD §4.7); default Hebrew-first.
  const userSnap = await db.doc(`users/${uid}`).get();
  const language = (userSnap.data()?.["language"] as string) ?? "he";

  const set = await loadDailySet(db, dayId);
  const ids = set?.questionIds?.[language];
  if (!ids || ids.length !== count) {
    throw new HttpsError("not-found", "No daily set for this date", {
      reason: "daily-unavailable",
    });
  }
  const questions = await loadQuestions(db, ids);
  const servings = await serveDailyForPlayer(db, { dayId, uid, questions });

  await playRef.set({
    dayId,
    uid,
    answers: [],
    score: 0,
    correctCount: 0,
    totalMs: 0,
    finishedAt: null,
    streakAfter: null,
    startedAt: now,
  } satisfies DailyPlayDoc);

  return { dailyId: dayId, servings } satisfies StartDailyResponse;
});
