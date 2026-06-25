import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_providers.dart';
import 'firebase_providers.dart';

/// The player's LOCAL calendar date as "YYYY-MM-DD" (GDD §5 Wordle model). The
/// server validates it against a ±14h window. Computed per read so it tracks the
/// device clock; `ref.invalidate` after midnight refreshes it.
String todayDayId() {
  final n = DateTime.now();
  final mm = n.month.toString().padLeft(2, '0');
  final dd = n.day.toString().padLeft(2, '0');
  return '${n.year}-$mm-$dd';
}

final todayDayIdProvider = Provider<String>((_) => todayDayId());

/// Today's daily state for the Home card: whether the player finished it and
/// their score. Streams `dailyPlays/{uid}_{dayId}` (owner-readable).
class DailyToday {
  const DailyToday({required this.played, required this.score});
  final bool played;
  final int score;

  static const none = DailyToday(played: false, score: 0);
}

final dailyTodayProvider = StreamProvider<DailyToday>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(DailyToday.none);
  final dayId = ref.watch(todayDayIdProvider);
  final db = ref.watch(firestoreProvider);
  return db.doc('dailyPlays/${uid}_$dayId').snapshots().map((snap) {
    final data = snap.data();
    if (data == null) return DailyToday.none;
    return DailyToday(
      played: data['finishedAt'] != null,
      score: (data['score'] as num?)?.toInt() ?? 0,
    );
  });
});
