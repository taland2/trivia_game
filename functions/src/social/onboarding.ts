import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "../firebase.js";
import { CompleteOnboardingRequestSchema } from "@trivia/api-contract";
import { FUNCTIONS_REGION } from "../config/region.js";
import { idempRef, readIdempotent, writeIdempotent } from "../lib/idempotency.js";

// v1_completeOnboarding (doc 07 §2.1). The single finalize/validation funnel for
// the guest profile's displayName + avatarId (language is set at bootstrap). These
// fields are also client-writable (rules whitelist), but routing onboarding through
// a callable gives one place for validation (and Gate-C profanity on displayName).
// `isGuest` stays true — the guest→registered merge is Phase 8b.
export const v1_completeOnboarding = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const uid = request.auth.uid;

    const parsed = CompleteOnboardingRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Bad request", {
        reason: "invalid-argument",
        field: parsed.error.issues[0]?.path.join(".") ?? "unknown",
      });
    }
    const { displayName, avatarId } = parsed.data;

    const db = getFirestore();
    const now = Timestamp.now();
    const iref = idempRef(db, uid, parsed.data.idempotencyKey);
    const userRef = db.doc(`users/${uid}`);

    return db.runTransaction(async (tx) => {
      const cached = await readIdempotent<{
        displayName: string;
        avatarId: number;
        username: string | null;
      }>(tx, iref);
      if (cached !== null) return cached;

      const snap = await tx.get(userRef);
      const cur = snap.data() ?? {};

      const patch: Record<string, unknown> = {};
      if (displayName !== undefined) patch["displayName"] = displayName;
      if (avatarId !== undefined) patch["avatarId"] = avatarId;
      if (Object.keys(patch).length > 0) tx.set(userRef, patch, { merge: true });

      const res = {
        displayName: (displayName ?? cur["displayName"] ?? "") as string,
        avatarId: (avatarId ?? cur["avatarId"] ?? 0) as number,
        username: (cur["username"] as string) ?? null,
      };
      writeIdempotent(tx, iref, res, now);
      return res;
    });
  },
);
