// Client mirrors of the server result projections in `@trivia/api-contract`
// (`RoundResultSchema` / `MatchResultSchema` / `RecapPlayerSchema`). The client
// RENDERS these — it never re-derives outcomes from local heuristics (H7). They
// arrive in the `v1_submitAnswer` response and (for the round recap) also as the
// participant-readable `matches/{id}/recaps/{roundIx}` doc (doc 08 §2 reveal rule).

/// One answered question as shown in the post-reveal recap.
class RecapAnswer {
  const RecapAnswer({
    required this.qIx,
    required this.difficulty,
    required this.correct,
    required this.points,
    required this.ms,
  });

  final int qIx;
  final String difficulty;
  final bool correct;
  final int points;
  final int ms;

  factory RecapAnswer.fromMap(Map<dynamic, dynamic> m) => RecapAnswer(
        qIx: (m['qIx'] as num).toInt(),
        difficulty: m['difficulty'] as String,
        correct: m['correct'] as bool,
        points: (m['points'] as num).toInt(),
        ms: (m['ms'] as num).toInt(),
      );
}

/// One player's full round performance (revealed to both only when both finish).
class RecapPlayer {
  const RecapPlayer({
    required this.uid,
    required this.score,
    required this.totalMs,
    required this.answers,
  });

  final String uid;
  final int score;
  final int totalMs;
  final List<RecapAnswer> answers;

  factory RecapPlayer.fromMap(Map<dynamic, dynamic> m) => RecapPlayer(
        uid: m['uid'] as String,
        score: (m['score'] as num).toInt(),
        totalMs: (m['totalMs'] as num).toInt(),
        answers: (m['answers'] as List)
            .map((a) => RecapAnswer.fromMap(a as Map))
            .toList(),
      );
}

/// Result of a single resolved round (GDD §4.1/§4.5). `winner` is a uid, or
/// "shared" for the exact tie that triggers a replay (never surfaced as a recap).
class RoundResult {
  const RoundResult({
    required this.roundIx,
    required this.winner,
    required this.players,
  });

  final int roundIx;
  final String winner;
  final List<RecapPlayer> players;

  RecapPlayer playerFor(String uid) =>
      players.firstWhere((p) => p.uid == uid);
  RecapPlayer opponentOf(String uid) =>
      players.firstWhere((p) => p.uid != uid);

  factory RoundResult.fromMap(Map<dynamic, dynamic> m) => RoundResult(
        roundIx: (m['roundIx'] as num).toInt(),
        winner: m['winner'] as String,
        players:
            (m['players'] as List).map((p) => RecapPlayer.fromMap(p as Map)).toList(),
      );
}

/// Match outcome (GDD §4.1). `finalScore` maps uid → rounds won;
/// `weeklyPointsAwarded` maps uid → weekly leaderboard points granted (GDD §7).
class MatchResult {
  const MatchResult({
    required this.winner,
    required this.reason,
    required this.finalScore,
    this.weeklyPointsAwarded = const {},
  });

  final String winner;
  final String reason; // rounds | tiebreak | forfeit | opponent_deleted
  final Map<String, int> finalScore;
  final Map<String, int> weeklyPointsAwarded;

  factory MatchResult.fromMap(Map<dynamic, dynamic> m) => MatchResult(
        winner: m['winner'] as String,
        reason: m['reason'] as String,
        finalScore: _intMap(m['finalScore']),
        weeklyPointsAwarded: _intMap(m['weeklyPointsAwarded']),
      );

  static Map<String, int> _intMap(dynamic raw) {
    if (raw is! Map) return const {};
    return raw.map((k, v) => MapEntry(k as String, (v as num).toInt()));
  }
}
