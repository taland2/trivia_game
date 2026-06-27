import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/social_models.dart';
import '../screens/match/match_controller.dart' show genUuid;
import '../state/firebase_providers.dart';

/// Thin, injectable wrapper over the Phase 8a social callables (doc 07 §2.1).
/// Screens depend on this via [socialApiProvider] rather than FirebaseFunctions
/// directly, so widget tests inject a fake without a live backend. Every mutating
/// call carries a fresh UUID idempotency key (doc 07 §1).
abstract class SocialApi {
  Future<String> claimUsername(String username);
  Future<List<UserSearchResult>> searchUsername(String query);
  Future<String> sendFriendRequest(String toUid);
  Future<String> respondFriendRequest(String requestId, {required bool accept});
  Future<({String code, String link})> issueInviteCode();
  Future<RedeemResult> redeemInviteCode(String code);
  Future<void> unfriend(String uid);
  Future<void> block(String uid);
  Future<void> unblock(String uid);
  Future<void> completeOnboarding({String? displayName, int? avatarId});
  Future<void> deleteAccount();
}

class FirebaseSocialApi implements SocialApi {
  FirebaseSocialApi(this._functions);
  final FirebaseFunctions _functions;

  Future<Map> _call(String fn, Map<String, dynamic> data) async {
    final res = await _functions.httpsCallable(fn).call<Map>(data);
    return res.data;
  }

  @override
  Future<String> claimUsername(String username) async {
    final d = await _call('v1_claimUsername', {
      'username': username,
      'idempotencyKey': genUuid(),
    });
    return d['username'] as String;
  }

  @override
  Future<List<UserSearchResult>> searchUsername(String query) async {
    final d = await _call('v1_searchUsername', {'query': query});
    return ((d['results'] as List?) ?? const [])
        .map((r) => UserSearchResult.fromMap(r as Map))
        .toList();
  }

  @override
  Future<String> sendFriendRequest(String toUid) async {
    final d = await _call('v1_sendFriendRequest', {
      'toUid': toUid,
      'idempotencyKey': genUuid(),
    });
    return d['state'] as String;
  }

  @override
  Future<String> respondFriendRequest(String requestId, {required bool accept}) async {
    final d = await _call('v1_respondFriendRequest', {
      'requestId': requestId,
      'accept': accept,
      'idempotencyKey': genUuid(),
    });
    return d['state'] as String;
  }

  @override
  Future<({String code, String link})> issueInviteCode() async {
    final d = await _call('v1_issueInviteCode', {'idempotencyKey': genUuid()});
    return (code: d['code'] as String, link: d['link'] as String);
  }

  @override
  Future<RedeemResult> redeemInviteCode(String code) async {
    final d = await _call('v1_redeemInviteCode', {
      'code': code,
      'idempotencyKey': genUuid(),
    });
    return RedeemResult(
      friendUid: d['friendUid'] as String,
      autoMatchId: d['autoMatchId'] as String?,
    );
  }

  @override
  Future<void> unfriend(String uid) =>
      _call('v1_unfriend', {'uid': uid, 'idempotencyKey': genUuid()});

  @override
  Future<void> block(String uid) =>
      _call('v1_block', {'uid': uid, 'idempotencyKey': genUuid()});

  @override
  Future<void> unblock(String uid) =>
      _call('v1_unblock', {'uid': uid, 'idempotencyKey': genUuid()});

  @override
  Future<void> completeOnboarding({String? displayName, int? avatarId}) {
    final payload = <String, dynamic>{'idempotencyKey': genUuid()};
    if (displayName != null) payload['displayName'] = displayName;
    if (avatarId != null) payload['avatarId'] = avatarId;
    return _call('v1_completeOnboarding', payload);
  }

  @override
  Future<void> deleteAccount() =>
      _call('v1_deleteAccount', {'confirmPhrase': 'DELETE', 'idempotencyKey': genUuid()});
}

final socialApiProvider = Provider<SocialApi>(
  (ref) => FirebaseSocialApi(ref.watch(functionsProvider)),
);
