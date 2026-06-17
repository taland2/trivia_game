// Emulator integration suite — the Phase 3 exit-checkpoint proof (doc 15).
// Drives two anonymous users through a full async duel against the live Auth +
// Functions + Firestore emulators. Requires the emulator suite running:
//   1. Terminal A:  .\scripts\dev.ps1
//   2. Terminal B:  cd functions && npm run test:emulator
//
// Admin (emulator, rules-bypassing) is used only for test scaffolding: seeding
// the question bank and reading the function-only servingsPrivate doc so the
// "client" can choose to answer correctly/incorrectly and steer scores.

import { beforeAll, afterAll, describe, expect, it } from "vitest";

const PROJECT = "demo-trivia-dev";
const REGION = "me-west1";
const HOST = "127.0.0.1";

// Admin must reach the Firestore emulator (port per firebase.json).
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
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
  type Functions,
} from "firebase/functions";
import {
  getFirestore as getClientFirestore,
  connectFirestoreEmulator,
  doc as clientDoc,
  getDoc,
  type Firestore as ClientFirestore,
} from "firebase/firestore";

const CATEGORIES = [
  "general_knowledge",
  "sports",
  "movies_tv",
  "music",
  "science_tech",
  "history",
  "geography",
  "israel_local",
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

let adminApp: AdminApp;
let adminDb: FirebaseFirestore.Firestore;

interface Client {
  fns: Functions;
  fs: ClientFirestore;
  auth: Auth;
  uid: string;
  name: string;
}
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
  return { fns, fs, auth, uid: cred.user.uid, name };
}

function call<T = any>(c: Client, fn: string, data: unknown): Promise<T> {
  return httpsCallable(c.fns, fn)(data).then((r) => r.data as T);
}

async function correctIxFor(
  matchId: string,
  roundIx: number,
  qIx: number,
  uid: string,
): Promise<number> {
  const snap = await adminDb
    .doc(`servingsPrivate/${matchId}_${roundIx}_${qIx}_${uid}`)
    .get();
  return snap.data()!["correctIx"] as number;
}

// Play a player's whole round turn; `correctly` steers their score.
async function playRound(
  c: Client,
  matchId: string,
  correctly: boolean,
): Promise<any> {
  const start = await call(c, "v1_startRound", { matchId });
  const roundIx = start.roundIx as number;
  let last: any;
  for (const s of start.servings as Array<{ qIx: number }>) {
    const correctIx = await correctIxFor(matchId, roundIx, s.qIx, c.uid);
    const answerIx = correctly ? correctIx : (correctIx + 1) % 4;
    last = await call(c, "v1_submitAnswer", {
      matchId,
      roundIx,
      qIx: s.qIx,
      answerIx,
      idempotencyKey: crypto.randomUUID(),
    });
  }
  return last;
}

async function newDuel(): Promise<string> {
  const { matchId } = await call(A, "v1_createDuel", {
    opponentUid: B.uid,
    categoryMode: "spin",
  });
  return matchId;
}

// Play to completion with A always correct and B always wrong → A wins 3-0.
async function playToCompletionAWins(matchId: string): Promise<any> {
  let matchResult: any;
  for (let i = 0; i < 12 && !matchResult; i++) {
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    if (m["state"] === "finished") {
      matchResult = m["result"];
      break;
    }
    const isA = m["turnUid"] === A.uid;
    const last = await playRound(isA ? A : B, matchId, isA);
    if (last?.matchResult) matchResult = last.matchResult;
  }
  return matchResult;
}

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-test");
  adminDb = getAdminFirestore(adminApp);

  // Seed one question per category/difficulty (he) so any random category works.
  const batch = adminDb.batch();
  for (const category of CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      batch.set(adminDb.doc(`questions/it_${category}_${difficulty}`), {
        text: `${category} ${difficulty}?`,
        answers: ["A", "B", "C", "D"],
        correctIx: 0,
        difficulty,
        language: "he",
        category,
        source: "integration-test",
      });
    }
  }
  await batch.commit();

  A = await makeClient("itA");
  B = await makeClient("itB");
});

afterAll(async () => {
  await Promise.allSettled([
    deleteClient((A.fns as any).app),
    deleteClient((B.fns as any).app),
    adminDeleteApp(adminApp),
  ]);
});

describe("duel lifecycle", () => {
  it("seeds both players' matchList on create, owner-readable only", async () => {
    const matchId = await newDuel();

    const mlA = await getDoc(
      clientDoc(A.fs, `users/${A.uid}/matchList/${matchId}`),
    );
    expect(mlA.exists()).toBe(true);
    expect(mlA.data()!["opponentUid"]).toBe(B.uid);
    expect(mlA.data()!["yourTurn"]).toBe(true); // challenger leads

    // B may not read A's home projection.
    await expect(
      getDoc(clientDoc(B.fs, `users/${A.uid}/matchList/${matchId}`)),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects acting out of turn", async () => {
    const matchId = await newDuel(); // turn = A
    await expect(call(B, "v1_startRound", { matchId })).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { reason: "not-your-turn" },
    });
  });

  it("is idempotent on replay and rejects a fresh re-answer", async () => {
    const matchId = await newDuel();
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;
    const correctIx = await correctIxFor(matchId, roundIx, 0, A.uid);
    const key = crypto.randomUUID();
    const base = {
      matchId,
      roundIx,
      qIx: 0,
      answerIx: correctIx,
      idempotencyKey: key,
    };

    const r1 = await call(A, "v1_submitAnswer", base);
    const r2 = await call(A, "v1_submitAnswer", base); // same key → cached
    expect(r2).toEqual(r1);

    // New key on the same already-answered question → rejected.
    await expect(
      call(A, "v1_submitAnswer", { ...base, idempotencyKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { reason: "already-answered" },
    });
  });

  it("hides round state and recap until both finish (reveal rule)", async () => {
    const matchId = await newDuel();
    await playRound(A, matchId, true); // A finishes round 0; B has not played

    // Recap absent; live round doc denied even to a participant.
    expect(
      (await getDoc(clientDoc(A.fs, `matches/${matchId}/recaps/0`))).exists(),
    ).toBe(false);
    await expect(
      getDoc(clientDoc(A.fs, `matches/${matchId}/rounds/0`)),
    ).rejects.toMatchObject({ code: "permission-denied" });

    await playRound(B, matchId, false); // B finishes → round resolves

    const recap = await getDoc(clientDoc(A.fs, `matches/${matchId}/recaps/0`));
    expect(recap.exists()).toBe(true);
    expect(recap.data()!["winner"]).toBe(A.uid);
    expect(recap.data()!["players"]).toHaveLength(2);
  });

  it("resolves a round exactly once under a concurrent final answer", async () => {
    const matchId = await newDuel();
    await playRound(A, matchId, true); // A wins round 0

    const start = await call(B, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;
    for (const qIx of [0, 1]) {
      const cix = await correctIxFor(matchId, roundIx, qIx, B.uid);
      await call(B, "v1_submitAnswer", {
        matchId,
        roundIx,
        qIx,
        answerIx: (cix + 1) % 4,
        idempotencyKey: crypto.randomUUID(),
      });
    }
    const cix2 = await correctIxFor(matchId, roundIx, 2, B.uid);
    const fire = () =>
      call(B, "v1_submitAnswer", {
        matchId,
        roundIx,
        qIx: 2,
        answerIx: (cix2 + 1) % 4,
        idempotencyKey: crypto.randomUUID(),
      });
    const settled = await Promise.allSettled([fire(), fire()]);

    // Exactly one of the two concurrent finals wins; the other is rejected.
    expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["roundWins"][A.uid]).toBe(1); // round resolved once, not twice
  });

  it("plays a full duel to a 3-0 win", async () => {
    const matchId = await newDuel();
    const result = await playToCompletionAWins(matchId);
    expect(result.winner).toBe(A.uid);
    expect(result.reason).toBe("rounds");
    expect(result.finalScore[A.uid]).toBe(3);
    expect(result.finalScore[B.uid]).toBe(0);

    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["state"]).toBe("finished");
    expect(m["turnUid"]).toBeNull();
  });

  it("creates a swapped-roles rematch of a finished match", async () => {
    const matchId = await newDuel();
    await playToCompletionAWins(matchId);

    const { newMatchId } = await call(B, "v1_acceptRematch", { matchId });
    const nm = (await adminDb.doc(`matches/${newMatchId}`).get()).data()!;
    expect(nm["players"][0]).toBe(B.uid); // roles swapped (GDD §4.6)
    expect(nm["players"][1]).toBe(A.uid);
    expect(nm["state"]).toBe("active");
    expect(nm["turnUid"]).toBe(B.uid);
  });
});
