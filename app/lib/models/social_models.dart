import 'package:cloud_firestore/cloud_firestore.dart';

// Client mirrors of the Phase 8a social projections. The social graph is
// function-written (guardrail #1); the client READS friendships / friendRequests
// and friend profiles, and mutates only through the v1_* callables (social_service).

/// A duel opponent — the selection type for the friend picker / new-duel flow.
/// Replaces the dev-only `SeedFriend`; built from a friend's `users/{uid}` doc.
class Opponent {
  const Opponent({required this.uid, required this.displayName, required this.avatarId});

  final String uid;
  final String displayName;
  final int avatarId;
}

/// A username-search hit (the public subset returned by v1_searchUsername).
class UserSearchResult {
  const UserSearchResult({
    required this.uid,
    required this.username,
    required this.displayName,
    required this.avatarId,
  });

  final String uid;
  final String username;
  final String displayName;
  final int avatarId;

  factory UserSearchResult.fromMap(Map<dynamic, dynamic> m) => UserSearchResult(
        uid: m['uid'] as String,
        username: (m['username'] as String?) ?? '',
        displayName: (m['displayName'] as String?) ?? '',
        avatarId: (m['avatarId'] as num?)?.toInt() ?? 0,
      );
}

/// A `friendships/{pairId}` edge. `friendUid` is the member that isn't the viewer.
class FriendEdge {
  const FriendEdge({required this.friendUid, required this.source});

  final String friendUid;
  final String source; // invite | search | qr | seed

  factory FriendEdge.fromDoc(
    DocumentSnapshot<Map<String, dynamic>> doc,
    String viewerUid,
  ) {
    final data = doc.data() ?? const {};
    final uids = ((data['uids'] as List?) ?? const []).cast<String>();
    final other = uids.firstWhere((u) => u != viewerUid, orElse: () => '');
    return FriendEdge(friendUid: other, source: (data['source'] as String?) ?? '');
  }
}

/// A `friendRequests/{from}_{to}` doc. Drives the incoming-requests list.
class FriendRequest {
  const FriendRequest({
    required this.id,
    required this.from,
    required this.to,
    required this.state,
    required this.fromName,
    this.fromUsername,
  });

  final String id;
  final String from;
  final String to;
  final String state; // pending | accepted | declined

  /// Sender identity denormalized onto the request (the recipient isn't a friend
  /// yet, so can't read the sender's `users/{from}` doc).
  final String fromName;
  final String? fromUsername;

  factory FriendRequest.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return FriendRequest(
      id: doc.id,
      from: (data['from'] as String?) ?? '',
      to: (data['to'] as String?) ?? '',
      state: (data['state'] as String?) ?? 'pending',
      fromName: (data['fromName'] as String?) ?? '',
      fromUsername: data['fromUsername'] as String?,
    );
  }
}

/// Result of v1_redeemInviteCode — the new friend + an optional auto-duel.
class RedeemResult {
  const RedeemResult({required this.friendUid, this.autoMatchId});
  final String friendUid;
  final String? autoMatchId;
}
