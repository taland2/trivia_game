/// A seeded opponent for development. Real profiles + the social graph arrive in
/// Phase 8; until then the friend picker offers these fixed players, whose
/// `users/{uid}` docs are created by `scripts/seed-friends.ts` so the
/// same-language check in `v1_createDuel` (GDD §4.7) passes.
class SeedFriend {
  const SeedFriend({
    required this.uid,
    required this.displayName,
    required this.avatarId,
  });

  final String uid;
  final String displayName;
  final int avatarId;
}

/// The fixed seed roster. The uids MUST match `scripts/seed-friends.ts`. All seed
/// friends use language `he` (matching the dev profile bootstrap) so duels are
/// always same-language.
const List<SeedFriend> kSeedFriends = [
  SeedFriend(uid: 'seed_dana', displayName: 'דנה', avatarId: 1),
  SeedFriend(uid: 'seed_yossi', displayName: 'יוסי', avatarId: 2),
  SeedFriend(uid: 'seed_maya', displayName: 'מאיה', avatarId: 3),
  SeedFriend(uid: 'seed_avi', displayName: 'אבי', avatarId: 4),
];

/// Resolves an opponent uid to its seed display name, or null if unknown
/// (e.g. a real opponent once the social graph lands).
String? seedFriendName(String uid) {
  for (final f in kSeedFriends) {
    if (f.uid == uid) return f.displayName;
  }
  return null;
}
