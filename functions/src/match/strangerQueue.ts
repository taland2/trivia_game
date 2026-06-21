import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import {
  JoinStrangerQueueRequestSchema,
  LeaveStrangerQueueRequestSchema,
  type JoinStrangerQueueResponse,
} from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { isStrangerQueueEnabled } from "../config/flags.js";
import { loadUserQueueProfile } from "../user/profile.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import { buildDuelMatch } from "./createDuel.js";
import { writeMatchTx } from "./matchList.js";
import type { MatchDoc } from "./types.js";

// Stranger queue (GDD §4.8). Flag-gated OFF until soft launch. A paired match
// always runs Spinner mode (product decision Phase 4b) and is flagged
// isStrangerMatch (excluded from the friends board later). strangerQueue/{uid}
// is function-written and not client-readable (default-deny) — the client learns
// its state from the callable response and its matchList.

interface QueueEntry {
  language: string;
  level: number;
  categoryMode: string;
  enqueuedAt: Timestamp;
}

function queuePath(uid: string): string {
  return `strangerQueue/${uid}`;
}

// Pick the same-language waiting player closest in level. Firestore can't sort by
// |level - x|, but the pre-launch queue is tiny, so we scan same-language entries
// and choose the nearest in memory (ties → earliest enqueued).
function pickClosest(
  candidates: { uid: string; entry: QueueEntry }[],
  myLevel: number,
): string | null {
  let best: { uid: string; dist: number; at: number } | null = null;
  for (const { uid, entry } of candidates) {
    const dist = Math.abs(entry.level - myLevel);
    const at = entry.enqueuedAt.toMillis();
    if (
      best === null ||
      dist < best.dist ||
      (dist === best.dist && at < best.at)
    ) {
      best = { uid, dist, at };
    }
  }
  return best?.uid ?? null;
}

export const v1_joinStrangerQueue = onCall(
  { region: FUNCTIONS_REGION },
  async (request): Promise<JoinStrangerQueueResponse> => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = JoinStrangerQueueRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }
    const { categoryMode, idempotencyKey } = parsed.data;

    const db = getFirestore();

    // Flag off ⇒ no-op (no queue write, no state). The client steers to the
    // daily challenge. A pure no-op needs no idempotency record.
    if (!(await isStrangerQueueEnabled(db))) {
      return { queued: false };
    }

    // Replay guard (H2). The pairing branch checks the record in-transaction, so
    // a double-tap creates at most one match; the enqueue branch re-stores the
    // same record (the queue `set` is itself idempotent), so replays are no-ops.
    const iref = idempRef(db, uid, idempotencyKey);

    const profile = await loadUserQueueProfile(db, uid);
    if (profile === null) {
      throw new HttpsError("not-found", "Set your language first", {
        reason: "user",
      });
    }

    // Candidate scan outside the txn (the in-txn re-read is the authority). Same
    // language, excluding self.
    const waitingSnap = await db
      .collection("strangerQueue")
      .where("language", "==", profile.language)
      .get();
    const candidates = waitingSnap.docs
      .filter((d) => d.id !== uid)
      .map((d) => ({ uid: d.id, entry: d.data() as QueueEntry }));
    const candidateUid = pickClosest(candidates, profile.level);

    const now = Timestamp.now();
    const myQueueRef = db.doc(queuePath(uid));

    // Enqueue self + record the idempotent result in one batch.
    const enqueueSelf = async (): Promise<JoinStrangerQueueResponse> => {
      const res: JoinStrangerQueueResponse = { queued: true };
      const batch = db.batch();
      batch.set(myQueueRef, {
        language: profile.language,
        level: profile.level,
        categoryMode,
        enqueuedAt: now,
      } satisfies QueueEntry);
      batch.set(iref, { result: res, createdAt: now });
      await batch.commit();
      return res;
    };

    if (candidateUid === null) {
      // Nobody waiting — enqueue self.
      return enqueueSelf();
    }

    // Try to pair. The transaction serializes on the candidate's queue doc: two
    // joiners targeting the same waiter can't both consume it — the loser's
    // re-read finds it gone and enqueues instead.
    const candidateRef = db.doc(queuePath(candidateUid));
    const matchId = db.collection("matches").doc().id;
    const paired = await db.runTransaction(async (tx) => {
      const cached = await readIdempotent<JoinStrangerQueueResponse>(tx, iref);
      if (cached !== null) return cached;

      const candSnap = await tx.get(candidateRef);
      if (!candSnap.exists) return null; // taken by another joiner — fall through

      // Stranger match always runs Spinner (product decision Phase 4b); the
      // waiting player is the challenger (takes the first turn).
      const match: MatchDoc = buildDuelMatch({
        challenger: candidateUid,
        opponent: uid,
        categoryMode: "spin",
        language: profile.language,
        now,
        isStrangerMatch: true,
      });

      tx.delete(candidateRef);
      writeMatchTx(tx, db, matchId, match, now);
      const res: JoinStrangerQueueResponse = { queued: true, matchId };
      writeIdempotent(tx, iref, res, now);
      return res;
    });

    if (paired !== null) return paired;

    // The candidate was claimed mid-flight — enqueue self instead.
    return enqueueSelf();
  },
);

export const v1_leaveStrangerQueue = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = LeaveStrangerQueueRequestSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }

    // Idempotent: deleting a missing doc is a no-op.
    await getFirestore().doc(queuePath(uid)).delete();
    return { left: true };
  },
);
