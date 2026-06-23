import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { SendEmoteRequestSchema } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import type { MatchDoc } from "./types.js";

// v1_sendEmote (GDD §10.2) — the only player-to-player communication. An integrity
// write through a callable (guardrail #1): the server validates the emote against
// the allowed set and enforces the per-match send cap, then writes a function-only
// `matches/{matchId}/emotes/{id}` doc that both participants can read. No free text
// ever reaches storage. Idempotent per the client key (a double-tap is a no-op).
export const v1_sendEmote = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = SendEmoteRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { matchId, emote, idempotencyKey } = parsed.data;

  const balance = getBalance();
  if (!balance.emotes.set.includes(emote)) {
    throw new HttpsError("invalid-argument", "Unknown emote", {
      reason: "invalid-argument",
      field: "emote",
    });
  }

  const db = getFirestore();
  const now = Timestamp.now();
  const matchRef = db.doc(`matches/${matchId}`);
  const emotesCol = matchRef.collection("emotes");
  // Minted before the txn so a replay returns the cached result and this id is
  // simply discarded (mirrors createDuel's stable-id-on-replay pattern).
  const emoteId = emotesCol.doc().id;
  const iref = idempRef(db, uid, idempotencyKey);

  return db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ sent: boolean; remaining: number }>(
      tx,
      iref,
    );
    if (cached !== null) return cached;

    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists) {
      throw new HttpsError("not-found", "Match not found", { reason: "match" });
    }
    const match = matchSnap.data() as MatchDoc;
    if (!match.players.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a participant", {
        reason: "not-participant",
      });
    }

    // Cap is per-sender, per-match (GDD §10.2 ⚖️). Active duels cap at 20 and the
    // emote cap is tiny, so this query reads at most `perMatch` docs per player.
    const mine = await tx.get(emotesCol.where("senderUid", "==", uid));
    if (mine.size >= balance.emotes.perMatch) {
      throw new HttpsError("resource-exhausted", "Emote limit reached", {
        reason: "emote-rate-limit",
      });
    }

    tx.set(emotesCol.doc(emoteId), { senderUid: uid, emote, sentAt: now });
    const res = { sent: true, remaining: balance.emotes.perMatch - (mine.size + 1) };
    writeIdempotent(tx, iref, res, now);
    return res;
  });
});
