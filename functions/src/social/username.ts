// Username validation (GDD §10.1, doc 09 §3). PURE — no Firestore — so the claim
// callable can validate before touching the registry, and unit tests need no
// emulator. The stored handle is bare lowercase [a-z0-9_]{3,20}; the leading @ is
// a display affordance only.

// Minimal ASCII profanity denylist — usernames are [a-z0-9_] so non-Latin tokens
// can never appear here (Hebrew display-name moderation is a Gate-C item, doc 09).
// A substring check catches embeddings (e.g. "xfuckx"). The full localized list
// lands at Gate C.
const PROFANITY = ["fuck", "shit", "cunt", "bitch", "nigger", "faggot", "rape"];

export type UsernameError = "invalid" | "profane";

// Lowercase + trim. The only normalization; everything else must already be a
// legal char or validation fails (we never strip illegal chars silently).
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

// Validate a NORMALIZED handle. Returns null if OK, else the failure kind:
//   "invalid"  → charset/length (^[a-z0-9_]{3,20}$)
//   "profane"  → contains a denylisted token
export function validateUsername(norm: string): UsernameError | null {
  if (!/^[a-z0-9_]{3,20}$/.test(norm)) return "invalid";
  if (PROFANITY.some((bad) => norm.includes(bad))) return "profane";
  return null;
}
