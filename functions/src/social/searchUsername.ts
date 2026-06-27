import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldPath } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import {
  SearchUsernameRequestSchema,
  type UserSearchResult,
} from "@trivia/api-contract";
import { getBalance } from "../config/balance.js";
import { FUNCTIONS_REGION } from "../config/region.js";
import { normalizeUsername } from "./username.js";

// High-codepoint sentinel (U+F8FF) for a docId prefix range scan (the Firestore
// idiom): every handle starting with `q` sorts at/after `q` and before `q+SENTINEL`.
const PREFIX_END = String.fromCodePoint(0xf8ff);

// v1_searchUsername (doc 07 §2.1). PURE READ — no idempotency. Prefix search over
// the `usernames/{handle}` registry by document id (the handle IS the id, so a
// docId range scan needs no extra index). Each hit's profile is filtered server-
// side: drop search-opt-outs (`searchable===false`), self, and blocked-either-way,
// then return the PUBLIC subset only (no xp/stats/blocked) so a non-friend profile
// never reaches the client via a listener.
export const v1_searchUsername = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;

  const parsed = SearchUsernameRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Bad request", {
      reason: "invalid-argument",
      field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
    });
  }
  const q = normalizeUsername(parsed.data.query);
  if (q.length === 0) return { results: [] };

  const db = getFirestore();
  const balance = getBalance();

  // The caller's own block list (one direction); the other direction is read per
  // hit below. Over-fetch a little so post-filtering still fills the limit.
  const [mineSnap, hitSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db
      .collection("usernames")
      .orderBy(FieldPath.documentId())
      .startAt(q)
      .endAt(q + PREFIX_END)
      .limit(balance.social.searchResultLimit * 3)
      .get(),
  ]);
  const myBlocked = (mineSnap.data()?.["blocked"] as string[]) ?? [];

  const results: UserSearchResult[] = [];
  for (const handleDoc of hitSnap.docs) {
    if (results.length >= balance.social.searchResultLimit) break;
    const targetUid = handleDoc.data()?.["uid"] as string | undefined;
    if (!targetUid || targetUid === uid) continue;

    const userSnap = await db.doc(`users/${targetUid}`).get();
    const u = userSnap.data();
    if (!u || u["searchable"] === false) continue;
    const theirBlocked = (u["blocked"] as string[]) ?? [];
    if (myBlocked.includes(targetUid) || theirBlocked.includes(uid)) continue;

    results.push({
      uid: targetUid,
      username: handleDoc.id,
      displayName: (u["displayName"] as string) ?? "",
      avatarId: (u["avatarId"] as number) ?? 0,
    });
  }
  return { results };
});
