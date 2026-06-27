import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../question_screen.dart' show AnswerOutcome;
import '../../state/firebase_providers.dart';
import '../match/match_controller.dart' show genUuid;

/// Today's daily set for the player: 10 servings (GDD §5). Mirrors
/// `StartDailyResponse` in `@trivia/api-contract`.
class DailyStart {
  const DailyStart({
    required this.dayId,
    required this.servings,
    this.answeredCount = 0,
  });
  final String dayId;
  final List<Map<String, dynamic>> servings;

  /// Questions the server has already recorded — the resume cursor. The screen
  /// continues from here; replaying from 0 would be rejected out-of-order.
  final int answeredCount;
}

/// Final daily outcome, present on the 10th answer (`DailyResult`).
class DailyResult {
  const DailyResult({
    required this.score,
    required this.correctCount,
    required this.weeklyPointsAwarded,
  });
  final int score;
  final int correctCount;
  final int weeklyPointsAwarded;

  factory DailyResult.fromMap(Map m) => DailyResult(
        score: (m['score'] as num).toInt(),
        correctCount: (m['correctCount'] as num).toInt(),
        weeklyPointsAwarded: (m['weeklyPointsAwarded'] as num?)?.toInt() ?? 0,
      );
}

/// One daily-answer response: the per-question outcome (reused by QuestionScreen
/// via [outcome]) plus the final {dailyResult, streak} on the 10th answer.
class DailyAnswer {
  const DailyAnswer({required this.outcome, this.result, this.streakCount});
  final AnswerOutcome outcome;
  final DailyResult? result;
  final int? streakCount;
}

/// Thin, injectable wrapper over the daily callables — the daily screen depends
/// on this (via [dailyApiProvider]) so widget tests inject a fake.
abstract class DailyApi {
  /// `v1_startDaily` → today's 10 servings (idempotent resume).
  Future<DailyStart> startDaily(String dayId);

  /// `v1_submitDailyAnswer` for one question.
  Future<DailyAnswer> submitDailyAnswer({
    required String dayId,
    required int qIx,
    required int? answerIx,
  });
}

class FirebaseDailyApi implements DailyApi {
  FirebaseDailyApi(this._functions);
  final FirebaseFunctions _functions;

  @override
  Future<DailyStart> startDaily(String dayId) async {
    final res = await _functions
        .httpsCallable('v1_startDaily')
        .call<Map>({'dayId': dayId});
    return DailyStart(
      dayId: res.data['dailyId'] as String,
      servings: (res.data['servings'] as List)
          .map((s) => Map<String, dynamic>.from(s as Map))
          .toList(),
      answeredCount: (res.data['answeredCount'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<DailyAnswer> submitDailyAnswer({
    required String dayId,
    required int qIx,
    required int? answerIx,
  }) async {
    final res = await _functions.httpsCallable('v1_submitDailyAnswer').call<Map>({
      'dayId': dayId,
      'qIx': qIx,
      'answerIx': answerIx,
      'idempotencyKey': genUuid(),
    });
    final data = res.data;
    return DailyAnswer(
      outcome: AnswerOutcome(
        correctIx: (data['correctIx'] as num).toInt(),
        points: (data['points'] as num).toInt(),
        basePoints: (data['basePoints'] as num?)?.toInt() ?? 0,
        speedBonus: (data['speedBonus'] as num?)?.toInt() ?? 0,
        roundDone: data['dailyDone'] as bool? ?? false,
      ),
      result: data['dailyResult'] == null
          ? null
          : DailyResult.fromMap(data['dailyResult'] as Map),
      streakCount: data['streak'] == null
          ? null
          : ((data['streak'] as Map)['count'] as num).toInt(),
    );
  }
}

final dailyApiProvider = Provider<DailyApi>(
  (ref) => FirebaseDailyApi(ref.watch(functionsProvider)),
);
