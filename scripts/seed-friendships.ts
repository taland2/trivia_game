#!/usr/bin/env npx tsx
// Link the on-device guest to the dev seed friends so the Phase 7b weekly board
// and daily friends-today board light up during manual play. The guest is an
// ANONYMOUS uid that doesn't exist at seed time, so this is a separate, uid-
// parameterized step — run it once the guest uid is known (printed on app start
// / visible in the Auth emulator UI).
//
// Usage (from repo root, with emulators running):
//   npx tsx scripts/seed-friendships.ts --uid <guestUid>
//
// Idempotent: friendships/{pairId} uses the sorted-pair id, so re-running just
// overwrites. The real social graph (invites/@username/QR) lands in Phase 8.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8088";

// The seed friend uids — MUST match scripts/seed-friends.ts / seed_friends.dart.
const SEED_FRIEND_UIDS = ["seed_dana", "seed_yossi", "seed_maya", "seed_avi"];

function pairId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

function parseUid(): string {
  const i = process.argv.indexOf("--uid");
  const uid = i >= 0 ? process.argv[i + 1] : undefined;
  if (!uid) {
    console.error("Usage: npx tsx scripts/seed-friendships.ts --uid <guestUid>");
    process.exit(1);
  }
  return uid;
}

async function main(): Promise<void> {
  const guestUid = parseUid();
  initializeApp({ projectId: "trivia-dev" });
  const db = getFirestore();

  const batch = db.batch();
  for (const friend of SEED_FRIEND_UIDS) {
    batch.set(db.collection("friendships").doc(pairId(guestUid, friend)), {
      uids: [guestUid, friend].sort(),
      since: new Date().toISOString(),
      source: "seed",
    });
  }
  await batch.commit();
  console.log(
    `Linked guest ${guestUid} to ${SEED_FRIEND_UIDS.length} seed friends.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
