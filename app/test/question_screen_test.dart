import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/l10n/app_localizations.dart';
import 'package:trivia/question_screen.dart';

// Widget tests for the fire-once result dispatch and timer-expiry submit.
// QuestionScreen exposes injectable `submit` and `now` seams so these run with
// no Firebase and a controllable clock.

const _serving = <String, dynamic>{
  'qIx': 0,
  'text': 'Q?',
  'answers': ['a', 'b', 'c', 'd'],
  'timeLimitMs': 20000,
  'difficulty': 'easy',
  'category': 'general_knowledge',
};

/// Records every onResult call so tests can assert exactly-once dispatch.
class _ResultRecorder {
  int count = 0;
  AnswerOutcome? last;
  bool? wasCorrect;

  void call(AnswerOutcome outcome, bool correct) {
    count++;
    last = outcome;
    wasCorrect = correct;
  }
}

/// Records submit invocations and returns a canned outcome.
class _FakeSubmit {
  _FakeSubmit({this.roundDone = false});
  final bool roundDone;
  int calls = 0;
  int? lastAnswerIx;

  Future<AnswerOutcome> call({
    required int qIx,
    required int? answerIx,
  }) async {
    calls++;
    lastAnswerIx = answerIx;
    return AnswerOutcome(
      correctIx: 0,
      points: 50,
      basePoints: 40,
      speedBonus: 10,
      roundDone: roundDone,
    );
  }
}

Future<void> _pumpQuestion(
  WidgetTester tester, {
  required _ResultRecorder onResult,
  required SubmitAnswerFn submit,
  DateTime Function()? now,
}) async {
  // Use a phone-sized surface; the default 800x600 test window is too short
  // for the full question layout and would report a spurious overflow.
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(
    MediaQuery(
      // Suppress the infinite countdown-pulse animation so pumpAndSettle settles.
      data: const MediaQueryData(disableAnimations: true),
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: Scaffold(
          backgroundColor: const Color(0xFF6C63FF),
          body: QuestionScreen(
            serving: _serving,
            category: 'general_knowledge',
            questionNumber: 1,
            totalQuestions: 3,
            onResult: onResult.call,
            submit: submit,
            now: now ?? DateTime.now,
          ),
        ),
      ),
    ),
  );
}

void main() {
  // The post-answer flow uses Future.delayed (500ms flyup + 2000ms dispatch +
  // 1200ms dialog pop) that schedule no frames, so pumpAndSettle returns early.
  // Advancing the fake clock with one big pump fires the whole chain, including
  // timers scheduled mid-elapse.
  const flush = Duration(seconds: 3);

  testWidgets('answering an option dispatches onResult exactly once', (tester) async {
    final onResult = _ResultRecorder();
    await _pumpQuestion(tester, onResult: onResult, submit: _FakeSubmit().call);

    await tester.tap(find.text('a'));
    await tester.pump(); // submit resolves, result reveals
    await tester.pump(flush); // drain the delayed-dispatch chain

    expect(onResult.count, 1);
    expect(onResult.last!.correctIx, 0);
    expect(onResult.last!.points, 50);
    expect(onResult.last!.roundDone, false);
    expect(onResult.wasCorrect, true);
  });

  testWidgets('tapping the screen during feedback does not double-dispatch', (tester) async {
    final onResult = _ResultRecorder();
    await _pumpQuestion(tester, onResult: onResult, submit: _FakeSubmit().call);

    // Answer, then let submit resolve and the result reveal (but stay before the
    // 500ms points-flyup dialog, which would otherwise absorb taps).
    await tester.tap(find.text('a'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Tap storm on the screen while the result is shown.
    await tester.tap(find.byKey(const ValueKey('question-root')), warnIfMissed: false);
    await tester.tap(find.byKey(const ValueKey('question-root')), warnIfMissed: false);
    await tester.tap(find.byKey(const ValueKey('question-root')), warnIfMissed: false);

    await tester.pump(flush); // the latched delayed dispatch must be a no-op

    // The latch + the delayed dispatch together must produce exactly one call.
    expect(onResult.count, 1);
  });

  testWidgets('tap-to-skip carries the real roundDone', (tester) async {
    final onResult = _ResultRecorder();
    await _pumpQuestion(
      tester,
      onResult: onResult,
      submit: _FakeSubmit(roundDone: true).call,
    );

    await tester.tap(find.text('a'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.byKey(const ValueKey('question-root')), warnIfMissed: false);
    await tester.pump(flush);

    expect(onResult.count, 1);
    expect(onResult.last!.roundDone, true, reason: 'tap path must not hardcode false');
  });

  testWidgets('timer expiry auto-submits with a null answer, once', (tester) async {
    final onResult = _ResultRecorder();
    final submit = _FakeSubmit();

    // Controllable clock: starts at a fixed instant; the test advances it past
    // the 20s limit to drive the visual timer to expiry.
    var current = DateTime(2026, 1, 1, 12, 0, 0);
    await _pumpQuestion(
      tester,
      onResult: onResult,
      submit: submit.call,
      now: () => current,
    );

    // No answer tapped. Advance the clock past the time limit and let the
    // periodic ticker (50ms) fire, triggering the auto-submit.
    current = current.add(const Duration(milliseconds: 20001));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(flush); // drain the delayed-dispatch chain

    expect(submit.calls, 1);
    expect(submit.lastAnswerIx, isNull, reason: 'timeout submits a null answer');
    expect(onResult.count, 1);
  });
}
