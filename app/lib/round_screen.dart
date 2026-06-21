import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'data/categories.dart';
import 'data/category_mode.dart';
import 'l10n/app_localizations.dart';
import 'question_screen.dart';
import 'round_result_screen.dart';
import 'router/routes.dart';
import 'screens/match/match_controller.dart';
import 'screens/match/wheel_spin.dart';
import 'services/audio_service.dart';
import 'theme/category_colors.dart';
import 'theme/tokens.dart';
import 'widgets/async_value_view.dart';

/// Builds the per-question result from the serving that produced it. Capturing
/// the serving at result time avoids correlating by value later.
@visibleForTesting
RoundQuestionResult roundResultFrom(Map<String, dynamic> serving, int points) =>
    RoundQuestionResult(
      difficulty: serving['difficulty'] as String,
      points: points,
      wasCorrect: points > 0,
    );

/// The phases a round walks through after `v1_startRound`.
enum _Phase { loading, pickCategory, spinning, playing, error }

/// Orchestrates one round of a real match: resolves the category (pick offer /
/// wheel / auto), serves 3 questions, then shows the round result. Drives off
/// [matchApiProvider] so it works against the live backend and is testable.
class RoundScreen extends ConsumerStatefulWidget {
  const RoundScreen({super.key, required this.matchId, this.categoryMode});

  final String matchId;
  final CategoryMode? categoryMode;

  @override
  ConsumerState<RoundScreen> createState() => _RoundScreenState();
}

class _RoundScreenState extends ConsumerState<RoundScreen> {
  _Phase _phase = _Phase.loading;

  int _roundIx = 0;
  String _category = '';
  String? _spinResult;
  List<String> _offered = const [];
  List<Map<String, dynamic>> _servings = const [];

  int _currentQ = 0;
  final List<RoundQuestionResult> _results = [];
  bool _advancing = false;

  MatchApi get _api => ref.read(matchApiProvider);

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start({String? categoryId}) async {
    setState(() {
      _phase = _Phase.loading;
      _currentQ = 0;
      _results.clear();
      _advancing = false;
    });
    try {
      final out = await _api.startRound(matchId: widget.matchId, categoryId: categoryId);
      if (!mounted) return;
      if (out.needsPick) {
        setState(() {
          _roundIx = out.roundIx;
          _offered = out.offered;
          _phase = _Phase.pickCategory;
        });
        return;
      }
      _roundIx = out.roundIx;
      _category = out.category!;
      _servings = out.servings;
      _spinResult = out.spinResult;
      // Spin mode: reveal the wheel before the questions.
      setState(() => _phase = _spinResult != null ? _Phase.spinning : _Phase.playing);
    } catch (e) {
      if (mounted) setState(() => _phase = _Phase.error);
    }
  }

  void _onQuestionResult(int correctIx, int points, bool roundDone) {
    if (_advancing) return;
    _results.add(roundResultFrom(_servings[_currentQ], points));
    _advancing = true;
    AudioService().play('whoosh');
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      _advancing = false;
      if (roundDone) {
        _showResult();
      } else {
        setState(() => _currentQ++);
      }
    });
  }

  void _showResult() {
    final l = AppLocalizations.of(context);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => RoundResultScreen(
          category: _category,
          results: List.of(_results),
          continueLabel: l.roundResultBackHome,
          // After a turn the match flips to the opponent; the player returns Home
          // where the (now opponent-turn) match shows as waiting.
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
          value: AsyncValue.error('round', StackTrace.current),
          onRetry: () => _start(),
          data: (_) => const SizedBox.shrink(),
        );
      case _Phase.pickCategory:
        return _CategoryPicker(
          offered: _offered,
          onPick: (c) => _start(categoryId: c),
        );
      case _Phase.spinning:
        return WheelSpin(
          resultCategory: _spinResult!,
          onDone: () => setState(() => _phase = _Phase.playing),
        );
      case _Phase.playing:
        if (_currentQ >= _servings.length) {
          return const Center(child: CircularProgressIndicator(color: Colors.white));
        }
        return QuestionScreen(
          key: ValueKey(_currentQ),
          serving: _servings[_currentQ],
          questionNumber: _currentQ + 1,
          totalQuestions: _servings.length,
          onResult: _onQuestionResult,
          submit: ({required int qIx, required int? answerIx}) => _api.submitAnswer(
            matchId: widget.matchId,
            roundIx: _roundIx,
            qIx: qIx,
            answerIx: answerIx,
          ),
        );
    }
  }
}

/// Pick-mode in-round chooser: the starter picks one of the 3 offered categories
/// (GDD §4.3). No reroll — the offer is locked server-side.
class _CategoryPicker extends StatelessWidget {
  const _CategoryPicker({required this.offered, required this.onPick});

  final List<String> offered;
  final void Function(String category) onPick;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.roundPickCategoryTitle,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          for (final c in offered)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: ElevatedButton(
                onPressed: () => onPick(c),
                style: ElevatedButton.styleFrom(
                  backgroundColor: CategoryColors.getColor(c),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                ),
                child: Text(
                  Categories.labelFor(l, c),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
