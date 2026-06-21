import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/data/category_mode.dart';
import 'package:trivia/l10n/app_localizations.dart';
import 'package:trivia/question_screen.dart';
import 'package:trivia/round_screen.dart';
import 'package:trivia/screens/match/match_controller.dart';
import 'package:trivia/screens/match/wheel_spin.dart';

// Drives RoundScreen against a fake MatchApi to lock in the real-match wiring:
//  - the served roundIx is threaded into submitAnswer (regression: the old
//    walking skeleton hardcoded roundIx: 0);
//  - a needsPick response routes to the in-round category picker and the chosen
//    categoryId is sent back on the second startRound call;
//  - a spinResult response routes to the wheel before the questions.

const _serving = <String, dynamic>{
  'qIx': 0,
  'text': 'Q?',
  'answers': ['a', 'b', 'c', 'd'],
  'timeLimitMs': 20000,
  'difficulty': 'easy',
  'category': 'sports',
};

class _FakeMatchApi implements MatchApi {
  _FakeMatchApi(this._outcomes);
  final List<StartRoundOutcome> _outcomes;

  int startCalls = 0;
  String? lastCategoryId;
  int? submittedRoundIx;
  int? submittedQIx;

  @override
  Future<String> createDuel({required String opponentUid, required CategoryMode mode}) async =>
      'm1';

  @override
  Future<StartRoundOutcome> startRound({required String matchId, String? categoryId}) async {
    lastCategoryId = categoryId;
    final out = _outcomes[startCalls.clamp(0, _outcomes.length - 1)];
    startCalls++;
    return out;
  }

  @override
  Future<AnswerOutcome> submitAnswer({
    required String matchId,
    required int roundIx,
    required int qIx,
    required int? answerIx,
  }) async {
    submittedRoundIx = roundIx;
    submittedQIx = qIx;
    return const AnswerOutcome(correctIx: 0, points: 50, roundDone: false);
  }
}

Future<void> _pump(WidgetTester tester, _FakeMatchApi api) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: [matchApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: const RoundScreen(matchId: 'm1', categoryMode: CategoryMode.auto),
      ),
    ),
  );
}

void main() {
  testWidgets('threads the served roundIx into submitAnswer (not hardcoded 0)',
      (tester) async {
    final api = _FakeMatchApi([
      const StartRoundOutcome.served(
        roundIx: 2,
        category: 'sports',
        servings: [_serving],
      ),
    ]);
    await _pump(tester, api);
    await tester.pump(); // startRound resolves -> playing

    await tester.tap(find.text('a'));
    await tester.pump(); // submit resolves

    expect(api.submittedRoundIx, 2);
    expect(api.submittedQIx, 0);

    // Drain the post-answer timer chain (flyup + dispatch + auto-advance) so the
    // teardown sees no pending timers.
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('needsPick routes to the picker and sends the chosen categoryId',
      (tester) async {
    final api = _FakeMatchApi([
      const StartRoundOutcome.offer(roundIx: 0, offered: ['sports', 'music', 'history']),
      const StartRoundOutcome.served(
        roundIx: 0,
        category: 'sports',
        servings: [_serving],
      ),
    ]);
    await _pump(tester, api);
    await tester.pump(); // first startRound resolves -> pickCategory

    // The English label for 'sports' is "Sports".
    expect(find.text('Sports'), findsOneWidget);
    await tester.tap(find.text('Sports'));
    await tester.pump(); // second startRound resolves -> playing

    expect(api.startCalls, 2);
    expect(api.lastCategoryId, 'sports');
    expect(find.text('Q?'), findsOneWidget);
  });

  testWidgets('spinResult routes to the wheel before the questions', (tester) async {
    final api = _FakeMatchApi([
      const StartRoundOutcome.served(
        roundIx: 1,
        category: 'music',
        servings: [_serving],
        spinResult: 'music',
      ),
    ]);
    await _pump(tester, api);
    await tester.pump(); // startRound resolves -> spinning

    expect(find.byType(WheelSpin), findsOneWidget);
    expect(find.text('Q?'), findsNothing);
  });
}
