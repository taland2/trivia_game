import 'package:cloud_firestore/cloud_firestore.dart';
import '../data/category_mode.dart';

/// Client view of a `users/{uid}/matchList/{matchId}` projection doc
/// (functions/src/match/types.ts `MatchListEntry`). This is the only match data
/// the Home screen reads — a single owner-readable projection per user, updated
/// server-side on every match event (doc 06 §10).
class MatchListEntry {
  const MatchListEntry({
    required this.matchId,
    required this.opponentUid,
    required this.state,
    required this.yourTurn,
    required this.currentRound,
    required this.categoryMode,
    required this.roundWins,
    required this.lastEventMs,
    required this.finished,
  });

  final String matchId;
  final String opponentUid;
  final String state; // active | finished | forfeited | cancelled | pending
  final bool yourTurn;
  final int currentRound;
  final CategoryMode categoryMode;
  final Map<String, int> roundWins;

  /// `lastEventAt` as epoch millis, used only for client-side sort stability.
  final int lastEventMs;

  /// Whether the match has a terminal result (finished/forfeited).
  final bool finished;

  bool get isActive => state == 'active';

  /// An action the player must take now (drives the Home pending-turns list).
  bool get isPendingTurn => isActive && yourTurn;

  factory MatchListEntry.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    final ts = data['lastEventAt'];
    final lastEventMs = ts is Timestamp ? ts.millisecondsSinceEpoch : 0;
    final wins = (data['roundWins'] as Map?)?.map(
          (k, v) => MapEntry(k as String, (v as num).toInt()),
        ) ??
        const {};
    return MatchListEntry(
      matchId: (data['matchId'] as String?) ?? doc.id,
      opponentUid: (data['opponentUid'] as String?) ?? '',
      state: (data['state'] as String?) ?? 'active',
      yourTurn: (data['yourTurn'] as bool?) ?? false,
      currentRound: (data['currentRound'] as num?)?.toInt() ?? 0,
      categoryMode: CategoryMode.fromWire((data['categoryMode'] as String?) ?? 'spin'),
      roundWins: wins,
      lastEventMs: lastEventMs,
      finished: data['result'] != null,
    );
  }
}
