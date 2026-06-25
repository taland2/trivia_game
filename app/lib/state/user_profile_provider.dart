import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_providers.dart';
import 'firebase_providers.dart';

/// Client view of `users/{uid}` (doc 08 §2). XP/level + the current level's XP
/// boundaries are written server-side (`nextUserXp`); the client reads them to
/// draw the level bar without knowing the ⚖️ level curve (guardrail #4).
class UserProfile {
  const UserProfile({
    required this.displayName,
    required this.isGuest,
    required this.xp,
    required this.level,
    required this.levelFloorXp,
    required this.levelCeilXp,
    required this.streakCount,
  });

  final String displayName;
  final bool isGuest;
  final int xp;
  final int level;
  final int levelFloorXp;
  final int levelCeilXp;

  /// Daily streak — consecutive days played (GDD §5), function-written.
  final int streakCount;

  /// Fraction through the current level (0..1). 0 when boundaries aren't set yet
  /// (a brand-new guest who has earned no XP).
  double get levelProgress {
    final span = levelCeilXp - levelFloorXp;
    if (span <= 0) return 0;
    return ((xp - levelFloorXp) / span).clamp(0.0, 1.0);
  }

  factory UserProfile.fromMap(Map<String, dynamic> m) => UserProfile(
        displayName: (m['displayName'] as String?) ?? 'Guest',
        isGuest: (m['isGuest'] as bool?) ?? true,
        xp: (m['xp'] as num?)?.toInt() ?? 0,
        level: (m['level'] as num?)?.toInt() ?? 1,
        levelFloorXp: (m['levelFloorXp'] as num?)?.toInt() ?? 0,
        levelCeilXp: (m['levelCeilXp'] as num?)?.toInt() ?? 0,
        streakCount: ((m['streak'] as Map?)?['count'] as num?)?.toInt() ?? 0,
      );
}

/// Live profile of the signed-in user, or null while signed out / before the doc
/// exists. Drives the Profile tab's level ring + XP bar.
final userProfileProvider = StreamProvider<UserProfile?>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(null);
  final db = ref.watch(firestoreProvider);
  return db.doc('users/$uid').snapshots().map((snap) {
    final data = snap.data();
    return data == null ? null : UserProfile.fromMap(data);
  });
});
