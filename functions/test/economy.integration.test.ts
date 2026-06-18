// Emulator integration — economy grants on normal duel resolution (GDD §7/§8)
// and the in-scope GDD §11 edge cases. Requires the emulator suite running.

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

const CATEGORIES = [
  "general_knowledge", "sports", "movies_tv", "music",
  "science_tech", "history", "geography", "israel_local",
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

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

async function correctIxFor(
  matchId: string, roundIx: number, qIx: number, uid: string,
): Promise<number> {
  const snap = await adminDb
    .doc(`servingsPrivate/${matchId}_${roundIx}_${qIx}_${uid}`)
    .get();
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

async function newDuel(): Promise<string> {
  const { matchId } = await call(A, "v1_createDuel", {
    opponentUid: B.uid, categoryMode: "spin",
  });
  return matchId;
}

// A always correct, B always wrong → A wins 3-0.
async function playToCompletionAWins(matchId: string): Promise<any> {
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

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-economy");
  adminDb = getAdminFirestore(adminApp);

  const batch = adminDb.batch();
  for (const category of CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      batch.set(adminDb.doc(`questions/ec_${category}_${difficulty}`), {
        text: `${category} ${difficulty}?`,
        answers: ["A", "B", "C", "D"],
        correctIx: 0, difficulty, language: "he", category,
        source: "integration-test",
      });
    }
  }
  await batch.commit();

  A = await makeClient("ecA");
  B = await makeClient("ecB");
  await setProfile(A, "he");
  await setProfile(B, "he");
});

async function setProfile(c: Client, language: string): Promise<void> {
  await setDoc(clientDoc(c.fs, `users/${c.uid}`), {
    language, isGuest: true, createdAt: new Date(),
  });
}

async function clearState(): Promise<void> {
  const wk = weekId(new Date());
  for (const uid of [A.uid, B.uid]) {
    const ml = await adminDb.collection(`users/${uid}/matchList`).get();
    await Promise.all(ml.docs.map((d) => d.ref.delete()));
    await adminDb.doc(`users/${uid}`).set({ language: "he", isGuest: true }, { merge: false });
    await adminDb.doc(`weekly/${wk}/scores/${uid}`).delete();
  }
}
beforeEach(async () => { await clearState(); });

afterAll(async () => {
  await Promise.allSettled([
    deleteClient((A.fns as any).app),
    deleteClient((B.fns as any).app),
    adminDeleteApp(adminApp),
  ]);
});

describe("economy on resolution (GDD §7/§8)", () => {
  it("awards weekly points + XP to both players when a duel completes", async () => {
    const matchId = await newDuel();
    const result = await playToCompletionAWins(matchId);
    expect(result.winner).toBe(A.uid);

    const wk = weekId(new Date());
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;

    // Winner weekly = 100 flat + round(scoreTotal_winner / 100), banked from
    // winning rounds only. A swept 3-0, so A's scoreTotal is all three rounds.
    const aScoreTotal = m["scoreTotals"][A.uid] as number;
    const bScoreTotal = m["scoreTotals"][B.uid] as number;
    expect(aScoreTotal).toBeGreaterThan(0);
    expect(bScoreTotal).toBe(0); // B won no rounds

    const winPts = 100 + Math.round(aScoreTotal / 100);
    const lossPts = Math.round(bScoreTotal / 100); // = 0
    expect(m["result"]["weeklyPointsAwarded"][A.uid]).toBe(winPts);
    expect(m["result"]["weeklyPointsAwarded"][B.uid]).toBe(lossPts);

    const aScore = (await adminDb.doc(`weekly/${wk}/scores/${A.uid}`).get()).data()!;
    expect(aScore["points"]).toBe(winPts);
    expect(aScore["breakdown"]["duels"]).toBe(winPts);
    // B's loss points are 0 → applyWeeklyPoints is a no-op, no doc written.
    expect((await adminDb.doc(`weekly/${wk}/scores/${B.uid}`).get()).exists).toBe(false);

    // XP: A answered 9/9 correct (+18) + completion 20 + win 30 = 68.
    const aUser = (await adminDb.doc(`users/${A.uid}`).get()).data()!;
    expect(aUser["xp"]).toBe(18 + 20 + 30);
    expect(aUser["level"]).toBe(1);
    // B answered 9/9 wrong (+0) + completion 20 = 20.
    const bUser = (await adminDb.doc(`users/${B.uid}`).get()).data()!;
    expect(bUser["xp"]).toBe(20);
  });

  it("does not double-grant XP on an idempotent replay", async () => {
    const matchId = await newDuel();
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;
    const cix = await correctIxFor(matchId, roundIx, 0, A.uid);
    const payload = {
      matchId, roundIx, qIx: 0, answerIx: cix, idempotencyKey: crypto.randomUUID(),
    };
    await call(A, "v1_submitAnswer", payload);
    const after1 = (await adminDb.doc(`users/${A.uid}`).get()).data()!["xp"];
    await call(A, "v1_submitAnswer", payload); // same key → cached, no new XP
    const after2 = (await adminDb.doc(`users/${A.uid}`).get()).data()!["xp"];
    expect(after1).toBe(2); // one correct answer
    expect(after2).toBe(2);
  });
});

describe("GDD §11 edge cases", () => {
  it("scores a null answer (app-killed mid-question) as 0 and resumes next q", async () => {
    const matchId = await newDuel();
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;

    // q0 answered with null (the client never submitted a choice).
    const r0 = await call(A, "v1_submitAnswer", {
      matchId, roundIx, qIx: 0, answerIx: null, idempotencyKey: crypto.randomUUID(),
    });
    expect(r0.points).toBe(0);

    // The round resumes: q1 is still answerable.
    const cix1 = await correctIxFor(matchId, roundIx, 1, A.uid);
    const r1 = await call(A, "v1_submitAnswer", {
      matchId, roundIx, qIx: 1, answerIx: cix1, idempotencyKey: crypto.randomUUID(),
    });
    expect(r1.points).toBeGreaterThan(0);
  });

  it("excludes duplicate questions within a single round", async () => {
    const matchId = await newDuel();
    await call(A, "v1_startRound", { matchId });
    const round = (await adminDb.doc(`matches/${matchId}/rounds/0`).get()).data()!;
    const ids = round["questionIds"] as string[];
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});
