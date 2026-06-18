import type { Firestore, Timestamp } from "firebase-admin/firestore";

// users/{uid} — the player profile (doc 08 §2). Phase 4a introduces the minimal
// shape needed by the same-language duel rule (GDD §4.7): the client writes
// `language` (a preference field, guardrail #1 whitelist) at sign-in. Integrity
// fields (xp, level, username, stats, streak) are added function-written in
// Phase 4b/7/8 — never client-writable.
export interface UserDoc {
  language: string;
  isGuest: boolean;
  createdAt: Timestamp;
}

// Read a player's app language from their profile. Returns null if the profile
// doc or its `language` field is missing (an un-onboarded guest) — callers turn
// that into a clear client error rather than guessing a language.
export async function loadUserLanguage(
  db: Firestore,
  uid: string,
): Promise<string | null> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const language = snap.data()?.["language"];
  return typeof language === "string" && language.length > 0 ? language : null;
}

// Read the fields the stranger queue matches on (GDD §4.8): language + level.
// Returns null if the profile/language is missing; level defaults to 1 (the
// minimum) for a player who has not yet earned XP.
export async function loadUserQueueProfile(
  db: Firestore,
  uid: string,
): Promise<{ language: string; level: number } | null> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const language = snap.data()?.["language"];
  if (typeof language !== "string" || language.length === 0) return null;
  const level = snap.data()?.["level"];
  return { language, level: typeof level === "number" ? level : 1 };
}
