import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/leaderboard.dart';
import 'auth_providers.dart';
import 'daily_providers.dart';
import 'firebase_providers.dart';

/// Current weekly-bucket id, mirroring the server's `weekId()` (GDD §7): the
/// ISO-8601 week (week-NUMBERING year, Thursday rule) of the local calendar date,
/// e.g. "2026-W24". The server computes it in Asia/Jerusalem; this uses the device
/// local date, which matches for the Israeli audience. A non-IL device near the
/// Monday boundary may briefly target an off-by-one (empty) board and self-heal on
/// its own week tick — acceptable because the board read is display-only (the
/// integrity points are server-written), exactly like `todayDayId()` for the daily.
String clientWeekId([DateTime? now]) {
  final d = now ?? DateTime.now();
  return _isoWeekId(d.year, d.month, d.day);
}

String _isoWeekId(int year, int month, int day) {
  // Treat as a pure calendar date in UTC (no tz semantics needed for the math).
  final date = DateTime.utc(year, month, day);
  final dayNum = date.weekday; // Dart: Mon=1..Sun=7 == ISO weekday.
  // Shift to this week's Thursday; that Thursday's year is the ISO year.
  final thursday = date.add(Duration(days: 4 - dayNum));
  final isoYear = thursday.year;
  final yearStart = DateTime.utc(isoYear, 1, 1);
  final week = ((thursday.difference(yearStart).inDays + 1) / 7).ceil();
  return '$isoYear-W${week.toString().padLeft(2, '0')}';
}

final currentWeekIdProvider = Provider<String>((_) => clientWeekId());

/// The viewer's weekly friends board (one listened doc, doc 06 §10), or null
/// before any award has created it this week. Drives the Weekly screen + Home card.
final weeklyBoardProvider = StreamProvider<WeeklyBoard?>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(null);
  final week = ref.watch(currentWeekIdProvider);
  final db = ref.watch(firestoreProvider);
  return db.doc('weekly/$week/boards/$uid').snapshots().map((snap) {
    final data = snap.data();
    return data == null ? null : WeeklyBoard.fromMap(data);
  });
});

/// The friends-today board for [dayId]: each member of the viewer's weekly board
/// (the only client-readable friend list until Phase 8's social graph) who has
/// finished today's daily, plus the viewer. Read as a fan-in of per-doc gets —
/// `daily/{dayId}/friendScores/{uid}` is friend-gated and a collection query would
/// be denied (firestore.rules). Missing docs = friends who haven't played; they
/// simply don't appear. Sorted by score descending.
final dailyFriendsBoardProvider =
    FutureProvider.family<List<FriendScore>, String>((ref, dayId) async {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return const [];
  final db = ref.watch(firestoreProvider);

  // Member uids come from this week's board rows (∪ self). No board yet ⇒ solo.
  final board = ref.watch(weeklyBoardProvider).valueOrNull;
  final members = <String>{uid, ...?board?.rows.map((r) => r.uid)};

  final snaps = await Future.wait(members.take(50).map((m) async {
    try {
      return await db.doc('daily/$dayId/friendScores/$m').get();
    } catch (_) {
      return null; // A non-friend doc would be denied; skip defensively.
    }
  }));

  final scores = <FriendScore>[];
  for (final snap in snaps) {
    final data = snap?.data();
    if (data != null) scores.add(FriendScore.fromMap(data));
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
});

/// Today's friends board (convenience over [dailyFriendsBoardProvider] for the
/// daily result screen, which already plays "today").
final friendsTodayProvider = FutureProvider<List<FriendScore>>((ref) {
  final dayId = ref.watch(todayDayIdProvider);
  return ref.watch(dailyFriendsBoardProvider(dayId).future);
});
