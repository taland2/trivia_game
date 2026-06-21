import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { AcceptRematchRequestSchema } from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { loadUserLanguage } from "../user/profile.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";
import {
  buildDuelMatch,
  enforceActiveCaps,
  readActiveDuels,
} from "./createDuel.js";
import { writeMatchTx } from "./matchList.js";
import type { MatchDoc } from "./types.js";

// v1_acceptRematch (doc 07 §2.2): a new match with the same category-selection
// mode and roles swapped (GDD §4.6). A rematch is a brand-new active match, so it
// must honour the same §4.6 caps and same-language rule as createDuel (M2), be
// idempotent (H2), and be persisted atomically with those guards.
export const v1_acceptRematch = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = AcceptRematchRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const { matchId, idempotencyKey } = parsed.data;

  const db = getFirestore();
  const balance = getBalance();

  const snap = await db.doc(`matches/${matchId}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Match not found", { reason: "match" });
  }
  const match = snap.data() as MatchDoc;
  if (!match.players.includes(uid)) {
    throw new HttpsError("permission-denied", "Not a participant", {
      reason: "not-participant",
    });
  }
  if (match.state !== "finished") {
    throw new HttpsError("failed-precondition", "Match not finished yet");
  }

  // Roles swap: the original opponent challenges in the rematch (GDD §4.6).
  const challenger = match.players[1]!;
  const opponent = match.players[0]!;

  // Same-language re-check (GDD §4.7): profiles can change between the original
  // match and the rematch, so re-verify against current profiles rather than
  // trusting the finished match's locked language.
  const [aLang, bLang] = await Promise.all([
    loadUserLanguage(db, challenger),
    loadUserLanguage(db, opponent),
  ]);
  if (aLang === null || bLang === null || aLang !== bLang) {
    throw new HttpsError("failed-precondition", "Different app languages", {
      reason: "language-mismatch",
    });
  }

  const now = Timestamp.now();
  const newMatchId = db.collection("matches").doc().id;
  const iref = idempRef(db, uid, idempotencyKey);
  const otherPlayer = match.players.find((p) => p !== uid)!;

  const result = await db.runTransaction(async (tx) => {
    const cached = await readIdempotent<{ newMatchId: string }>(tx, iref);
    if (cached !== null) return cached;

    // Caps are enforced against the caller's active duels (M2), mirroring
    // createDuel's semantics; the opponent-side cap is a tracked WS5 item.
    const active = await readActiveDuels(tx, db, uid);
    enforceActiveCaps(active, otherPlayer, balance);

    const newMatch = buildDuelMatch({
      challenger,
      opponent,
      categoryMode: match.categoryMode,
      language: aLang,
      now,
    });

    writeMatchTx(tx, db, newMatchId, newMatch, now);
    const res = { newMatchId };
    writeIdempotent(tx, iref, res, now);
    return res;
  });

  return result;
});
