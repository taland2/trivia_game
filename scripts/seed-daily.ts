#!/usr/bin/env npx tsx
// Seed deterministic daily sets into the local Firebase emulator (Phase 7a).
//
// Usage (from repo root, with emulators running + questions seeded):
//   npx tsx scripts/seed-daily.ts            # ±window around today
//   npx tsx scripts/seed-daily.ts 2026-06-24 # build a single day
//
// Each dailySets/{dayId} is the SAME dated quiz worldwide (GDD §5), built
// deterministically from the dayId so a re-run is stable. We pick a category +
// in-cell index per slot, then map it to BOTH language banks (dev-seed has 5
// questions per language×category×difficulty cell, doc IDs dev_{lang}_{cat}_
// {diff}_{idx}). The real curation queue + concept pairing is Phase 10.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DAILY_QUESTION_COUNT } from "@trivia/api-contract";

process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8088";
initializeApp({ projectId: "trivia-dev" });
const db = getFirestore();

// Mirrors balance.daily.composition (GDD §5: 3 Easy + 4 Medium + 3 Hard). The
// daily composition is a content-curation decision (Phase 10 owns it for real),
// so it lives here in the seed tool rather than being imported from runtime config.
const COMPOSITION = [
  "easy", "easy", "easy",
  "medium", "medium", "medium", "medium",
  "hard", "hard", "hard",
] as const;

// Fail loudly at seed time if this hand-kept array drifts from the contract's
// canonical question count — otherwise the mismatch only shows up as every
// v1_startDaily rejecting the seeded set with daily-unavailable (ids.length
// check), which is far harder to trace.
if (COMPOSITION.length !== DAILY_QUESTION_COUNT) {
  throw new Error(
    `seed COMPOSITION length (${COMPOSITION.length}) must equal DAILY_QUESTION_COUNT (${DAILY_QUESTION_COUNT})`,
  );
}

// The 8 launch categories (GDD §3.4), matching the dev-seed doc-id slugs.
const CATEGORIES = [
  "general_knowledge", "sports", "movies_tv", "music",
  "science_tech", "history", "geography", "israel_local",
];

const LANGUAGES = ["he", "en"];
const PER_CELL = 5; // dev-seed questions per language×category×difficulty cell
const DAY_MS = 24 * 60 * 60 * 1000;

// Deterministic PRNG (mulberry32) seeded from a 32-bit hash of the dayId, so the
// set for a given date is reproducible across runs and machines.
function seedFromDayId(dayId: string): number {
  let h = 2166136261;
  for (let i = 0; i < dayId.length; i++) {
    h ^= dayId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build the language-agnostic slot layout (category + in-cell index per question),
// then resolve to per-language doc-id arrays. Categories round-robin from a
// day-rotated start so all 8 appear across a week (GDD §5).
function buildDay(dayId: string): Record<string, string[]> {
  const rng = mulberry32(seedFromDayId(dayId));
  const startCat = seedFromDayId(dayId) % CATEGORIES.length;
  const usedKeys = new Set<string>(); // "{cat}_{diff}_{idx}" — no dup question/set

  const slots = COMPOSITION.map((diff, slot) => {
    const category = CATEGORIES[(startCat + slot) % CATEGORIES.length]!;
    let idx = Math.floor(rng() * PER_CELL);
    // Avoid repeating the exact same cell-question within this day.
    for (let tries = 0; tries < PER_CELL && usedKeys.has(`${category}_${diff}_${idx}`); tries++) {
      idx = (idx + 1) % PER_CELL;
    }
    usedKeys.add(`${category}_${diff}_${idx}`);
    return { category, diff, idx };
  });

  const out: Record<string, string[]> = {};
  for (const lang of LANGUAGES) {
    out[lang] = slots.map((s) => `dev_${lang}_${s.category}_${s.diff}_${s.idx}`);
  }
  return out;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  let dayIds: string[];
  if (arg) {
    dayIds = [arg];
  } else {
    // ±window around today (UTC) — covers rollover + streak testing.
    const today = Date.parse(`${ymd(new Date())}T00:00:00Z`);
    dayIds = [];
    for (let d = -10; d <= 3; d++) dayIds.push(ymd(new Date(today + d * DAY_MS)));
  }

  const batch = db.batch();
  for (const dayId of dayIds) {
    batch.set(db.doc(`dailySets/${dayId}`), {
      questionIds: buildDay(dayId),
      publishAt: new Date(`${dayId}T00:00:00Z`),
      source: "dev-seed",
    });
  }
  await batch.commit();
  console.log(`Seeded ${dayIds.length} daily set(s): ${dayIds[0]} .. ${dayIds[dayIds.length - 1]}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
