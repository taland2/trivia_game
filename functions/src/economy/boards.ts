import type { LeaderboardRow } from "@trivia/api-contract";
import { weekId } from "./weekId.js";
import { weeklyScorePath } from "./grants.js";

// Friend-ranked board projections (GDD §7, doc 08 §2). The raw weekly scores/{uid}
// buckets are written transactionally on each award (grants.ts); these fan-outs run
// AFTER that transaction commits — Firestore forbids the reads-after-writes a
// projection needs inside a txn, and no Firestore trigger is deployed (no Blaze).
// Best-effort: a failed fan-out never fails the originating callable (the next
// award rebuilds the board), so callers wrap these in a catch.

export function boardPath(week: string, uid: string): string {
  return `weekly/${week}/boards/${uid}`;
}

export function dailyFriendScorePath(dayId: string, uid: string): string {
  return `daily/${dayId}/friendScores/${uid}`;
}

// --- friendships graph ---------------------------------------------------------

// uids sharing a friendships/{pairId} edge with `uid` (doc 08 §2). The real graph
// lands in Phase 8; 7b seeds it for dev + the test suite writes it via admin.
export async function friendsOf(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<string[]> {
  const snap = await db
    .collection("friendships")
    .where("uids", "array-contains", uid)
    .get();
  const out = new Set<string>();
  for (const d of snap.docs) {
    for (const u of (d.data()["uids"] as string[]) ?? []) {
      if (u !== uid) out.add(u);
    }
  }
  return [...out];
}

// --- weekly board (per-viewer) -------------------------------------------------

export interface BoardMember {
  uid: string;
  name: string;
  avatarId: number;
  level: number;
  points: number;
}

// PURE: rank a viewer's friend group. Sort by points desc, then level desc, then
// uid asc (a stable, deterministic tiebreak); rank is the 1-based position.
export function buildBoardRows(members: BoardMember[]): LeaderboardRow[] {
  const sorted = [...members].sort(
    (a, b) =>
      b.points - a.points ||
      b.level - a.level ||
      (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
  );
  return sorted.map((m, i) => ({
    uid: m.uid,
    name: m.name,
    avatarId: m.avatarId,
    level: m.level,
    points: m.points,
    rank: i + 1,
  }));
}

// Rebuild the weekly board for every viewer whose standings changed when
// `affectedUids` earned points: that's each recipient ∪ each recipient's friends
// (a friend's board contains the recipient's row). Bounded by friend count.
export async function fanOutWeeklyBoards(
  db: FirebaseFirestore.Firestore,
  now: Date,
  affectedUids: string[],
): Promise<void> {
  const week = weekId(now);

  const friendsCache = new Map<string, string[]>();
  const getFriends = async (uid: string): Promise<string[]> => {
    if (!friendsCache.has(uid)) friendsCache.set(uid, await friendsOf(db, uid));
    return friendsCache.get(uid)!;
  };

  // Viewers needing a rebuild, and the member set each viewer's board contains.
  const viewers = new Set<string>();
  for (const uid of affectedUids) {
    viewers.add(uid);
    for (const f of await getFriends(uid)) viewers.add(f);
  }
  const viewerMembers = new Map<string, string[]>();
  const memberSet = new Set<string>();
  for (const v of viewers) {
    const members = [v, ...(await getFriends(v))];
    viewerMembers.set(v, members);
    for (const m of members) memberSet.add(m);
  }

  // One read per distinct member: their weekly points + profile (name/avatar/level).
  const points = new Map<string, number>();
  const profile = new Map<string, { name: string; avatarId: number; level: number }>();
  await Promise.all(
    [...memberSet].map(async (uid) => {
      const [scoreSnap, userSnap] = await Promise.all([
        db.doc(weeklyScorePath(week, uid)).get(),
        db.doc(`users/${uid}`).get(),
      ]);
      points.set(uid, (scoreSnap.data()?.["points"] as number) ?? 0);
      const u = userSnap.data() ?? {};
      profile.set(uid, {
        name: (u["displayName"] as string) ?? "",
        avatarId: (u["avatarId"] as number) ?? 0,
        level: (u["level"] as number) ?? 1,
      });
    }),
  );

  const updatedAt = now.toISOString();
  const batch = db.batch();
  for (const v of viewers) {
    const rows = buildBoardRows(
      viewerMembers.get(v)!.map((uid) => ({
        uid,
        name: profile.get(uid)!.name,
        avatarId: profile.get(uid)!.avatarId,
        level: profile.get(uid)!.level,
        points: points.get(uid) ?? 0,
      })),
    );
    batch.set(db.doc(boardPath(week, v)), { rows, updatedAt });
  }
  await batch.commit();
}

// --- daily friends-today board -------------------------------------------------

// Write the player's own public daily subset (doc 08 §2). No per-viewer fan-out —
// friends read this single doc, gated post-play by the rules `playedAt` check.
export async function fanOutDailyFriendScore(
  db: FirebaseFirestore.Firestore,
  now: Date,
  dayId: string,
  uid: string,
  play: { score: number; correctCount: number; totalMs: number },
): Promise<void> {
  const u = (await db.doc(`users/${uid}`).get()).data() ?? {};
  await db.doc(dailyFriendScorePath(dayId, uid)).set({
    uid,
    name: (u["displayName"] as string) ?? "",
    avatarId: (u["avatarId"] as number) ?? 0,
    dayId,
    score: play.score,
    correctCount: play.correctCount,
    totalMs: play.totalMs,
    playedAt: now.toISOString(),
  });
}
