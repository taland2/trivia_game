import type { Balance } from "../config/balance.js";
import { previousWeekId } from "./weekId.js";

// Monday-reset job (GDD §7, doc 08 §4). Archives the closing week's final standings
// into each player's profile history (last ⚖️ historyWeeks weeks) and lets the new
// weekId start empty — scores/{uid} and boards/{uid} are lazily created on the first
// award of the new week, so there is nothing to pre-write.
//
// The closing week's `weekly/{closingWeekId}.rolledAt` marker makes a re-run a
// no-op (the emulator suite drives this directly; the scheduled wrapper is wired
// but not deployed until Blaze).

export interface RollWeekResult {
  weekId: string;
  archived: number;
  skipped: boolean;
}

export interface WeeklyHistoryEntry {
  weekId: string;
  points: number;
  rank: number;
  finalizedAt: string;
}

export async function rollWeek(
  db: FirebaseFirestore.Firestore,
  now: Date,
  balance: Balance,
): Promise<RollWeekResult> {
  const closing = previousWeekId(now);
  const metaRef = db.doc(`weekly/${closing}`);

  const metaSnap = await metaRef.get();
  if (metaSnap.exists && metaSnap.data()?.["rolledAt"]) {
    return { weekId: closing, archived: 0, skipped: true };
  }

  // Each viewer's board carries their own ranked row — that's the result we keep.
  const boardsSnap = await db.collection(`weekly/${closing}/boards`).get();
  const finalizedAt = now.toISOString();
  const updates: Array<{ ref: FirebaseFirestore.DocumentReference; history: WeeklyHistoryEntry[] }> = [];

  await Promise.all(
    boardsSnap.docs.map(async (boardDoc) => {
      const uid = boardDoc.id;
      const rows = (boardDoc.data()["rows"] as Array<{
        uid: string;
        points: number;
        rank: number;
      }>) ?? [];
      const own = rows.find((r) => r.uid === uid);
      if (!own) return;

      const entry: WeeklyHistoryEntry = {
        weekId: closing,
        points: own.points,
        rank: own.rank,
        finalizedAt,
      };
      const userRef = db.doc(`users/${uid}`);
      const prior = ((await userRef.get()).data()?.["weeklyHistory"] as
        | WeeklyHistoryEntry[]
        | undefined) ?? [];
      updates.push({
        ref: userRef,
        history: [entry, ...prior].slice(0, balance.weekly.historyWeeks),
      });
    }),
  );

  const batch = db.batch();
  for (const u of updates) {
    batch.set(u.ref, { weeklyHistory: u.history }, { merge: true });
  }
  batch.set(metaRef, { rolledAt: finalizedAt }, { merge: true });
  await batch.commit();

  return { weekId: closing, archived: updates.length, skipped: false };
}
