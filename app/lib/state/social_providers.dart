import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/social_models.dart';
import 'auth_providers.dart';
import 'firebase_providers.dart';

// Live reads of the social graph (Phase 8a). Mutations go through socialApi
// (services/social_service.dart); these are the listeners the Friends UI binds to.

/// The viewer's friendship edges (`friendships` where uids array-contains me).
final friendshipsStreamProvider = StreamProvider<List<FriendEdge>>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(const []);
  final db = ref.watch(firestoreProvider);
  return db
      .collection('friendships')
      .where('uids', arrayContains: uid)
      .snapshots()
      .map((snap) => snap.docs
          .map((d) => FriendEdge.fromDoc(d, uid))
          .where((e) => e.friendUid.isNotEmpty)
          .toList());
});

/// A friend's public profile (`users/{uid}` — now friend-readable, Phase 8a
/// rules widen). Used to render friend rows + resolve opponent names.
final friendProfileProvider =
    StreamProvider.family<Opponent?, String>((ref, friendUid) {
  final db = ref.watch(firestoreProvider);
  return db.doc('users/$friendUid').snapshots().map((snap) {
    final data = snap.data();
    if (data == null) return null;
    return Opponent(
      uid: friendUid,
      displayName: (data['displayName'] as String?) ?? '',
      avatarId: (data['avatarId'] as num?)?.toInt() ?? 0,
    );
  });
});

/// Incoming pending friend requests (`friendRequests` where to == me, pending).
final incomingRequestsProvider = StreamProvider<List<FriendRequest>>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(const []);
  final db = ref.watch(firestoreProvider);
  return db
      .collection('friendRequests')
      .where('to', isEqualTo: uid)
      .where('state', isEqualTo: 'pending')
      .snapshots()
      .map((snap) => snap.docs.map(FriendRequest.fromDoc).toList());
});
