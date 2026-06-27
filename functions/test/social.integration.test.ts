// Emulator integration — Phase 8a social graph (doc 07 §2.1, GDD §10.1/§11):
// username claim/search, friend requests, invite issue/redeem, block/unfriend +
// the mid-match cancel cascade, the createDuel friend/block gate, and account
// deletion (opponent forfeit). Requires the emulator suite (npm run test:emulator).

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
let A: Client;
let B: Client;
let C: Client;

const key = () => crypto.randomUUID();

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

async function setProfile(c: Client, displayName: string): Promise<void> {
  await setDoc(clientDoc(c.fs, `users/${c.uid}`), {
    language: "he", isGuest: true, displayName, avatarId: 1, searchable: true,
    createdAt: new Date(),
  });
}

async function deleteCollection(name: string): Promise<void> {
  const snap = await adminDb.collection(name).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function clearSocial(): Promise<void> {
  await Promise.all([
    deleteCollection("friendships"),
    deleteCollection("friendRequests"),
    deleteCollection("invites"),
    deleteCollection("usernames"),
    deleteCollection("matches"),
    deleteCollection("idempotency"),
  ]);
  for (const c of [A, B, C]) {
    const ml = await adminDb.collection(`users/${c.uid}/matchList`).get();
    await Promise.all(ml.docs.map((d) => d.ref.delete()));
    // Reset to a clean base profile (clears blocked/username from prior tests).
    await adminDb.doc(`users/${c.uid}`).set({
      language: "he", isGuest: true, displayName: c.uid, avatarId: 1, searchable: true,
    });
  }
}

async function befriend(x: Client, y: Client): Promise<void> {
  await adminDb.doc(`friendships/${pairId(x.uid, y.uid)}`).set({
    uids: [x.uid, y.uid].sort(), since: new Date().toISOString(), source: "test",
  });
}

beforeAll(async () => {
  adminApp = adminInitApp({ projectId: PROJECT }, "admin-social");
  adminDb = getAdminFirestore(adminApp);
  A = await makeClient("socialA");
  B = await makeClient("socialB");
  C = await makeClient("socialC");
  await setProfile(A, "Alice");
  await setProfile(B, "Bob");
  await setProfile(C, "Cara");
});

beforeEach(clearSocial);

afterAll(async () => {
  await Promise.all([
    deleteClient((A.fns as any).app),
    deleteClient((B.fns as any).app),
    deleteClient((C.fns as any).app),
  ]).catch(() => {});
  await adminDeleteApp(adminApp);
});

describe("username claim + search", () => {
  it("claims a handle, rejects a taken one, and is idempotent", async () => {
    const k = key();
    expect((await call(A, "v1_claimUsername", { username: "Alice_K", idempotencyKey: k })).username)
      .toBe("alice_k");
    // The registry doc exists, owned by A.
    expect((await adminDb.doc("usernames/alice_k").get()).data()!["uid"]).toBe(A.uid);
    // Replay with the same key → same result, no error.
    expect((await call(A, "v1_claimUsername", { username: "Alice_K", idempotencyKey: k })).username)
      .toBe("alice_k");
    // B can't take it.
    await expect(
      call(B, "v1_claimUsername", { username: "alice_k", idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: "username-taken" } });
  });

  it("releases the old handle on rename", async () => {
    await call(A, "v1_claimUsername", { username: "first", idempotencyKey: key() });
    await call(A, "v1_claimUsername", { username: "second", idempotencyKey: key() });
    expect((await adminDb.doc("usernames/first").get()).exists).toBe(false);
    expect((await adminDb.doc("usernames/second").get()).data()!["uid"]).toBe(A.uid);
  });

  it("rejects a profane handle", async () => {
    await expect(
      call(A, "v1_claimUsername", { username: "fucker", idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: "username-profane" } });
  });

  it("finds searchable users by prefix, excluding self and opt-outs", async () => {
    await call(B, "v1_claimUsername", { username: "bobby", idempotencyKey: key() });
    await call(C, "v1_claimUsername", { username: "bobcat", idempotencyKey: key() });
    const res = await call(A, "v1_searchUsername", { query: "bob" });
    const uids = (res.results as Array<{ uid: string }>).map((r) => r.uid).sort();
    expect(uids).toEqual([B.uid, C.uid].sort());

    // C opts out → drops from results.
    await setDoc(clientDoc(C.fs, `users/${C.uid}`), { searchable: false }, { merge: true });
    const res2 = await call(A, "v1_searchUsername", { query: "bob" });
    expect((res2.results as Array<{ uid: string }>).map((r) => r.uid)).toEqual([B.uid]);
  });
});

describe("friend requests", () => {
  it("send → respond accept creates the edge", async () => {
    const sent = await call(A, "v1_sendFriendRequest", { toUid: B.uid, idempotencyKey: key() });
    expect(sent.state).toBe("pending");
    const reqId = `${A.uid}_${B.uid}`;
    const resp = await call(B, "v1_respondFriendRequest", { requestId: reqId, accept: true, idempotencyKey: key() });
    expect(resp.state).toBe("accepted");
    expect((await adminDb.doc(`friendships/${pairId(A.uid, B.uid)}`).get()).exists).toBe(true);
  });

  it("auto-accepts when the reverse request is already pending", async () => {
    await call(A, "v1_sendFriendRequest", { toUid: B.uid, idempotencyKey: key() });
    const back = await call(B, "v1_sendFriendRequest", { toUid: A.uid, idempotencyKey: key() });
    expect(back.state).toBe("accepted");
    expect((await adminDb.doc(`friendships/${pairId(A.uid, B.uid)}`).get()).exists).toBe(true);
  });

  it("rejects friending yourself", async () => {
    await expect(
      call(A, "v1_sendFriendRequest", { toUid: A.uid, idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { field: "toUid" } });
  });
});

describe("invite codes", () => {
  it("issues an idempotent code and redeem creates friendship + auto-duel", async () => {
    const k = key();
    const issued = await call(A, "v1_issueInviteCode", { idempotencyKey: k });
    expect(issued.code).toHaveLength(8);
    // Replay → same code.
    expect((await call(A, "v1_issueInviteCode", { idempotencyKey: k })).code).toBe(issued.code);

    const redeemed = await call(C, "v1_redeemInviteCode", { code: issued.code, idempotencyKey: key() });
    expect(redeemed.friendUid).toBe(A.uid);
    expect(redeemed.autoMatchId).toBeTruthy();
    expect((await adminDb.doc(`friendships/${pairId(A.uid, C.uid)}`).get()).exists).toBe(true);
    const m = (await adminDb.doc(`matches/${redeemed.autoMatchId}`).get()).data()!;
    expect(m["players"]).toContain(A.uid);
    expect(m["players"]).toContain(C.uid);
  });

  it("rejects redeeming your own code, and an exhausted code", async () => {
    const issued = await call(A, "v1_issueInviteCode", { idempotencyKey: key() });
    await expect(
      call(A, "v1_redeemInviteCode", { code: issued.code, idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: "invite-self" } });

    await adminDb.doc(`invites/${issued.code}`).set({ maxRedemptions: 0 }, { merge: true });
    await expect(
      call(B, "v1_redeemInviteCode", { code: issued.code, idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: "invite-exhausted" } });
  });
});

describe("createDuel friend/block gate", () => {
  it("rejects a duel between non-friends, allows it between friends", async () => {
    await expect(
      call(A, "v1_createDuel", { opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: "not-friends" } });

    await befriend(A, B);
    const { matchId } = await call(A, "v1_createDuel", {
      opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key(),
    });
    expect(matchId).toBeTruthy();
  });
});

describe("block / unfriend cascade (GDD §11)", () => {
  it("block removes the edge, cancels the active match (no points), and blocks new duels", async () => {
    await befriend(A, B);
    const { matchId } = await call(A, "v1_createDuel", {
      opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key(),
    });

    await call(A, "v1_block", { uid: B.uid, idempotencyKey: key() });

    // Friendship gone; match cancelled with no result; both matchLists updated.
    expect((await adminDb.doc(`friendships/${pairId(A.uid, B.uid)}`).get()).exists).toBe(false);
    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["state"]).toBe("cancelled");
    expect(m["result"]).toBeNull();
    // A new duel is blocked.
    await expect(
      call(A, "v1_createDuel", { opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: "blocked" } });

    // Unblock then re-friend → duel allowed again.
    await call(A, "v1_unblock", { uid: B.uid, idempotencyKey: key() });
    await befriend(A, B);
    const ok = await call(A, "v1_createDuel", {
      opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key(),
    });
    expect(ok.matchId).toBeTruthy();
  });

  it("unfriend cancels the active match", async () => {
    await befriend(A, B);
    const { matchId } = await call(A, "v1_createDuel", {
      opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key(),
    });
    await call(A, "v1_unfriend", { uid: B.uid, idempotencyKey: key() });
    expect((await adminDb.doc(`friendships/${pairId(A.uid, B.uid)}`).get()).exists).toBe(false);
    expect((await adminDb.doc(`matches/${matchId}`).get()).data()!["state"]).toBe("cancelled");
  });
});

describe("deleteAccount cascade (GDD §11)", () => {
  it("forfeits active matches to the opponent and tombstones the profile", async () => {
    await befriend(A, B);
    await call(A, "v1_claimUsername", { username: "doomed", idempotencyKey: key() });
    const { matchId } = await call(A, "v1_createDuel", {
      opponentUid: B.uid, categoryMode: "spin", idempotencyKey: key(),
    });

    await call(A, "v1_deleteAccount", { confirmPhrase: "DELETE", idempotencyKey: key() });

    const m = (await adminDb.doc(`matches/${matchId}`).get()).data()!;
    expect(m["state"]).toBe("forfeited");
    expect(m["result"]["winner"]).toBe(B.uid);
    expect(m["result"]["reason"]).toBe("opponent_deleted");
    // Username released, profile tombstoned, friendship dropped.
    expect((await adminDb.doc("usernames/doomed").get()).exists).toBe(false);
    expect((await adminDb.doc(`users/${A.uid}`).get()).data()!["deletedAt"]).toBeTruthy();
    expect((await adminDb.doc(`friendships/${pairId(A.uid, B.uid)}`).get()).exists).toBe(false);
  });
});
