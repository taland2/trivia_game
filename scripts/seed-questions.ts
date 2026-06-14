#!/usr/bin/env npx tsx
// Seed dev questions into the local Firebase emulator's Firestore.
//
// Usage (from repo root, with emulators running):
//   npx tsx scripts/seed-questions.ts
//
// The script is idempotent: it uses a stable doc ID per question so re-running
// won't duplicate entries. All questions are marked source:"dev-seed" and will
// be replaced by Phase 10 reviewed content.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEED_QUESTIONS } from "./seed-data/questions.js";

// Connect to the local emulator.
process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080";

initializeApp({ projectId: "trivia-dev" });
const db = getFirestore();

async function main(): Promise<void> {
  console.log(`Seeding ${SEED_QUESTIONS.length} dev-seed questions...`);

  const batch = db.batch();
  let count = 0;

  for (const q of SEED_QUESTIONS) {
    // Stable ID: lang_category_difficulty_index prevents duplicate docs on re-run.
    const idx = SEED_QUESTIONS.filter(
      (x) => x.language === q.language && x.category === q.category && x.difficulty === q.difficulty,
    ).indexOf(q);
    const docId = `dev_${q.language}_${q.category}_${q.difficulty}_${idx}`;

    batch.set(db.collection("questions").doc(docId), {
      ...q,
      source: "dev-seed",
      createdAt: new Date().toISOString(),
    });
    count++;

    // Firestore batch writes are limited to 500 per commit.
    if (count % 499 === 0) {
      await batch.commit();
      console.log(`  committed ${count} so far...`);
    }
  }

  await batch.commit();
  console.log(`Done! ${count} questions written to emulator Firestore.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
