// Security-rules matrix (doc 09 / doc 12 §1) for the Phase 3 duel collections.
// Uses @firebase/rules-unit-testing against the Firestore emulator with the
// repo's real firestore.rules. Requires the Firestore emulator running
// (scripts/dev.ps1); run via npm run test:emulator.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(here, "..", "..", "firebase", "firestore.rules");

const A = "uidA";
const B = "uidB";
const C = "uidC"; // non-participant

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-trivia-rules",
    firestore: {
      rules: readFileSync(rulesPath, "utf8"),
      host: "127.0.0.1",
      port: 8088,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed canonical docs through the admin (rules-bypassing) context.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "matches/m1"), {
      players: [A, B],
      state: "active",
      turnUid: A,
    });
    await setDoc(doc(db, "matches/m1/rounds/0"), {
      questionIds: ["q1", "q2", "q3"],
      perPlayer: {},
    });
    await setDoc(doc(db, "matches/m1/recaps/0"), { winner: A });
    await setDoc(doc(db, "users", A, "matchList", "m1"), { opponentUid: B });
    await setDoc(doc(db, "questions/q1"), { text: "secret" });
    await setDoc(doc(db, "servingsPrivate/m1_0_0_uidA"), { correctIx: 2 });
  });
});

describe("matches/{id}", () => {
  it("is readable by participants, denied to others and anonymous", async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext(A).firestore(), "matches/m1")));
    await assertSucceeds(getDoc(doc(env.authenticatedContext(B).firestore(), "matches/m1")));
    await assertFails(getDoc(doc(env.authenticatedContext(C).firestore(), "matches/m1")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "matches/m1")));
  });

  it("is never client-writable", async () => {
    await assertFails(
      setDoc(doc(env.authenticatedContext(A).firestore(), "matches/m1"), {
        players: [A, B],
        state: "finished",
      }),
    );
  });
});

describe("rounds vs recaps (reveal rule)", () => {
  it("denies the live round doc to everyone, including participants", async () => {
    await assertFails(getDoc(doc(env.authenticatedContext(A).firestore(), "matches/m1/rounds/0")));
    await assertFails(getDoc(doc(env.authenticatedContext(C).firestore(), "matches/m1/rounds/0")));
  });

  it("exposes the recap to participants only", async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext(A).firestore(), "matches/m1/recaps/0")));
    await assertSucceeds(getDoc(doc(env.authenticatedContext(B).firestore(), "matches/m1/recaps/0")));
    await assertFails(getDoc(doc(env.authenticatedContext(C).firestore(), "matches/m1/recaps/0")));
  });
});

describe("matchList projection", () => {
  it("is owner-readable only", async () => {
    await assertSucceeds(
      getDoc(doc(env.authenticatedContext(A).firestore(), "users", A, "matchList", "m1")),
    );
    await assertFails(
      getDoc(doc(env.authenticatedContext(B).firestore(), "users", A, "matchList", "m1")),
    );
  });
});

describe("function-only collections stay sealed", () => {
  it("denies the question bank and servingsPrivate to all clients", async () => {
    await assertFails(getDoc(doc(env.authenticatedContext(A).firestore(), "questions/q1")));
    await assertFails(
      getDoc(doc(env.authenticatedContext(A).firestore(), "servingsPrivate/m1_0_0_uidA")),
    );
  });
});
