import type {
  DocumentReference,
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";

// Shared idempotency guard for mutating callables (guardrail 5 / doc 07 §1).
// Every mutating callable carries a client-generated key; the first call stores
// its result under `idempotency/{uid}_{key}` and any replay (retry, double-tap)
// returns the stored result instead of mutating again. Read inside the same
// transaction that performs the mutation so check-and-store is atomic.

export function idempRef(
  db: Firestore,
  uid: string,
  key: string,
): DocumentReference {
  return db.doc(`idempotency/${uid}_${key}`);
}

// Inside a txn: the cached result on replay, or null on first sight.
export async function readIdempotent<T>(
  tx: Transaction,
  ref: DocumentReference,
): Promise<T | null> {
  const snap = await tx.get(ref);
  return snap.exists ? (snap.data()!["result"] as T) : null;
}

// Store the callable's result so future replays short-circuit. `expiresAt`/TTL
// retention is deferred (WS5); the shape mirrors the original submitAnswer record.
export function writeIdempotent(
  tx: Transaction,
  ref: DocumentReference,
  result: unknown,
  now: Timestamp,
): void {
  tx.set(ref, { result, createdAt: now });
}
