import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { AcceptRematchRequestSchema } from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { buildDuelMatch, persistNewMatch } from "./createDuel.js";
import type { MatchDoc } from "./types.js";

// v1_acceptRematch (doc 07 §2.2): a new match with the same category-selection
// mode and roles swapped (GDD §4.6). The offer/accept handshake UI lands in
// Phase 6; in Phase 3 any participant of a finished match can spawn the rematch.
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

  const db = getFirestore();
  const snap = await db.doc(`matches/${parsed.data.matchId}`).get();
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

  const now = Timestamp.now();
  const newMatchId = db.collection("matches").doc().id;
  const newMatch = buildDuelMatch({
    challenger: match.players[1], // roles swapped (GDD §4.6)
    opponent: match.players[0],
    categoryMode: match.categoryMode,
    language: match.language,
    now,
  });

  await persistNewMatch(db, newMatchId, newMatch, now);
  return { newMatchId };
});
