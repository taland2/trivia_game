import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/l10n/app_localizations.dart';
import 'package:trivia/question_screen.dart';
import 'package:trivia/screens/daily/daily_controller.dart';
import 'package:trivia/screens/daily/daily_result_screen.dart';
import 'package:trivia/screens/daily/daily_screen.dart';

// Drives DailyScreen against a fake DailyApi: it must play the served questions,
// then render the result screen from the SERVER dailyResult + streak (not a local
// re-derivation). The fake returns a score that does NOT equal the sum of the
// per-question points, so a local sum would show a different number.

Map<String, dynamic> _serving(int qIx) => {
      'qIx': qIx,
      'text': 'Q$qIx?',
      'answers': const ['a', 'b', 'c', 'd'],
      'timeLimitMs': 10000,
      'difficulty': 'easy',
    };

class _FakeDailyApi implements DailyApi {
  int submitCalls = 0;

  @override
  Future<DailyStart> startDaily(String dayId) async =>
      DailyStart(dayId: dayId, servings: [_serving(0), _serving(1)]);

  @override
  Future<DailyAnswer> submitDailyAnswer({
    required String dayId,
    required int qIx,
    required int? answerIx,
  }) async {
    submitCalls++;
    final done = qIx == 1;
    return DailyAnswer(
      outcome: AnswerOutcome(
        correctIx: 0, points: 10, basePoints: 10, speedBonus: 0, roundDone: done,
      ),
      result: done
          ? const DailyResult(score: 999, correctCount: 2, weeklyPointsAwarded: 9)
          : null,
      streakCount: done ? 3 : null,
    );
  }
}

Future<void> _settle(WidgetTester tester) async {
  // Drain the post-answer timer chain (flyup 500ms + dispatch 2000ms + advance
  // 2500ms) plus the result-route push transition.
  await tester.pump(const Duration(seconds: 3));
  await tester.pump(const Duration(seconds: 3));
  await tester.pump(const Duration(milliseconds: 600)); // route transition
  await tester.pump();
}

void main() {
  testWidgets('plays the daily and renders the server result + streak', (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [dailyApiProvider.overrideWithValue(_FakeDailyApi())],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: const DailyScreen(),
        ),
      ),
    );
    await tester.pump(); // startDaily resolves -> playing

    expect(find.text('Q0?'), findsOneWidget);
    await tester.tap(find.text('a'));
    await _settle(tester); // q0 done -> advance to q1

    expect(find.text('Q1?'), findsOneWidget);
    await tester.tap(find.text('a'));
    await _settle(tester); // q1 done -> result screen

    // Result renders from the SERVER projection: score 999 (not the local 20),
    // and the streak from the server.
    expect(find.byType(DailyResultScreen), findsOneWidget);
    expect(find.text('999'), findsOneWidget);
    expect(find.text('3-day streak'), findsOneWidget);
  });
}
