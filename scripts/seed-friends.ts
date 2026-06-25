#!/usr/bin/env npx tsx
// Seed dev "friend" profiles into the local emulator's Firestore so the duel
// flow has opponents to play against (Phase 6a). The social graph + invites land
// in Phase 8; until then the app's friend picker offers these fixed players.
//
// Usage (from repo root, with emulators running):
//   npx tsx scripts/seed-friends.ts
//
// Idempotent: stable doc IDs (the seed uids) mean re-running just overwrites.
// `v1_createDuel` reads `users/{opponentUid}.language` for the same-language rule
// (GDD §4.7), so every seed friend uses `he` to match the app's guest profile.
//
// The uids MUST match app/lib/data/seed_friends.dart.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Connect to the local Firestore emulator (singleProjectMode shares one
// namespace, so this matches what the functions read).
process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8088";

initializeApp({ projectId: "trivia-dev" });
const db = getFirestore();

const SEED_FRIENDS = [
  { uid: "seed_dana", displayName: "דנה", avatarId: 1 },
  { uid: "seed_yossi", displayName: "יוסי", avatarId: 2 },
  { uid: "seed_maya", displayName: "מאיה", avatarId: 3 },
  { uid: "seed_avi", displayName: "אבי", avatarId: 4 },
];

// friendships/{pairId} — pairId is the sorted "{a}_{b}" (doc 08 §2). The real
// social graph lands in Phase 8; this dev fan-out lets the Phase 7b weekly board
// rank the seed accounts against each other when they play in the emulator.
function pairId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

async function main(): Promise<void> {
  console.log(`Seeding ${SEED_FRIENDS.length} dev friend profiles...`);
  const batch = db.batch();
  for (const f of SEED_FRIENDS) {
    batch.set(db.collection("users").doc(f.uid), {
      language: "he",
      isGuest: false,
      displayName: f.displayName,
      avatarId: f.avatarId,
      searchable: true,
      createdAt: new Date().toISOString(),
    });
  }

  // Fully connect the seed accounts (each pair → one friendships doc).
  let edges = 0;
  for (let i = 0; i < SEED_FRIENDS.length; i++) {
    for (let j = i + 1; j < SEED_FRIENDS.length; j++) {
      const a = SEED_FRIENDS[i]!.uid;
      const b = SEED_FRIENDS[j]!.uid;
      batch.set(db.collection("friendships").doc(pairId(a, b)), {
        uids: [a, b].sort(),
        since: new Date().toISOString(),
        source: "seed",
      });
      edges++;
    }
  }

  await batch.commit();
  console.log(
    `Done! ${SEED_FRIENDS.length} friend profiles + ${edges} friendship edges written.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
