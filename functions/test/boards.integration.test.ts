// Emulator integration — Phase 7b friend-ranked projections (GDD §7, doc 08 §2):
// the weekly boards/{uid} fan-out on duel + daily resolution, the daily
// friendScores/{uid} projection, and the Monday rollWeek archive/reset. Requires
// the emulator suite running (npm run test:emulator).

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

import { weekId, previousWeekId } from "../lib/economy/weekId.js";
import { rollWeek } from "../lib/economy/rollWeek.js";
import { getBalance } from "../lib/config/balance.js";

const CATEGORIES = [
  "general_knowledge", "sports", "movies_tv", "music",
  "science_tech", "history", "geography", "israel_local",
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const DAILY_COMPOSITION = [
  "easy", "easy", "easy",
  "medium", "medium", "medium", "medium",
  "hard", "hard", "hard",
] as const;

function utcDayId(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
const TODAY = utcDayId(0);

let adminApp: AdminApp;
let adminDb: FirebaseFirestore.Firestore;

interface Client { fns: Functions; fs: ClientFirestore; auth: Auth; uid: string }
let A: Client;
let B: Client;

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

function pairId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

async function correctIxFor(
  matchId: string, roundIx: number, qIx: number, uid: string,
): Promise<number> {
  const snap = await adminDb.doc(`servingsPrivate/${matchId}_${roundIx}_${qIx}_${uid}`).get();
  return snap.data()!["correctIx"] as number;
}

async function playRound(c: Client, matchId: string, correctly: boolean): Promise<any> {
  let start = await call(c, "v1_startRound", { matchId });
  if (start.needsPick) {
    start = await call(c, "v1_startRound", { matchId, categoryId: start.offered[0] });
  }
  const roundIx = start.roundIx as number;
  let last: any;
  for (const s of start.servings as Array<{ qIx: number }>) {
    const correctIx = await correctIxFor(matchId, roundIx, s.qIx, c.uid);
    const answerIx = correctly ? correctIx : (correctIx + 1) % 4;
    last = await call(c, "v1_submitAnswer", {
      matchId, roundIx, qIx: s.qIx, answerIx, idempotencyKey: crypto.randomUUID(),
    });
  }
  return last;
}

// A always correct, B always wrong → A wins 3-0; returns the match result.
async function playDuelAWins(matchId: string): Promise<any> {
  let matchResult: any;
  for (let i = 0; i < 12 && !matchResult; i++) {
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    if (m["state"] === "finished") { matchResult = m["result"]; break; }
    const isA = m["turnUid"] === A.uid;
    const last = await playRound(isA ? A : B, matchId, isA);
    if (last?.matchResult) matchResult = last.matchResult;
  }
  return matchResult;
}

async function dailyCorrectIx(dayId: string, qIx: number, uid: string): Promise<number> {
  const snap = await adminDb.doc(`servingsPrivate/daily_${dayId}_${qIx}_${uid}`).get();
  return snap.data()!["correctIx"] as number;
}

async function playDaily(c: Client, dayId: string): Promise<any> {
  const start = await call(c, "v1_startDaily", { dayId });
  let last: any;
  for (const s of start.servings as Array<{ qIx: number }>) {
    const cix = await dailyCorrectIx(dayId, s.qIx, c.uid);
    last = await call(c, "v1_submitDailyAnswer", {
      dayId, qIx: s.qIx, answerIx: cix, idempotencyKey: crypto.randomUUID(),
    });
  }
  return last;
}

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-boards");
  adminDb = getAdminFirestore(adminApp);

  const batch = adminDb.batch();
  // Duel question bank.
  for (const category of CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      batch.set(adminDb.doc(`questions/bd_${category}_${difficulty}`), {
        text: `${category} ${difficulty}?`,
        answers: ["A", "B", "C", "D"],
        correctIx: 0, difficulty, language: "he", category,
        source: "integration-test",
      });
    }
  }
  // Daily set for today.
  const dailyIds: string[] = [];
  DAILY_COMPOSITION.forEach((difficulty, i) => {
    const id = `bdq_${i}_${difficulty}`;
    dailyIds.push(id);
    batch.set(adminDb.doc(`questions/${id}`), {
      text: `daily ${i}?`,
      answers: ["A", "B", "C", "D"],
      correctIx: 0, difficulty, language: "he", category: "general_knowledge",
      source: "integration-test",
    });
  });
  batch.set(adminDb.doc(`dailySets/${TODAY}`), {
    questionIds: { he: dailyIds }, publishAt: new Date(`${TODAY}T00:00:00Z`),
  });
  await batch.commit();

  A = await makeClient("boardsA");
  B = await makeClient("boardsB");
  await setProfile(A, "Alice", 1);
  await setProfile(B, "Bob", 2);

  // A and B are friends (the real graph is Phase 8; here written via admin).
  await adminDb.doc(`friendships/${pairId(A.uid, B.uid)}`).set({
    uids: [A.uid, B.uid].sort(), since: new Date().toISOString(), source: "test",
  });
});

async function setProfile(c: Client, displayName: string, avatarId: number): Promise<void> {
  await setDoc(clientDoc(c.fs, `users/${c.uid}`), {
    language: "he", isGuest: true, displayName, avatarId, createdAt: new Date(),
  });
}

async function clearState(): Promise<void> {
  const wk = weekId(new Date());
  for (const c of [A, B]) {
    const ml = await adminDb.collection(`users/${c.uid}/matchList`).get();
    await Promise.all(ml.docs.map((d) => d.ref.delete()));
    await adminDb.doc(`weekly/${wk}/scores/${c.uid}`).delete().catch(() => {});
    await adminDb.doc(`weekly/${wk}/boards/${c.uid}`).delete().catch(() => {});
    await adminDb.doc(`daily/${TODAY}/friendScores/${c.uid}`).delete().catch(() => {});
    await adminDb.doc(`dailyPlays/${c.uid}_${TODAY}`).delete().catch(() => {});
    await Promise.all(
      DAILY_COMPOSITION.map((_, qIx) =>
        adminDb.doc(`servingsPrivate/daily_${TODAY}_${qIx}_${c.uid}`).delete().catch(() => {}),
      ),
    );
  }
  // Restore profiles (keep displayName/avatarId for board rows).
  await adminDb.doc(`users/${A.uid}`).set(
    { language: "he", isGuest: true, displayName: "Alice", avatarId: 1 }, { merge: false },
  );
  await adminDb.doc(`users/${B.uid}`).set(
    { language: "he", isGuest: true, displayName: "Bob", avatarId: 2 }, { merge: false },
  );
}
beforeEach(async () => { await clearState(); });

afterAll(async () => {
  await Promise.allSettled([
    deleteClient((A.fns as any).app),
    deleteClient((B.fns as any).app),
    adminDeleteApp(adminApp),
  ]);
});

async function newDuel(): Promise<string> {
  const { matchId } = await call(A, "v1_createDuel", {
    opponentUid: B.uid, categoryMode: "spin", idempotencyKey: crypto.randomUUID(),
  });
  return matchId;
}

describe("weekly board fan-out on duel resolution (GDD §7)", () => {
  it("rebuilds both friends' boards with correct ranks", async () => {
    const matchId = await newDuel();
    const result = await playDuelAWins(matchId);
    expect(result.winner).toBe(A.uid);

    const wk = weekId(new Date());
    const winPts = result.weeklyPointsAwarded[A.uid] as number;
    expect(winPts).toBeGreaterThan(0);

    // Both viewers get a board listing the same membership, A ranked above B.
    for (const viewer of [A.uid, B.uid]) {
      const board = (await adminDb.doc(`weekly/${wk}/boards/${viewer}`).get()).data()!;
      const rows = board["rows"] as Array<{ uid: string; points: number; rank: number; name: string }>;
      expect(rows).toHaveLength(2);
      const rowA = rows.find((r) => r.uid === A.uid)!;
      const rowB = rows.find((r) => r.uid === B.uid)!;
      expect(rowA.rank).toBe(1);
      expect(rowA.points).toBe(winPts);
      expect(rowA.name).toBe("Alice");
      expect(rowB.rank).toBe(2);
      expect(rowB.points).toBe(0); // B won no rounds → no weekly points
      expect(typeof board["updatedAt"]).toBe("string");
    }
  });
});

describe("daily fan-out on completion (doc 08 §2)", () => {
  it("writes friendScores + the dailies weekly bucket + the board", async () => {
    const last = await playDaily(A, TODAY);
    expect(last.dailyDone).toBe(true);

    // Public friends-today subset (no question content).
    const fs = (await adminDb.doc(`daily/${TODAY}/friendScores/${A.uid}`).get()).data()!;
    expect(fs["uid"]).toBe(A.uid);
    expect(fs["name"]).toBe("Alice");
    expect(fs["correctCount"]).toBe(10);
    expect(fs["score"]).toBe(last.dailyResult.score);
    expect(typeof fs["playedAt"]).toBe("string");

    // Weekly board reflects the dailies points.
    const wk = weekId(new Date());
    const dailyPts = Math.round(last.dailyResult.score / 100);
    const board = (await adminDb.doc(`weekly/${wk}/boards/${A.uid}`).get()).data()!;
    const rowA = (board["rows"] as Array<{ uid: string; points: number }>).find(
      (r) => r.uid === A.uid,
    )!;
    expect(rowA.points).toBe(dailyPts);
  });
});

describe("rollWeek archive + reset (Monday boundary)", () => {
  const ROLL_NOW = new Date("2025-06-23T00:30:00Z");
  const CLOSING = previousWeekId(ROLL_NOW);

  beforeEach(async () => {
    // Seed a finished closing-week board for A and B, clear history + marker.
    await adminDb.doc(`weekly/${CLOSING}/boards/${A.uid}`).set({
      rows: [
        { uid: A.uid, name: "Alice", avatarId: 1, level: 3, points: 300, rank: 1 },
        { uid: B.uid, name: "Bob", avatarId: 2, level: 2, points: 100, rank: 2 },
      ],
      updatedAt: ROLL_NOW.toISOString(),
    });
    await adminDb.doc(`weekly/${CLOSING}/boards/${B.uid}`).set({
      rows: [
        { uid: A.uid, name: "Alice", avatarId: 1, level: 3, points: 300, rank: 1 },
        { uid: B.uid, name: "Bob", avatarId: 2, level: 2, points: 100, rank: 2 },
      ],
      updatedAt: ROLL_NOW.toISOString(),
    });
    await adminDb.doc(`weekly/${CLOSING}`).delete().catch(() => {});
    for (const c of [A, B]) {
      await adminDb.doc(`users/${c.uid}`).set({ weeklyHistory: [] }, { merge: true });
    }
  });

  it("archives each viewer's own row into profile history, then is a no-op on replay", async () => {
    const first = await rollWeek(adminDb, ROLL_NOW, getBalance());
    expect(first.weekId).toBe(CLOSING);
    expect(first.archived).toBe(2);
    expect(first.skipped).toBe(false);

    const aHist = (await adminDb.doc(`users/${A.uid}`).get()).data()!["weeklyHistory"];
    expect(aHist).toHaveLength(1);
    expect(aHist[0]).toMatchObject({ weekId: CLOSING, points: 300, rank: 1 });
    const bHist = (await adminDb.doc(`users/${B.uid}`).get()).data()!["weeklyHistory"];
    expect(bHist[0]).toMatchObject({ weekId: CLOSING, points: 100, rank: 2 });

    // Marker set → a re-run archives nothing (idempotent reset).
    const second = await rollWeek(adminDb, ROLL_NOW, getBalance());
    expect(second.skipped).toBe(true);
    expect(second.archived).toBe(0);
    const aHist2 = (await adminDb.doc(`users/${A.uid}`).get()).data()!["weeklyHistory"];
    expect(aHist2).toHaveLength(1); // not double-appended
  });
});
