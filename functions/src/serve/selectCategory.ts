import { CATEGORIES, type Category } from "@trivia/api-contract";

// Category-selection logic for the three duel modes (GDD §4.3). Pure functions
// over `usedCategories` + Math.random, so the no-repeat/offer invariants are
// unit-testable without the emulator. CATEGORIES is the 8 launch categories.

// Fisher-Yates shuffle (local copy — questionBank's is answer-specific).
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// auto (GDD §4.3): no category repeats until all 8 are used. Pool = categories
// not yet used this match; when exhausted, the pool resets to the full set.
export function chooseAutoCategory(used: readonly string[]): Category {
  const pool = CATEGORIES.filter((c) => !used.includes(c));
  const from = pool.length > 0 ? pool : CATEGORIES;
  return shuffle(from)[0]!;
}

// spin (GDD §4.3): pure luck — any of the 8, repeats allowed (the wheel theater
// lives client-side; the server just decides the landing).
export function chooseSpinCategory(): Category {
  return shuffle(CATEGORIES)[0]!;
}

// pick (GDD §4.3): offer 3 distinct categories to the starter, preferring unused
// ones for variety and filling from the rest if fewer than 3 remain. The result
// is locked on the round so the choice cannot be rerolled.
export function offerPickCategories(used: readonly string[]): Category[] {
  const unused = shuffle(CATEGORIES.filter((c) => !used.includes(c)));
  const rest = shuffle(CATEGORIES.filter((c) => used.includes(c)));
  return [...unused, ...rest].slice(0, 3);
}
