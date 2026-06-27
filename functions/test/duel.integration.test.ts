// Emulator integration suite — the Phase 3 exit-checkpoint proof (doc 15).
// Drives two anonymous users through a full async duel against the live Auth +
// Functions + Firestore emulators. Requires the emulator suite running:
//   1. Terminal A:  .\scripts\dev.ps1
//   2. Terminal B:  cd functions && npm run test:emulator
//
// Admin (emulator, rules-bypassing) is used only for test scaffolding: seeding
// the question bank and reading the function-only servingsPrivate doc so the
// "client" can choose to answer correctly/incorrectly and steer scores.

import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

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
import {
  getFirestore as getAdminFirestore,
  Timestamp as AdminTimestamp,
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
  getDoc,
  setDoc,
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

// Play a player's whole round turn; `correctly` steers their score. Handles the
// pick-mode two-call handshake transparently (offer → choose offered[0]).
async function playRound(
  c: Client,
  matchId: string,
  correctly: boolean,
): Promise<any> {
  let start = await call(c, "v1_startRound", { matchId });
  if (start.needsPick) {
    start = await call(c, "v1_startRound", {
      matchId,
      categoryId: start.offered[0],
    });
  }
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

async function newDuel(
  categoryMode: "pick" | "spin" | "auto" = "spin",
): Promise<string> {
  const { matchId } = await call(A, "v1_createDuel", {
    opponentUid: B.uid,
    categoryMode,
    idempotencyKey: crypto.randomUUID(),
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

  // Both players are Hebrew (GDD §4.7 same-language rule). The profile is written
  // by the client itself — exercising the owner-write rule whitelist.
  await setProfile(A, "he");
  await setProfile(B, "he");

  // Phase 8a: direct duels now require a friendship (createDuel friend gate).
  // Written via admin (the real friend graph is exercised in social.integration).
  await adminDb.doc(`friendships/${[A.uid, B.uid].sort().join("_")}`).set({
    uids: [A.uid, B.uid].sort(), since: new Date().toISOString(), source: "test",
  });
});

// Write a player's own profile via the client (rules allow the preference-field
// whitelist only). `language` is what the same-language duel rule reads.
async function setProfile(c: Client, language: string): Promise<void> {
  await setDoc(clientDoc(c.fs, `users/${c.uid}`), {
    language,
    isGuest: true,
    createdAt: new Date(),
  });
}

// Clear both clients' home projections so each test starts at 0 active duels —
// the concurrency caps (GDD §4.6) read this collection, so leftover actives from
// earlier tests would otherwise leak across cases.
async function clearMatchLists(): Promise<void> {
  for (const uid of [A.uid, B.uid]) {
    const snap = await adminDb.collection(`users/${uid}/matchList`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

beforeEach(async () => {
  await clearMatchLists();
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

    const { newMatchId } = await call(B, "v1_acceptRematch", {
      matchId,
      idempotencyKey: crypto.randomUUID(),
    });
    const nm = (await adminDb.doc(`matches/${newMatchId}`).get()).data()!;
    expect(nm["players"][0]).toBe(B.uid); // roles swapped (GDD §4.6)
    expect(nm["players"][1]).toBe(A.uid);
    expect(nm["state"]).toBe("active");
    expect(nm["turnUid"]).toBe(B.uid);
  });
});

describe("category modes (GDD §4.3)", () => {
  it("spin returns a server-decided landing category as spinResult", async () => {
    const matchId = await newDuel("spin");
    const start = await call(A, "v1_startRound", { matchId });
    expect(CATEGORIES).toContain(start.spinResult);
    expect(start.spinResult).toBe(start.category);
    expect(start.servings).toHaveLength(3);
  });

  it("pick offers a locked 3-category choice, then serves the chosen one", async () => {
    const matchId = await newDuel("pick");

    const offer = await call(A, "v1_startRound", { matchId });
    expect(offer.needsPick).toBe(true);
    expect(offer.offered).toHaveLength(3);
    expect(new Set(offer.offered).size).toBe(3);
    expect(offer.servings).toBeUndefined(); // no leak before the pick

    // Re-asking without a choice returns the SAME locked offer (no reroll).
    const again = await call(A, "v1_startRound", { matchId });
    expect(again.offered).toEqual(offer.offered);

    const chosen = offer.offered[1];
    const served = await call(A, "v1_startRound", { matchId, categoryId: chosen });
    expect(served.category).toBe(chosen);
    expect(served.servings).toHaveLength(3);
  });

  it("rejects a pick that is not on the locked offer", async () => {
    const matchId = await newDuel("pick");
    const offer = await call(A, "v1_startRound", { matchId });
    const notOffered = CATEGORIES.find((c) => !offer.offered.includes(c))!;
    await expect(
      call(A, "v1_startRound", { matchId, categoryId: notOffered }),
    ).rejects.toMatchObject({
      code: "functions/invalid-argument",
      details: { field: "categoryId" },
    });
  });

  it("auto never repeats a category across a match's rounds", async () => {
    const matchId = await newDuel("auto");
    await playToCompletionAWins(matchId);

    const recaps = await adminDb
      .collection(`matches/${matchId}/recaps`)
      .get();
    const cats = recaps.docs.map((d) => d.data()["category"] as string);
    expect(cats.length).toBeGreaterThanOrEqual(3);
    expect(new Set(cats).size).toBe(cats.length); // all distinct
  });
});

describe("same-language rule (GDD §4.7)", () => {
  it("rejects a duel between players in different app languages", async () => {
    const C = await makeClient("itC");
    await setProfile(C, "en");
    await expect(
      call(A, "v1_createDuel", {
        opponentUid: C.uid,
        categoryMode: "spin",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { reason: "language-mismatch" },
    });
  });

  it("rejects a duel against a player with no profile", async () => {
    await expect(
      call(A, "v1_createDuel", {
        opponentUid: "ghost_no_profile",
        categoryMode: "spin",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/not-found",
      details: { reason: "user" },
    });
  });
});

describe("concurrency caps (GDD §4.6)", () => {
  it("blocks a 4th active duel against the same opponent", async () => {
    for (let i = 0; i < 3; i++) await newDuel("spin"); // 3 active A↔B
    await expect(newDuel("spin")).rejects.toMatchObject({
      code: "functions/resource-exhausted",
      details: { reason: "max-duels-with-friend" },
    });
  });

  it("blocks the 21st active duel overall", async () => {
    // 21 distinct Hebrew opponents (profiles only — createDuel needs the language,
    // not a live auth session for the opponent).
    const batch = adminDb.batch();
    for (let i = 0; i < 21; i++) {
      batch.set(adminDb.doc(`users/cap_opp_${i}`), {
        language: "he",
        isGuest: true,
      });
      // Friend gate: A must be friends with each capped opponent.
      batch.set(adminDb.doc(`friendships/${[A.uid, `cap_opp_${i}`].sort().join("_")}`), {
        uids: [A.uid, `cap_opp_${i}`].sort(), since: new Date().toISOString(), source: "test",
      });
    }
    await batch.commit();

    for (let i = 0; i < 20; i++) {
      await call(A, "v1_createDuel", {
        opponentUid: `cap_opp_${i}`,
        categoryMode: "spin",
        idempotencyKey: crypto.randomUUID(),
      });
    }
    await expect(
      call(A, "v1_createDuel", {
        opponentUid: "cap_opp_20",
        categoryMode: "spin",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/resource-exhausted",
      details: { reason: "max-active-duels" },
    });
  });
});

describe("tie resolution (GDD §4.5)", () => {
  it("breaks a score tie by total answer time — never leaves a round 'shared'", async () => {
    const matchId = await newDuel("spin");
    await playRound(A, matchId, false); // both all-wrong → equal score (0)
    await playRound(B, matchId, false);

    const recap = (await adminDb.doc(`matches/${matchId}/recaps/0`).get()).data()!;
    expect([A.uid, B.uid]).toContain(recap["winner"]); // a real winner, not "shared"
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["roundWins"][A.uid] + m["roundWins"][B.uid]).toBe(1);
  });

  it("re-deals fresh questions at the same round on an exact tie (replay)", async () => {
    // Forcing a true points-and-time tie through live timing is astronomically
    // rare (that's the GDD rationale), so inject the resolver's verdict — a round
    // flagged needsReplay — and prove startRound re-deals it.
    const matchId = await newDuel("spin");
    await call(A, "v1_startRound", { matchId }); // round 0 created + A served (attempt 0)

    await adminDb.doc(`matches/${matchId}/rounds/0`).update({
      needsReplay: true,
      winner: "shared",
      perPlayer: {},
    });

    const redealt = await call(A, "v1_startRound", { matchId });
    expect(redealt.servings).toHaveLength(3);

    const round = (await adminDb.doc(`matches/${matchId}/rounds/0`).get()).data()!;
    expect(round["attempt"]).toBe(1);
    expect(round["needsReplay"]).toBe(false);
    expect(round["isTiebreaker"]).toBe(true);
    expect(round["questionIds"]).toHaveLength(3);

    // The replay's servings live under the attempt-suffixed key, distinct from
    // the tied attempt's docs.
    const r1 = await adminDb
      .doc(`servingsPrivate/${matchId}_0_0_${A.uid}_r1`)
      .get();
    expect(r1.exists).toBe(true);
  });
});

// WS1 remediation (docs/17): the H1 scoring-integrity guard, the create-side
// idempotency + cap-race fixes (H2/M1/M2), and the e2e late-submit path.
describe("WS1 — integrity & idempotency", () => {
  // H1 (GDD §11): a round can't be finished while skipping a question. Submitting
  // qIx=2 before qIx=1 must be rejected — defeating the kill-app-to-skip-the-hard-
  // question exploit and guaranteeing the recap always has 3 answers.
  it("rejects finishing a round while skipping a question (H1)", async () => {
    const matchId = await newDuel("spin");
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;

    const cix0 = await correctIxFor(matchId, roundIx, 0, A.uid);
    await call(A, "v1_submitAnswer", {
      matchId,
      roundIx,
      qIx: 0,
      answerIx: cix0,
      idempotencyKey: crypto.randomUUID(),
    });

    // Jump to the last (Hard) question, skipping qIx=1 → out-of-order.
    const cix2 = await correctIxFor(matchId, roundIx, 2, A.uid);
    await expect(
      call(A, "v1_submitAnswer", {
        matchId,
        roundIx,
        qIx: 2,
        answerIx: cix2,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { reason: "out-of-order" },
    });

    // The round is not done for A and no recap leaked.
    const round = (
      await adminDb.doc(`matches/${matchId}/rounds/${roundIx}`).get()
    ).data()!;
    expect(round["perPlayer"][A.uid]?.done ?? false).toBe(false);
    expect(round["perPlayer"][A.uid]?.answers).toHaveLength(1);
    expect(
      (await adminDb.doc(`matches/${matchId}/recaps/${roundIx}`).get()).exists,
    ).toBe(false);
  });

  // Adversarial (docs/12): a submit for a round that was never served is rejected.
  it("rejects a submit for a never-served (stale) roundIx", async () => {
    const matchId = await newDuel("spin");
    await call(A, "v1_startRound", { matchId }); // serves round 0 only
    await expect(
      call(A, "v1_submitAnswer", {
        matchId,
        roundIx: 4,
        qIx: 0,
        answerIx: 0,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/not-found",
      details: { reason: "match" },
    });
  });

  // Guardrail 3 e2e: a correct answer submitted after the server clock passes the
  // limit scores 0 — proven through the real submitAnswer, not just the scorer.
  it("scores a correct answer as timed-out past the server limit", async () => {
    const matchId = await newDuel("spin");
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;

    // Backdate the immutable scoring clock far beyond any timeLimit + grace.
    await adminDb
      .doc(`servingsPrivate/${matchId}_${roundIx}_0_${A.uid}`)
      .update({ servedAt: new Date(Date.now() - 10 * 60 * 1000) });

    const cix0 = await correctIxFor(matchId, roundIx, 0, A.uid);
    const res = await call(A, "v1_submitAnswer", {
      matchId,
      roundIx,
      qIx: 0,
      answerIx: cix0, // the correct index — still 0 points because timed out
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.points).toBe(0);
  });

  // H2: a same-key createDuel retry storm creates exactly one match.
  it("createDuel is idempotent under a same-key retry storm (H2)", async () => {
    const key = crypto.randomUUID();
    const fire = () =>
      call(A, "v1_createDuel", {
        opponentUid: B.uid,
        categoryMode: "spin",
        idempotencyKey: key,
      });

    const before = (await adminDb.collection("matches").get()).size;
    const [r1, r2] = await Promise.all([fire(), fire()]);
    const after = (await adminDb.collection("matches").get()).size;

    expect(r1.matchId).toBe(r2.matchId); // both calls see the same match
    expect(after - before).toBe(1); // and only one was created
  });

  // M1: the cap check is transactional — two concurrent creates at the boundary
  // can't both pass.
  it("enforces the active-duel cap under a concurrent create race (M1)", async () => {
    const cap = 20; // GDD §4.6 maxActiveDuels (balance default)

    // Seed A to cap-1 active duels and two distinct he opponents to challenge.
    const batch = adminDb.batch();
    for (let i = 0; i < cap - 1; i++) {
      batch.set(adminDb.doc(`users/${A.uid}/matchList/race_${i}`), {
        matchId: `race_${i}`,
        opponentUid: `race_opp_${i}`,
        state: "active",
        yourTurn: true,
        roundWins: {},
        currentRound: 0,
        categoryMode: "spin",
        result: null,
        lastEventAt: new Date(),
      });
    }
    for (const id of ["race_a", "race_b"]) {
      batch.set(adminDb.doc(`users/${id}`), { language: "he", isGuest: true });
      // Friend gate: A must be friends with each race opponent.
      batch.set(adminDb.doc(`friendships/${[A.uid, id].sort().join("_")}`), {
        uids: [A.uid, id].sort(), since: new Date().toISOString(), source: "test",
      });
    }
    await batch.commit();

    const [ra, rb] = await Promise.allSettled([
      call(A, "v1_createDuel", {
        opponentUid: "race_a",
        categoryMode: "spin",
        idempotencyKey: crypto.randomUUID(),
      }),
      call(A, "v1_createDuel", {
        opponentUid: "race_b",
        categoryMode: "spin",
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);

    const fulfilled = [ra, rb].filter((r) => r.status === "fulfilled");
    const rejected = [ra, rb].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1); // exactly one reached the cap
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "functions/resource-exhausted",
      details: { reason: "max-active-duels" },
    });
  });

  // M2: a rematch is a new active match, so it honours the §4.6 caps.
  it("acceptRematch enforces the active-duel cap (M2)", async () => {
    const matchId = await newDuel("spin");
    await playToCompletionAWins(matchId); // a finished A↔B match to rematch

    const cap = 20; // GDD §4.6 maxActiveDuels (balance default)
    const batch = adminDb.batch();
    for (let i = 0; i < cap; i++) {
      batch.set(adminDb.doc(`users/${A.uid}/matchList/rcap_${i}`), {
        matchId: `rcap_${i}`,
        opponentUid: `rcap_opp_${i}`,
        state: "active",
        yourTurn: true,
        roundWins: {},
        currentRound: 0,
        categoryMode: "spin",
        result: null,
        lastEventAt: new Date(),
      });
    }
    await batch.commit();

    await expect(
      call(A, "v1_acceptRematch", {
        matchId,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/resource-exhausted",
      details: { reason: "max-active-duels" },
    });
  });

  // M2: a rematch re-checks the same-language rule against current profiles.
  it("acceptRematch rejects when players no longer share a language (M2)", async () => {
    const matchId = await newDuel("spin");
    await playToCompletionAWins(matchId);

    // B switches app language after the match. Done via admin (merge) because B
    // has earned XP by now, so a client full-overwrite would (correctly) be
    // denied by the profile-whitelist rules — this is test scaffolding only.
    await adminDb.doc(`users/${B.uid}`).set({ language: "en" }, { merge: true });
    await expect(
      call(A, "v1_acceptRematch", {
        matchId,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { reason: "language-mismatch" },
    });
    await adminDb.doc(`users/${B.uid}`).set({ language: "he" }, { merge: true }); // restore
  });
});

// --- H6: the submit response carries the real points split (WS2.2) ------------
describe("points split (H6)", () => {
  it("returns basePoints + speedBonus === points for a correct answer", async () => {
    const matchId = await newDuel("spin");
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;
    const q0 = (start.servings as Array<{ qIx: number; difficulty: string }>)[0]!;
    const correctIx = await correctIxFor(matchId, roundIx, q0.qIx, A.uid);

    const res = await call(A, "v1_submitAnswer", {
      matchId,
      roundIx,
      qIx: q0.qIx,
      answerIx: correctIx,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(res.points).toBeGreaterThan(0);
    expect(res.basePoints).toBe(100); // easy base (serve order is 1E/1M/1H)
    expect(res.basePoints + res.speedBonus).toBe(res.points);
  });
});

// --- WS1.3: a correct answer submitted after the window scores 0 (timed out) --
describe("submit after timeout (WS1.3)", () => {
  it("scores 0 for a CORRECT answer arriving past timeLimit + grace", async () => {
    const matchId = await newDuel("spin");
    const start = await call(A, "v1_startRound", { matchId });
    const roundIx = start.roundIx as number;
    const q0 = (start.servings as Array<{ qIx: number }>)[0]!;
    const correctIx = await correctIxFor(matchId, roundIx, q0.qIx, A.uid);

    // Backdate the serving clock far past the (easy) 10s limit + 1.5s grace so the
    // server-authoritative timer marks it timed out — admin scaffolding only.
    await adminDb
      .doc(`servingsPrivate/${matchId}_${roundIx}_${q0.qIx}_${A.uid}`)
      .update({ servedAt: AdminTimestamp.fromMillis(Date.now() - 60_000) });

    const res = await call(A, "v1_submitAnswer", {
      matchId,
      roundIx,
      qIx: q0.qIx,
      answerIx: correctIx, // the CORRECT answer, but too late
      idempotencyKey: crypto.randomUUID(),
    });

    expect(res.points).toBe(0);
    expect(res.basePoints).toBe(0);
    expect(res.speedBonus).toBe(0);
  });
});

// --- Emotes (GDD §10.2): validated, capped, participant-only ------------------
describe("emotes (v1_sendEmote)", () => {
  it("a participant sends a valid emote; it lands in the match's emotes", async () => {
    const matchId = await newDuel("spin");
    const res = await call(A, "v1_sendEmote", {
      matchId,
      emote: "fire",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(res.sent).toBe(true);
    expect(res.remaining).toBe(2); // cap 3 − this one

    const snap = await adminDb.collection(`matches/${matchId}/emotes`).get();
    const mine = snap.docs.filter((d) => d.data()["senderUid"] === A.uid);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.data()["emote"]).toBe("fire");
  });

  it("rejects an emote outside the allowed set", async () => {
    const matchId = await newDuel("spin");
    await expect(
      call(A, "v1_sendEmote", {
        matchId,
        emote: "banana",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/invalid-argument",
      details: { field: "emote" },
    });
  });

  it("enforces the per-match send cap (3) per sender", async () => {
    const matchId = await newDuel("spin");
    for (let i = 0; i < 3; i++) {
      await call(A, "v1_sendEmote", {
        matchId,
        emote: "clap",
        idempotencyKey: crypto.randomUUID(),
      });
    }
    await expect(
      call(A, "v1_sendEmote", {
        matchId,
        emote: "clap",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "functions/resource-exhausted",
      details: { reason: "emote-rate-limit" },
    });
  });

  it("a double-tap (same key) is an idempotent no-op", async () => {
    const matchId = await newDuel("spin");
    const key = crypto.randomUUID();
    const first = await call(A, "v1_sendEmote", { matchId, emote: "wow", idempotencyKey: key });
    const replay = await call(A, "v1_sendEmote", { matchId, emote: "wow", idempotencyKey: key });
    expect(replay).toEqual(first); // cached, not a second write
    const snap = await adminDb.collection(`matches/${matchId}/emotes`).get();
    expect(snap.docs.filter((d) => d.data()["senderUid"] === A.uid)).toHaveLength(1);
  });

  it("rejects a non-participant", async () => {
    const matchId = await newDuel("spin");
    // C is authenticated but not in the match — no profile needed; v1_sendEmote
    // rejects on the participant check alone.
    const C = await makeClient("itC");
    try {
      await expect(
        call(C, "v1_sendEmote", {
          matchId,
          emote: "fire",
          idempotencyKey: crypto.randomUUID(),
        }),
      ).rejects.toMatchObject({
        code: "functions/permission-denied",
        details: { reason: "not-participant" },
      });
    } finally {
      await deleteClient((C.fns as any).app);
    }
  });
});
