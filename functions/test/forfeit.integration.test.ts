// Emulator integration — turn-timeout forfeit sweep (GDD §4.4) + the economy
// grants it triggers (GDD §7/§8). The scheduled wrapper is NOT deployed until
// Phase 7 (Blaze), so this suite drives the pure sweepForfeits() against the
// emulator's Firestore directly (imported from the built lib/). Requires the
// emulator suite running (scripts/dev.ps1).

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
import {
  getFirestore as getAdminFirestore,
  Timestamp,
} from "firebase-admin/firestore";
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
  setDoc,
  type Firestore as ClientFirestore,
} from "firebase/firestore";

// The sweep + balance come from the built functions code (lib/), exercised
// directly because the scheduled trigger is not deployed in dev.
import { sweepForfeits, decideForfeit } from "../lib/match/sweepForfeits.js";
import { getBalance } from "../lib/config/balance.js";
import { weekId } from "../lib/economy/weekId.js";

const CATEGORIES = [
  "general_knowledge", "sports", "movies_tv", "music",
  "science_tech", "history", "geography", "israel_local",
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

let adminApp: AdminApp;
let adminDb: FirebaseFirestore.Firestore;

interface Client {
  fns: Functions;
  fs: ClientFirestore;
  auth: Auth;
  uid: string;
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
  return { fns, fs, auth, uid: cred.user.uid };
}

function call<T = any>(c: Client, fn: string, data: unknown): Promise<T> {
  return httpsCallable(c.fns, fn)(data).then((r) => r.data as T);
}

async function setProfile(c: Client, language: string): Promise<void> {
  await setDoc(clientDoc(c.fs, `users/${c.uid}`), {
    language,
    isGuest: true,
    createdAt: new Date(),
  });
}

async function newDuel(): Promise<string> {
  const { matchId } = await call(A, "v1_createDuel", {
    opponentUid: B.uid,
    categoryMode: "spin",
    idempotencyKey: crypto.randomUUID(),
  });
  return matchId;
}

// Force a match's turn deadline into the past so the sweep treats it as expired.
async function expire(matchId: string): Promise<void> {
  await adminDb.doc(`matches/${matchId}`).update({
    turnDeadline: Timestamp.fromMillis(Date.now() - 1000),
  });
}

async function correctIxFor(
  matchId: string, roundIx: number, qIx: number, uid: string,
): Promise<number> {
  const snap = await adminDb
    .doc(`servingsPrivate/${matchId}_${roundIx}_${qIx}_${uid}`)
    .get();
  return snap.data()!["correctIx"] as number;
}

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-forfeit");
  adminDb = getAdminFirestore(adminApp);

  const batch = adminDb.batch();
  for (const category of CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      batch.set(adminDb.doc(`questions/ff_${category}_${difficulty}`), {
        text: `${category} ${difficulty}?`,
        answers: ["A", "B", "C", "D"],
        correctIx: 0,
        difficulty, language: "he", category, source: "integration-test",
      });
    }
  }
  await batch.commit();

  A = await makeClient("ffA");
  B = await makeClient("ffB");
  await setProfile(A, "he");
  await setProfile(B, "he");
});

async function clearState(): Promise<void> {
  const wk = weekId(new Date());
  for (const uid of [A.uid, B.uid]) {
    const ml = await adminDb.collection(`users/${uid}/matchList`).get();
    await Promise.all(ml.docs.map((d) => d.ref.delete()));
    // Reset XP and weekly points so per-test economy assertions are exact.
    await adminDb.doc(`users/${uid}`).set(
      { language: "he", isGuest: true }, { merge: false },
    );
    await adminDb.doc(`weekly/${wk}/scores/${uid}`).delete();
  }
}
beforeEach(async () => {
  await clearState();
});

afterAll(async () => {
  await Promise.allSettled([
    deleteClient((A.fns as any).app),
    deleteClient((B.fns as any).app),
    adminDeleteApp(adminApp),
  ]);
});

describe("forfeit sweep (GDD §4.4)", () => {
  it("stamps a turnDeadline on a freshly created duel", async () => {
    const matchId = await newDuel();
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["turnDeadline"]).toBeTruthy();
    expect((m["turnDeadline"] as Timestamp).toMillis()).toBeGreaterThan(Date.now());
  });

  it("does not forfeit a match whose deadline has not passed", async () => {
    const matchId = await newDuel();
    await sweepForfeits(adminDb, Timestamp.now(), getBalance());
    // The fresh match (future deadline) is untouched, regardless of any other
    // expired matches the global sweep may encounter.
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["state"]).toBe("active");
  });

  it("forfeits an expired turn to the opponent and awards the win", async () => {
    const matchId = await newDuel(); // turn = A (challenger)
    await expire(matchId);

    const res = await sweepForfeits(adminDb, Timestamp.now(), getBalance());
    expect(res.forfeited).toBeGreaterThanOrEqual(1);

    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["state"]).toBe("forfeited");
    expect(m["turnUid"]).toBeNull();
    expect(m["turnDeadline"]).toBeNull();
    expect(m["result"]["reason"]).toBe("forfeit");
    expect(m["result"]["winner"]).toBe(B.uid); // A was on turn → A forfeits
    expect(m["result"]["weeklyPointsAwarded"][B.uid]).toBe(100);
    expect(m["result"]["weeklyPointsAwarded"][A.uid]).toBe(0);

    // Both matchLists reflect the finished state.
    for (const uid of [A.uid, B.uid]) {
      const ml = (await adminDb.doc(`users/${uid}/matchList/${matchId}`).get()).data()!;
      expect(ml["state"]).toBe("forfeited");
    }

    // Winner economy: flat 100 weekly (forfeitsWon) + full completion/win XP (+50).
    const wk = weekId(new Date());
    const score = (await adminDb.doc(`weekly/${wk}/scores/${B.uid}`).get()).data()!;
    expect(score["points"]).toBe(100);
    expect(score["breakdown"]["forfeitsWon"]).toBe(100);
    const winnerUser = (await adminDb.doc(`users/${B.uid}`).get()).data()!;
    expect(winnerUser["xp"]).toBe(50);
    expect(winnerUser["level"]).toBe(1);
    // Loser earns nothing.
    expect((await adminDb.doc(`weekly/${wk}/scores/${A.uid}`).get()).exists).toBe(false);
  });

  it("resolves exactly once when a submit races the sweep", async () => {
    const matchId = await newDuel(); // turn = A
    await expire(matchId);

    // A is mid-turn: serve the round, then fire the final answer concurrently
    // with the sweep. Both touch matches/{id}; exactly one outcome must win.
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;
    for (const qIx of [0, 1]) {
      const cix = await correctIxFor(matchId, roundIx, qIx, A.uid);
      await call(A, "v1_submitAnswer", {
        matchId, roundIx, qIx, answerIx: cix,
        idempotencyKey: crypto.randomUUID(),
      });
    }
    const cix2 = await correctIxFor(matchId, roundIx, 2, A.uid);
    const submit = call(A, "v1_submitAnswer", {
      matchId, roundIx, qIx: 2, answerIx: cix2,
      idempotencyKey: crypto.randomUUID(),
    });
    const sweep = sweepForfeits(adminDb, Timestamp.now(), getBalance());
    const [submitRes, sweepRes] = await Promise.allSettled([submit, sweep]);

    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    if (submitRes.status === "fulfilled") {
      // The submit committed first: it restamped the deadline (round handed to B),
      // so the sweep found nothing to forfeit.
      expect(m["state"]).toBe("active");
      expect((sweepRes as PromiseFulfilledResult<any>).value.forfeited).toBe(0);
      expect(m["result"]).toBeNull();
    } else {
      // The sweep committed first: the match is forfeited and the late submit was
      // rejected by the match-finished guard.
      expect(m["state"]).toBe("forfeited");
      expect(m["result"]["reason"]).toBe("forfeit");
    }
  });
});

describe("decideForfeit is exported for unit reuse", () => {
  it("is a function (smoke)", () => {
    expect(typeof decideForfeit).toBe("function");
  });
});
