// Client mirrors of the weekly/daily leaderboard projections in
// `@trivia/api-contract` (`board.ts`: LeaderboardRow / WeeklyBoard / FriendScore).
// All three are function-written fan-out projections (Phase 7b backend); the
// client only RENDERS them (guardrail #1 — clients never write integrity data).

/// One ranked entry in a viewer's weekly board — a friend or the viewer.
class LeaderboardRow {
  const LeaderboardRow({
    required this.uid,
    required this.name,
    required this.avatarId,
    required this.level,
    required this.points,
    required this.rank,
  });

  final String uid;
  final String name;
  final int avatarId;
  final int level;
  final int points;
  final int rank;

  factory LeaderboardRow.fromMap(Map<dynamic, dynamic> m) => LeaderboardRow(
        uid: m['uid'] as String,
        name: (m['name'] as String?) ?? '',
        avatarId: (m['avatarId'] as num?)?.toInt() ?? 0,
        level: (m['level'] as num?)?.toInt() ?? 1,
        points: (m['points'] as num?)?.toInt() ?? 0,
        rank: (m['rank'] as num?)?.toInt() ?? 0,
      );
}

/// `weekly/{weekId}/boards/{uid}` — the viewer's friend-ranked board. Kept to ONE
/// listened doc per player (doc 06 §10); `rows` arrives sorted by rank ascending
/// and always includes the viewer's own row.
class WeeklyBoard {
  const WeeklyBoard({required this.rows, required this.updatedAt});

  final List<LeaderboardRow> rows;
  final String updatedAt;

  /// The viewer's own row, or null if (defensively) absent.
  LeaderboardRow? rowFor(String uid) {
    for (final r in rows) {
      if (r.uid == uid) return r;
    }
    return null;
  }

  factory WeeklyBoard.fromMap(Map<dynamic, dynamic> m) => WeeklyBoard(
        rows: ((m['rows'] as List?) ?? const [])
            .map((r) => LeaderboardRow.fromMap(r as Map))
            .toList(),
        updatedAt: (m['updatedAt'] as String?) ?? '',
      );
}

/// `daily/{dayId}/friendScores/{uid}` — a player's public daily subset, fanned
/// out on completion. Carries NO question content (GDD §5 anti-spoiler); friends
/// gain read access only after they have finished today's daily (rules gate).
class FriendScore {
  const FriendScore({
    required this.uid,
    required this.name,
    required this.avatarId,
    required this.dayId,
    required this.score,
    required this.correctCount,
    required this.totalMs,
    required this.playedAt,
  });

  final String uid;
  final String name;
  final int avatarId;
  final String dayId;
  final int score;
  final int correctCount;
  final int totalMs;
  final String playedAt;

  factory FriendScore.fromMap(Map<dynamic, dynamic> m) => FriendScore(
        uid: m['uid'] as String,
        name: (m['name'] as String?) ?? '',
        avatarId: (m['avatarId'] as num?)?.toInt() ?? 0,
        dayId: (m['dayId'] as String?) ?? '',
        score: (m['score'] as num?)?.toInt() ?? 0,
        correctCount: (m['correctCount'] as num?)?.toInt() ?? 0,
        totalMs: (m['totalMs'] as num?)?.toInt() ?? 0,
        playedAt: (m['playedAt'] as String?) ?? '',
      );
}
