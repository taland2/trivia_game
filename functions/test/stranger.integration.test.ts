// Emulator integration — stranger queue (GDD §4.8). The feature is flag-gated
// OFF by default; this suite flips it ON via the config/flags doc (the env-var
// layer can't reach the already-running functions emulator process). Requires
// the emulator suite running (scripts/dev.ps1).

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

let adminApp: AdminApp;
let adminDb: FirebaseFirestore.Firestore;

interface Client { fns: Functions; fs: ClientFirestore; auth: Auth; uid: string }

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

async function setProfile(c: Client, language: string, level = 1): Promise<void> {
  await setDoc(clientDoc(c.fs, `users/${c.uid}`), {
    language, isGuest: true, createdAt: new Date(),
  });
  // level is function-written; set it via admin (client can't write it).
  await adminDb.doc(`users/${c.uid}`).set({ level }, { merge: true });
}

async function setFlag(enabled: boolean): Promise<void> {
  await adminDb.doc("config/flags").set(
    { stranger_queue_enabled: enabled }, { merge: true },
  );
}

async function clearQueue(uids: string[]): Promise<void> {
  await Promise.all(
    uids.map((u) => adminDb.doc(`strangerQueue/${u}`).delete()),
  );
}

let A: Client;
let B: Client;
let C: Client;

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-stranger");
  adminDb = getAdminFirestore(adminApp);

  A = await makeClient("stA");
  B = await makeClient("stB");
  C = await makeClient("stC");
  await setProfile(A, "he", 5);
  await setProfile(B, "he", 6); // close to A
  await setProfile(C, "en", 5); // different language
});

beforeEach(async () => {
  await clearQueue([A.uid, B.uid, C.uid]);
});

afterAll(async () => {
  await Promise.allSettled([
    deleteClient((A.fns as any).app),
    deleteClient((B.fns as any).app),
    deleteClient((C.fns as any).app),
    adminDeleteApp(adminApp),
  ]);
});

describe("stranger queue flag off (default)", () => {
  it("is a no-op when the flag is disabled", async () => {
    await setFlag(false);
    const res = await call(A, "v1_joinStrangerQueue", { categoryMode: "spin" });
    expect(res).toEqual({ queued: false });
    expect((await adminDb.doc(`strangerQueue/${A.uid}`).get()).exists).toBe(false);
  });
});

describe("stranger queue flag on", () => {
  beforeEach(async () => { await setFlag(true); });

  it("enqueues the first player, then pairs the second into a stranger match", async () => {
    const r1 = await call(A, "v1_joinStrangerQueue", { categoryMode: "spin" });
    expect(r1).toEqual({ queued: true });
    expect((await adminDb.doc(`strangerQueue/${A.uid}`).get()).exists).toBe(true);

    const r2 = await call(B, "v1_joinStrangerQueue", { categoryMode: "auto" });
    expect(r2.queued).toBe(true);
    expect(r2.matchId).toBeTruthy();

    // The waiting player's queue doc is consumed; the match is a Spinner stranger
    // match with both players' home projections seeded.
    expect((await adminDb.doc(`strangerQueue/${A.uid}`).get()).exists).toBe(false);
    const m = (await adminDb.doc(`matches/${r2.matchId}`).get()).data()!;
    expect(m["isStrangerMatch"]).toBe(true);
    expect(m["categoryMode"]).toBe("spin");
    expect(m["language"]).toBe("he");
    expect(m["players"]).toContain(A.uid);
    expect(m["players"]).toContain(B.uid);
    for (const uid of [A.uid, B.uid]) {
      expect((await adminDb.doc(`users/${uid}/matchList/${r2.matchId}`).get()).exists).toBe(true);
    }
  });

  it("does not pair players in different languages", async () => {
    await call(A, "v1_joinStrangerQueue", { categoryMode: "spin" }); // he, waiting
    const r = await call(C, "v1_joinStrangerQueue", { categoryMode: "spin" }); // en
    expect(r).toEqual({ queued: true }); // enqueued, not paired
    expect("matchId" in r).toBe(false);
    expect((await adminDb.doc(`strangerQueue/${C.uid}`).get()).exists).toBe(true);
    await clearQueue([C.uid]);
  });

  it("pairs exactly once when two players race onto one waiter", async () => {
    await call(A, "v1_joinStrangerQueue", { categoryMode: "spin" }); // A waits

    const D = await makeClient("stD");
    await setProfile(D, "he", 6);
    const [rB, rD] = await Promise.allSettled([
      call(B, "v1_joinStrangerQueue", { categoryMode: "spin" }),
      call(D, "v1_joinStrangerQueue", { categoryMode: "spin" }),
    ]);

    const results = [rB, rD]
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);
    const paired = results.filter((r) => r.matchId);
    const enqueued = results.filter((r) => !r.matchId);
    // Exactly one consumed A; the other ended up waiting (A's doc gone either way).
    expect(paired).toHaveLength(1);
    expect(enqueued).toHaveLength(1);
    expect((await adminDb.doc(`strangerQueue/${A.uid}`).get()).exists).toBe(false);

    await clearQueue([D.uid]);
    await deleteClient((D.fns as any).app);
  });

  it("leaves the queue idempotently", async () => {
    await call(A, "v1_joinStrangerQueue", { categoryMode: "spin" });
    expect(await call(A, "v1_leaveStrangerQueue", {})).toEqual({ left: true });
    expect((await adminDb.doc(`strangerQueue/${A.uid}`).get()).exists).toBe(false);
    // Second leave on an empty queue still succeeds.
    expect(await call(A, "v1_leaveStrangerQueue", {})).toEqual({ left: true });
  });
});
