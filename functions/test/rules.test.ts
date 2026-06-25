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
    await setDoc(doc(db, "matches/m1/emotes/e1"), { senderUid: A, emote: "fire" });
    await setDoc(doc(db, "users", A, "matchList", "m1"), { opponentUid: B });
    await setDoc(doc(db, "questions/q1"), { text: "secret" });
    await setDoc(doc(db, "servingsPrivate/m1_0_0_uidA"), { correctIx: 2 });
    await setDoc(doc(db, `dailyPlays/${A}_2026-06-24`), { uid: A, score: 100 });
    await setDoc(doc(db, "dailySets/2026-06-24"), { questionIds: { he: [] } });
    // Phase 7b: A and B are friends; A has a weekly board + a daily friendScore.
    await setDoc(doc(db, `friendships/${[A, B].sort().join("_")}`), { uids: [A, B].sort() });
    await setDoc(doc(db, "weekly/2026-W26/boards", A), { rows: [], updatedAt: "2026-06-22T00:00:00.000Z" });
    await setDoc(doc(db, "daily/2026-06-24/friendScores", A), { uid: A, score: 100 });
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

describe("emotes (GDD §10.2)", () => {
  it("are participant-readable, denied to others", async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext(A).firestore(), "matches/m1/emotes/e1")));
    await assertSucceeds(getDoc(doc(env.authenticatedContext(B).firestore(), "matches/m1/emotes/e1")));
    await assertFails(getDoc(doc(env.authenticatedContext(C).firestore(), "matches/m1/emotes/e1")));
  });

  it("are never client-writable (sent only via v1_sendEmote)", async () => {
    await assertFails(
      setDoc(doc(env.authenticatedContext(A).firestore(), "matches/m1/emotes/e2"), {
        senderUid: A,
        emote: "fire",
      }),
    );
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

describe("daily challenge (GDD §5)", () => {
  it("dailyPlays is owner-readable only, never client-writable", async () => {
    const id = `${A}_2026-06-24`;
    await assertSucceeds(getDoc(doc(env.authenticatedContext(A).firestore(), "dailyPlays", id)));
    await assertFails(getDoc(doc(env.authenticatedContext(B).firestore(), "dailyPlays", id)));
    await assertFails(
      setDoc(doc(env.authenticatedContext(A).firestore(), "dailyPlays", id), { score: 9999 }),
    );
  });

  it("the curated dailySets are denied to all clients (no pre-play peek)", async () => {
    await assertFails(
      getDoc(doc(env.authenticatedContext(A).firestore(), "dailySets/2026-06-24")),
    );
  });
});

describe("weekly board (GDD §7, Phase 7b)", () => {
  it("is owner-readable only — denied to friends, others and anon", async () => {
    await assertSucceeds(
      getDoc(doc(env.authenticatedContext(A).firestore(), "weekly/2026-W26/boards", A)),
    );
    await assertFails(
      getDoc(doc(env.authenticatedContext(B).firestore(), "weekly/2026-W26/boards", A)),
    );
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), "weekly/2026-W26/boards", A)),
    );
  });

  it("is never client-writable", async () => {
    await assertFails(
      setDoc(doc(env.authenticatedContext(A).firestore(), "weekly/2026-W26/boards", A), {
        rows: [], updatedAt: "x",
      }),
    );
  });
});

describe("daily friends-today board (GDD §5 anti-spoiler, Phase 7b)", () => {
  const day = "2026-06-24";

  it("is always readable by the owner", async () => {
    await assertSucceeds(
      getDoc(doc(env.authenticatedContext(A).firestore(), "daily", day, "friendScores", A)),
    );
  });

  it("a friend who has finished today's daily may read it", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `dailyPlays/${B}_${day}`), {
        uid: B, finishedAt: new Date(),
      });
    });
    await assertSucceeds(
      getDoc(doc(env.authenticatedContext(B).firestore(), "daily", day, "friendScores", A)),
    );
  });

  it("a friend who has NOT finished today is denied (no anchoring)", async () => {
    // B has a started-but-unfinished play → finishedAt is null.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `dailyPlays/${B}_${day}`), {
        uid: B, finishedAt: null,
      });
    });
    await assertFails(
      getDoc(doc(env.authenticatedContext(B).firestore(), "daily", day, "friendScores", A)),
    );
  });

  it("a non-friend is denied even after playing", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `dailyPlays/${C}_${day}`), {
        uid: C, finishedAt: new Date(),
      });
    });
    await assertFails(
      getDoc(doc(env.authenticatedContext(C).firestore(), "daily", day, "friendScores", A)),
    );
  });
});
