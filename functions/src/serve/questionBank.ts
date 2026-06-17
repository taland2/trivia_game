import type { Firestore } from "firebase-admin/firestore";
import type { Difficulty } from "@trivia/api-contract";

// Raw question shape as stored in Firestore `questions/{id}`.
// Clients never read this collection (rules deny all access).
export interface BankQuestion {
  id: string;
  text: string;
  answers: [string, string, string, string];
  correctIx: number;
  difficulty: Difficulty;
  language: string;
  category: string;
}

export interface ShuffledQuestion {
  text: string;
  // Answers in the new (shuffled) display order.
  answers: [string, string, string, string];
  // correctIx remapped to the shuffled order.
  correctIx: number;
}

// Fisher-Yates shuffle — deterministic given rng; random by default.
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// Shuffle the 4 answer options and remap correctIx to the new order.
// The correct answer index in the payload MUST be re-mapped so
// servingsPrivate always stores the index relative to the shuffled order.
export function shuffleAnswers(question: BankQuestion): ShuffledQuestion {
  const indices = [0, 1, 2, 3];
  const shuffled = shuffleArray(indices);
  const answers = shuffled.map((i) => question.answers[i]!) as [
    string,
    string,
    string,
    string,
  ];
  const correctIx = shuffled.indexOf(question.correctIx);
  return { text: question.text, answers, correctIx };
}

// Pick one random question from the bank matching language + category + difficulty.
// `excludeIds` prevents serving the same question twice in one round.
export async function pickQuestion(
  db: Firestore,
  opts: {
    language: string;
    category: string;
    difficulty: Difficulty;
    excludeIds?: string[];
  },
): Promise<BankQuestion> {
  const { language, category, difficulty, excludeIds = [] } = opts;

  const snap = await db
    .collection("questions")
    .where("language", "==", language)
    .where("category", "==", category)
    .where("difficulty", "==", difficulty)
    .get();

  const candidates = snap.docs
    .filter((d) => !excludeIds.includes(d.id))
    .map((d) => ({ id: d.id, ...d.data() }) as BankQuestion);

  if (candidates.length === 0) {
    throw new Error(
      `No question found for ${language}/${category}/${difficulty} (excluded: ${excludeIds.join(",")})`,
    );
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  return pick;
}

// Load specific bank questions by id, preserving the requested order. Used when
// the second player of a round must receive the SAME questions the starter
// locked in (GDD §4.1 — questions locked at first serve).
export async function loadQuestions(
  db: Firestore,
  ids: string[],
): Promise<BankQuestion[]> {
  const refs = ids.map((id) => db.collection("questions").doc(id));
  const snaps = await db.getAll(...refs);
  return snaps.map((s) => {
    if (!s.exists) {
      throw new Error(`Locked question ${s.id} no longer exists in the bank`);
    }
    return { id: s.id, ...s.data() } as BankQuestion;
  });
}
