// Emulator integration — Daily Challenge (GDD §5, doc 07 §2.3). Covers the full
// 10-question flow + grants, the ±14h window guard, one-attempt lockout, resume
// idempotency, sequential answering, and the streak (GDD §5). Requires the
// emulator suite running.

import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

const PROJECT = "demo-trivia-dev";
const REGION = "me-west1";
const HOST = "127.0.0.1";

process.env["FIRESTORE_EMULATOR_HOST"] = `${HOST}:8088`;
process.env["GCLOUD_PROJECT"] = PROJECT;

import {
  initializeApp as adminInitApp,
  deleteApp as adminDeleteApp,
  type App as AdminApp,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initClient, deleteApp as deleteClient } from "firebase/app";
import {
  getAuth, connectAuthEmulator, signInAnonymously, type Auth,
} from "firebase/auth";
import {
  getFunctions, connectFunctionsEmulator, httpsCallable, type Functions,
} from "firebase/functions";
import {
  getFirestore as getClientFirestore, connectFirestoreEmulator,
  doc as clientDoc, setDoc, type Firestore as ClientFirestore,
} from "firebase/firestore";

import { weekId } from "../lib/economy/weekId.js";

// 3 Easy + 4 Medium + 3 Hard (GDD §5). Stable question doc ids the daily set references.
const COMPOSITION = [
  "easy", "easy", "easy",
  "medium", "medium", "medium", "medium",
  "hard", "hard", "hard",
] as const;

function utcDayId(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
const TODAY = utcDayId(0);
const YESTERDAY = utcDayId(-1);

let adminApp: AdminApp;
let adminDb: FirebaseFirestore.Firestore;

interface Client { fns: Functions; fs: ClientFirestore; auth: Auth; uid: string }
let U: Client;

async function makeClient(name: string): Promise<Client> {
  const app = initClient({ projectId: PROJECT, apiKey: "fake-key" }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const fs = getClientFirestore(app);
  connectFirestoreEmulator(fs, HOST, 8088);
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, HOST, 5001);
  const cred = await signInAnonymously(auth);
  return { fns, fs, auth, uid: cred.user.uid };
}

function call<T = any>(c: Client, fn: string, data: unknown): Promise<T> {
  return httpsCallable(c.fns, fn)(data).then((r) => r.data as T);
}
async function expectReason(p: Promise<unknown>, reason: string): Promise<void> {
  await expect(p).rejects.toMatchObject({ details: { reason } });
}

async function dailyCorrectIx(dayId: string, qIx: number, uid: string): Promise<number> {
  const snap = await adminDb.doc(`servingsPrivate/daily_${dayId}_${qIx}_${uid}`).get();
  return snap.data()!["correctIx"] as number;
}

// Answer all 10 daily questions; `correctly` controls right/wrong. Returns the
// final (10th) response (carries dailyResult + streak).
async function playDaily(c: Client, dayId: string, correctly: boolean): Promise<any> {
  const start = await call(c, "v1_startDaily", { dayId });
  let last: any;
  for (const s of start.servings as Array<{ qIx: number }>) {
    const correctIx = await dailyCorrectIx(dayId, s.qIx, c.uid);
    const answerIx = correctly ? correctIx : (correctIx + 1) % 4;
    last = await call(c, "v1_submitDailyAnswer", {
      dayId, qIx: s.qIx, answerIx, idempotencyKey: crypto.randomUUID(),
    });
  }
  return last;
}

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-daily");
  adminDb = getAdminFirestore(adminApp);

  // Seed 10 questions (one per composition slot) + a daily set for today and
  // yesterday pointing at them (he language only — the test user plays in he).
  const batch = adminDb.batch();
  const ids: string[] = [];
  COMPOSITION.forEach((difficulty, i) => {
    const id = `dq_${i}_${difficulty}`;
    ids.push(id);
    batch.set(adminDb.doc(`questions/${id}`), {
      text: `daily ${i}?`,
      answers: ["A", "B", "C", "D"],
      correctIx: 0, difficulty, language: "he", category: "general_knowledge",
      source: "integration-test",
    });
  });
  for (const dayId of [TODAY, YESTERDAY]) {
    batch.set(adminDb.doc(`dailySets/${dayId}`), {
      questionIds: { he: ids }, publishAt: new Date(`${dayId}T00:00:00Z`),
    });
  }
  await batch.commit();

  U = await makeClient("dailyU");
});

async function resetUser(): Promise<void> {
  await adminDb.doc(`users/${U.uid}`).set({ language: "he", isGuest: true }, { merge: false });
  const wk = weekId(new Date());
  await adminDb.doc(`weekly/${wk}/scores/${U.uid}`).delete();
  // Clear this user's daily plays + daily servings so a fresh start re-serves.
  for (const dayId of [TODAY, YESTERDAY]) {
    await adminDb.doc(`dailyPlays/${U.uid}_${dayId}`).delete().catch(() => {});
    await Promise.all(
      COMPOSITION.map((_, qIx) =>
        adminDb.doc(`servingsPrivate/daily_${dayId}_${qIx}_${U.uid}`).delete().catch(() => {}),
      ),
    );
  }
}
beforeEach(async () => { await resetUser(); });

afterAll(async () => {
  await Promise.allSettled([deleteClient((U.fns as any).app), adminDeleteApp(adminApp)]);
});

describe("Daily Challenge (GDD §5)", () => {
  it("plays a full 10-question daily, grants XP + weekly points + streak", async () => {
    const last = await playDaily(U, TODAY, true);

    expect(last.dailyDone).toBe(true);
    expect(last.dailyResult.correctCount).toBe(10);
    expect(last.dailyResult.score).toBeGreaterThan(0);
    expect(last.streak).toEqual({ count: 1, lastDayId: TODAY });

    // dailyPlays finished with the right totals.
    const play = (await adminDb.doc(`dailyPlays/${U.uid}_${TODAY}`).get()).data()!;
    expect(play["finishedAt"]).not.toBeNull();
    expect(play["answers"]).toHaveLength(10);
    expect(play["score"]).toBe(last.dailyResult.score);

    // XP = 10 correct × 2 + 25 completion = 45.
    const user = (await adminDb.doc(`users/${U.uid}`).get()).data()!;
    expect(user["xp"]).toBe(10 * 2 + 25);
    expect(user["streak"]).toEqual({ count: 1, lastDayId: TODAY });

    // Weekly points = round(score/100) → "dailies" bucket.
    const wk = weekId(new Date());
    const score = (await adminDb.doc(`weekly/${wk}/scores/${U.uid}`).get()).data()!;
    const expected = Math.round(last.dailyResult.score / 100);
    expect(score["points"]).toBe(expected);
    expect(score["breakdown"]["dailies"]).toBe(expected);
    expect(last.dailyResult.weeklyPointsAwarded).toBe(expected);
  });

  it("rejects a dayId outside the ±14h window", async () => {
    await expectReason(call(U, "v1_startDaily", { dayId: "2020-01-01" }), "day-out-of-window");
  });

  it("blocks a second attempt the same day (one attempt per day)", async () => {
    await playDaily(U, TODAY, true);
    await expectReason(call(U, "v1_startDaily", { dayId: TODAY }), "daily-already-played");
  });

  it("resumes with the identical servings (idempotent start)", async () => {
    const first = await call(U, "v1_startDaily", { dayId: TODAY });
    const again = await call(U, "v1_startDaily", { dayId: TODAY });
    expect(again.servings).toEqual(first.servings);
  });

  it("rejects out-of-order answers", async () => {
    await call(U, "v1_startDaily", { dayId: TODAY });
    await expectReason(
      call(U, "v1_submitDailyAnswer", {
        dayId: TODAY, qIx: 1, answerIx: 0, idempotencyKey: crypto.randomUUID(),
      }),
      "out-of-order",
    );
  });

  it("increments the streak on a consecutive day", async () => {
    // Pretend the user already played yesterday (streak 5).
    await adminDb.doc(`users/${U.uid}`).set(
      { language: "he", isGuest: true, streak: { count: 5, lastDayId: YESTERDAY } },
      { merge: false },
    );
    const last = await playDaily(U, TODAY, true);
    expect(last.streak).toEqual({ count: 6, lastDayId: TODAY });
  });

  it("does not double-grant on an idempotent submit replay", async () => {
    await call(U, "v1_startDaily", { dayId: TODAY });
    const cix = await dailyCorrectIx(TODAY, 0, U.uid);
    const payload = {
      dayId: TODAY, qIx: 0, answerIx: cix, idempotencyKey: crypto.randomUUID(),
    };
    await call(U, "v1_submitDailyAnswer", payload);
    const xp1 = (await adminDb.doc(`users/${U.uid}`).get()).data()!["xp"];
    await call(U, "v1_submitDailyAnswer", payload); // replay → cached
    const xp2 = (await adminDb.doc(`users/${U.uid}`).get()).data()!["xp"];
    expect(xp1).toBe(2);
    expect(xp2).toBe(2);
  });
});
