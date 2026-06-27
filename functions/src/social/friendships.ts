import type {
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";

// Friendship graph helpers (doc 08 §2). A friendship is ONE doc keyed by the
// sorted pair id, holding the two uids + provenance. Function-written only
// (guardrail #1); clients read `friendships/*` where they're a member, and the
// weekly board fan-out reads it via `friendsOf` (economy/boards.ts) — so this
// module must keep the pairId format + `uids` array stable.

export type FriendSource = "invite" | "search" | "qr" | "seed";

// Sorted "{a}_{b}" — order-independent so a pair has exactly one doc.
export function pairId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

export function friendshipPath(a: string, b: string): string {
  return `friendships/${pairId(a, b)}`;
}

// PURE: does either user block the other? Callers read both `blocked` arrays in
// their transaction's read phase and pass them here.
export function eitherBlocks(
  aBlocked: string[],
  bBlocked: string[],
  a: string,
  b: string,
): boolean {
  return aBlocked.includes(b) || bBlocked.includes(a);
}

// In-txn existence check (read phase).
export async function isFriendTx(
  tx: Transaction,
  db: Firestore,
  a: string,
  b: string,
): Promise<boolean> {
  const snap = await tx.get(db.doc(friendshipPath(a, b)));
  return snap.exists;
}

// Create the edge (idempotent — re-create just rewrites the same doc). The `since`
// is preserved if the edge already exists so a re-add doesn't reset provenance.
export function createFriendshipTx(
  tx: Transaction,
  db: Firestore,
  a: string,
  b: string,
  source: FriendSource,
  now: Timestamp,
  existed: boolean,
): void {
  if (existed) return;
  tx.set(db.doc(friendshipPath(a, b)), {
    uids: [a, b].sort(),
    since: now,
    source,
  });
}

// Remove the edge (idempotent — delete of a missing doc is a no-op).
export function removeFriendshipTx(
  tx: Transaction,
  db: Firestore,
  a: string,
  b: string,
): void {
  tx.delete(db.doc(friendshipPath(a, b)));
}
