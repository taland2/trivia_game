import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/match_list_entry.dart';
import 'auth_providers.dart';
import 'firebase_providers.dart';

/// Live stream of the player's match-list projections (Home's single data
/// source). Active duels are capped at ⚖️ 20, so we read the small collection
/// and sort client-side by recency — no composite index, no ordered query that
/// could drop a doc missing the sort field.
final matchListStreamProvider = StreamProvider<List<MatchListEntry>>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(const []);
  final db = ref.watch(firestoreProvider);
  return db.collection('users/$uid/matchList').snapshots().map((snap) {
    final entries = snap.docs.map(MatchListEntry.fromDoc).toList();
    entries.sort((a, b) => b.lastEventMs.compareTo(a.lastEventMs));
    return entries;
  });
});

/// Active matches only (drops finished/forfeited), ordered pending-turn first
/// then by recency. The partition is stable, so the upstream recency sort is
/// preserved within each group (Home renders this list as-is).
final activeMatchesProvider = Provider<AsyncValue<List<MatchListEntry>>>((ref) {
  return ref.watch(matchListStreamProvider).whenData((entries) {
    final pending = <MatchListEntry>[];
    final rest = <MatchListEntry>[];
    for (final e in entries) {
      if (!e.isActive) continue;
      (e.isPendingTurn ? pending : rest).add(e);
    }
    return [...pending, ...rest];
  });
});

/// Matches awaiting the player's action now — drives the Home action list and a
/// tab badge. Pending = active AND it's your turn.
final pendingTurnsProvider = Provider<AsyncValue<List<MatchListEntry>>>((ref) {
  return ref.watch(matchListStreamProvider).whenData(
        (entries) => entries.where((e) => e.isPendingTurn).toList(),
      );
});
