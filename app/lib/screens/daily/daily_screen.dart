import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../question_screen.dart';
import '../../round_result_screen.dart' show RoundQuestionResult;
import '../../router/routes.dart';
import '../../services/audio_service.dart';
import '../../state/daily_providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/async_value_view.dart';
import 'daily_controller.dart';
import 'daily_result_screen.dart';

/// The Daily Challenge play flow (GDD §5): unlock today's set, play all 10
/// questions back-to-back (reusing the duel's [QuestionScreen]), then show the
/// result + streak. Routes off [dailyApiProvider] so it's backend-driven + testable.
class DailyScreen extends ConsumerStatefulWidget {
  const DailyScreen({super.key});

  @override
  ConsumerState<DailyScreen> createState() => _DailyScreenState();
}

enum _Phase { loading, playing, error }

class _DailyScreenState extends ConsumerState<DailyScreen> {
  _Phase _phase = _Phase.loading;
  late String _dayId;

  List<Map<String, dynamic>> _servings = const [];
  int _currentQ = 0;
  final List<RoundQuestionResult> _results = [];
  bool _advancing = false;

  // Captured from the final (10th) submit response.
  DailyResult? _finalResult;
  int _streakCount = 0;

  // Holds the latest submit response so onResult can read its dailyResult/streak.
  DailyAnswer? _lastAnswer;

  DailyApi get _api => ref.read(dailyApiProvider);

  @override
  void initState() {
    super.initState();
    _dayId = ref.read(todayDayIdProvider);
    _start();
  }

  Future<void> _start() async {
    setState(() {
      _phase = _Phase.loading;
      _currentQ = 0;
      _results.clear();
      _advancing = false;
    });
    try {
      final start = await _api.startDaily(_dayId);
      if (!mounted) return;
      setState(() {
        _servings = start.servings;
        _phase = _Phase.playing;
      });
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.error);
    }
  }

  void _onQuestionResult(AnswerOutcome outcome, bool wasCorrect) {
    if (_advancing) return;
    _advancing = true;
    _results.add(RoundQuestionResult(
      difficulty: _servings[_currentQ]['difficulty'] as String,
      points: outcome.points,
      wasCorrect: wasCorrect,
    ));
    // The submit that produced this outcome carried the final result on q10.
    if (_lastAnswer?.result != null) {
      _finalResult = _lastAnswer!.result;
      _streakCount = _lastAnswer!.streakCount ?? 0;
    }
    AudioService().play('whoosh');
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      _advancing = false;
      if (outcome.roundDone || _currentQ >= _servings.length - 1) {
        _showResult();
      } else {
        setState(() => _currentQ++);
      }
    });
  }

  void _showResult() {
    final r = _finalResult;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => DailyResultScreen(
          results: List.of(_results),
          score: r?.score ?? _results.fold(0, (s, x) => s + x.points),
          correctCount: r?.correctCount ?? _results.where((x) => x.wasCorrect).length,
          streakCount: _streakCount,
          weeklyPoints: r?.weeklyPointsAwarded ?? 0,
          dayId: _dayId,
          onContinue: () => context.go(Routes.home),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfacePrimary,
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _Phase.loading:
        return const Center(child: CircularProgressIndicator(color: Colors.white));
      case _Phase.error:
        return AsyncValueView<void>(
          value: AsyncValue.error('daily', StackTrace.current),
          onRetry: _start,
          data: (_) => const SizedBox.shrink(),
        );
      case _Phase.playing:
        if (_currentQ >= _servings.length) {
          return const Center(child: CircularProgressIndicator(color: Colors.white));
        }
        return QuestionScreen(
          key: ValueKey(_currentQ),
          serving: _servings[_currentQ],
          // Daily questions span categories (not exposed in the serving payload),
          // so the screen uses the neutral default accent.
          category: 'general_knowledge',
          questionNumber: _currentQ + 1,
          totalQuestions: _servings.length,
          onResult: _onQuestionResult,
          submit: ({required int qIx, required int? answerIx}) async {
            final ans = await _api.submitDailyAnswer(
              dayId: _dayId, qIx: qIx, answerIx: answerIx,
            );
            _lastAnswer = ans;
            return ans.outcome;
          },
        );
    }
  }
}
