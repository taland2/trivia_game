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

// The social-graph view of a profile (Phase 8a). Returns null if the doc is
// missing. `blocked` defaults to []; `username` to null (un-claimed). Used by the
// social callables to gate on block state, search-opt-out, and existence.
export interface SocialProfile {
  language: string | null;
  displayName: string;
  avatarId: number;
  searchable: boolean;
  blocked: string[];
  username: string | null;
  isGuest: boolean;
}

export async function loadSocialProfile(
  db: Firestore,
  uid: string,
): Promise<SocialProfile | null> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  const language = d["language"];
  return {
    language: typeof language === "string" && language.length > 0 ? language : null,
    displayName: (d["displayName"] as string) ?? "",
    avatarId: (d["avatarId"] as number) ?? 0,
    searchable: (d["searchable"] as boolean) ?? false,
    blocked: (d["blocked"] as string[]) ?? [],
    username: (d["username"] as string) ?? null,
    isGuest: (d["isGuest"] as boolean) ?? true,
  };
}

// Read just a user's block list (cheap precondition read, like loadUserLanguage).
export async function loadBlocked(db: Firestore, uid: string): Promise<string[]> {
  const snap = await db.doc(`users/${uid}`).get();
  return (snap.data()?.["blocked"] as string[]) ?? [];
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
