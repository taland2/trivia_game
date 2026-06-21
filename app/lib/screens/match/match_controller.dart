import 'dart:math';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/category_mode.dart';
import '../../question_screen.dart' show AnswerOutcome;
import '../../state/firebase_providers.dart';

/// Result of `v1_startRound`. Mirrors the union in `@trivia/api-contract`
/// (`StartRoundResponse`): either a pick-mode offer ([needsPick]) or a served
/// round (questions + optional spin landing).
class StartRoundOutcome {
  const StartRoundOutcome.offer({required this.roundIx, required this.offered})
      : needsPick = true,
        category = null,
        servings = const [],
        spinResult = null;

  const StartRoundOutcome.served({
    required this.roundIx,
    required this.category,
    required this.servings,
    this.spinResult,
  })  : needsPick = false,
        offered = const [];

  final bool needsPick;
  final int roundIx;

  /// pick mode, first call: the 3 categories offered to the starter.
  final List<String> offered;

  /// served: the locked category and this player's 3 questions.
  final String? category;
  final List<Map<String, dynamic>> servings;

  /// spin mode only: the wheel's landing category (server-decided; the animation
  /// is theater — doc 07 §2.2).
  final String? spinResult;
}

/// Thin, injectable wrapper over the duel callables. RoundScreen and the duel
/// flow depend on this (via [matchApiProvider]) rather than FirebaseFunctions
/// directly, so widget tests inject a fake without a live backend.
abstract class MatchApi {
  /// `v1_createDuel` → new matchId (GDD §4.2).
  Future<String> createDuel({required String opponentUid, required CategoryMode mode});

  /// `v1_startRound`. Pass [categoryId] on the second call of a pick-mode round.
  Future<StartRoundOutcome> startRound({required String matchId, String? categoryId});

  /// `v1_submitAnswer` for a specific question in a specific round. Threads the
  /// REAL roundIx (the old walking-skeleton hardcoded `roundIx: 0`).
  Future<AnswerOutcome> submitAnswer({
    required String matchId,
    required int roundIx,
    required int qIx,
    required int? answerIx,
  });
}

/// Production [MatchApi] backed by Cloud Functions (region pinned via the
/// injected [FirebaseFunctions]).
class FirebaseMatchApi implements MatchApi {
  FirebaseMatchApi(this._functions);
  final FirebaseFunctions _functions;

  @override
  Future<String> createDuel({
    required String opponentUid,
    required CategoryMode mode,
  }) async {
    final res = await _functions.httpsCallable('v1_createDuel').call<Map>({
      'opponentUid': opponentUid,
      'categoryMode': mode.wire,
      'idempotencyKey': genUuid(),
    });
    return res.data['matchId'] as String;
  }

  @override
  Future<StartRoundOutcome> startRound({
    required String matchId,
    String? categoryId,
  }) async {
    final payload = <String, dynamic>{'matchId': matchId};
    if (categoryId != null) payload['categoryId'] = categoryId;
    final res = await _functions.httpsCallable('v1_startRound').call<Map>(payload);
    final data = res.data;
    if (data['needsPick'] == true) {
      return StartRoundOutcome.offer(
        roundIx: (data['roundIx'] as num).toInt(),
        offered: List<String>.from(data['offered'] as List),
      );
    }
    return StartRoundOutcome.served(
      roundIx: (data['roundIx'] as num).toInt(),
      category: data['category'] as String,
      servings: (data['servings'] as List)
          .map((s) => Map<String, dynamic>.from(s as Map))
          .toList(),
      spinResult: data['spinResult'] as String?,
    );
  }

  @override
  Future<AnswerOutcome> submitAnswer({
    required String matchId,
    required int roundIx,
    required int qIx,
    required int? answerIx,
  }) async {
    final res = await _functions.httpsCallable('v1_submitAnswer').call<Map>({
      'matchId': matchId,
      'roundIx': roundIx,
      'qIx': qIx,
      'answerIx': answerIx,
      'idempotencyKey': genUuid(),
    });
    final data = res.data;
    return AnswerOutcome(
      correctIx: (data['correctIx'] as num).toInt(),
      points: (data['points'] as num).toInt(),
      roundDone: data['roundDone'] as bool? ?? false,
    );
  }
}

final matchApiProvider = Provider<MatchApi>(
  (ref) => FirebaseMatchApi(ref.watch(functionsProvider)),
);

/// RFC-4122 v4 UUID for callable idempotency keys (doc 07 §1).
String genUuid() {
  final rng = Random.secure();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
      '${hex.substring(20, 32)}';
}
