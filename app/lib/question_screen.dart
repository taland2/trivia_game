import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'theme/tokens.dart';
import 'theme/category_colors.dart';
import 'widgets/countdown_ring.dart';
import 'widgets/answer_button.dart';
import 'services/audio_service.dart';
import 'services/haptics_service.dart';

/// Server response for a submitted answer, decoupled from the Firebase SDK so
/// the screen can be widget-tested with an injected fake.
class AnswerOutcome {
  final int correctIx;
  final int points;
  final bool roundDone;
  const AnswerOutcome({
    required this.correctIx,
    required this.points,
    required this.roundDone,
  });
}

/// Submits one answer. matchId + roundIx are bound by RoundScreen (which owns the
/// real match context), so the screen only supplies the in-round coordinates.
typedef SubmitAnswerFn = Future<AnswerOutcome> Function({
  required int qIx,
  required int? answerIx,
});

class QuestionScreen extends StatefulWidget {
  const QuestionScreen({
    super.key,
    required this.serving,
    required this.questionNumber,
    required this.totalQuestions,
    required this.onResult,
    required this.submit,
    this.now = DateTime.now,
  });

  final Map<String, dynamic> serving;
  final int questionNumber;
  final int totalQuestions;
  final void Function(int correctIx, int points, bool roundDone) onResult;

  // Injectable seams for testing (submit is bound to the match by RoundScreen).
  final SubmitAnswerFn submit;
  final DateTime Function() now;

  @override
  State<QuestionScreen> createState() => _QuestionScreenState();
}

class _QuestionScreenState extends State<QuestionScreen> {
  int? _selectedIx;
  int? _correctIx;
  int? _points;
  String? _error;

  late int _qIx;
  late String _text;
  late List<String> _answers;
  late int _timeLimitMs;
  late String _difficulty;
  late String _category;

  late DateTime _servedAt;
  Timer? _ticker;
  Timer? _secondTicker;
  double _timerFraction = 1.0;
  bool _timerExpired = false;

  // Fire-once latch: both the auto-advance delay and the tap-to-skip
  // GestureDetector route through _dispatchResult, so onResult is called
  // exactly once with the real roundDone. (RoundScreen._advancing is a second,
  // cheaper line of defense.)
  bool _resultDispatched = false;
  bool _roundDone = false;

  @override
  void initState() {
    super.initState();
    final s = widget.serving;
    _qIx = (s['qIx'] as num).toInt();
    _text = s['text'] as String;
    _answers = List<String>.from(s['answers'] as List);
    _timeLimitMs = (s['timeLimitMs'] as num).toInt();
    _difficulty = s['difficulty'] as String;
    _category = s['category'] as String? ?? 'general_knowledge';
    _servedAt = widget.now();
    _startVisualTimer();
  }

  void _dispatchResult() {
    if (_resultDispatched || !mounted) return;
    _resultDispatched = true;
    widget.onResult(_correctIx!, _points!, _roundDone);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _secondTicker?.cancel();
    super.dispose();
  }

  void _startVisualTimer() {
    _ticker = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (!mounted) return;
      final elapsed = widget.now().difference(_servedAt).inMilliseconds;
      final fraction = 1.0 - (elapsed / _timeLimitMs).clamp(0.0, 1.0);

      setState(() => _timerFraction = fraction);

      if (fraction <= 0 && !_timerExpired) {
        _timerExpired = true;
        _ticker?.cancel();
        if (_selectedIx == null) _submitAnswer(null);
      }
    });

    _secondTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      final elapsed = widget.now().difference(_servedAt).inMilliseconds;
      final remaining = _timeLimitMs - elapsed;
      if (remaining > 0 && remaining <= 3000) {
        AudioService().play('tick');
      }
    });
  }

  Future<void> _submitAnswer(int? answerIx) async {
    if (_selectedIx != null) return;
    _ticker?.cancel();
    _secondTicker?.cancel();

    setState(() => _selectedIx = answerIx ?? -1);
    HapticsService().lightTap();

    try {
      final outcome = await widget.submit(
        qIx: _qIx,
        answerIx: answerIx,
      );

      if (!mounted) return;
      setState(() {
        _correctIx = outcome.correctIx;
        _points = outcome.points;
        _roundDone = outcome.roundDone;
      });

      if (answerIx == outcome.correctIx) {
        HapticsService().success();
        await AudioService().play('correct');
      } else {
        HapticsService().error();
        await AudioService().play('wrong');
      }

      await Future.delayed(const Duration(milliseconds: 500));
      _showPointsFlyUp(outcome.points);

      await Future.delayed(const Duration(milliseconds: 2000));
      _dispatchResult();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _showPointsFlyUp(int points) {
    if (!mounted) return;
    final base = points ~/ 2;
    final bonus = points - base;
    final text = '$base + $bonus ⚡';

    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.transparent,
      builder: (_) => _PointsFlyUp(text: text),
    );

    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: AppSpacing.md),
              Text(
                _error!,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final categoryColor = CategoryColors.getColor(_category);
    final buttonStates = _getButtonStates();

    return GestureDetector(
      key: const ValueKey('question-root'),
      behavior: HitTestBehavior.opaque,
      onTap: _correctIx != null ? _dispatchResult : null,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildHeader(),
              const SizedBox(height: AppSpacing.md),
              CountdownRing(fraction: _timerFraction),
              const SizedBox(height: AppSpacing.xl),
              _buildQuestionCard(categoryColor),
              const SizedBox(height: AppSpacing.xl),
              _buildAnswerGrid(buttonStates),
            ],
          ),
        ),
      ),
    );
  }

  List<AnswerButtonState> _getButtonStates() {
    if (_correctIx == null) {
      return List.generate(_answers.length, (i) {
        if (_selectedIx == i) return AnswerButtonState.locked;
        if (_selectedIx != null) return AnswerButtonState.dimmed;
        return AnswerButtonState.idle;
      });
    } else {
      return List.generate(_answers.length, (i) {
        if (i == _correctIx) return AnswerButtonState.correct;
        if (i == _selectedIx && _selectedIx != _correctIx) {
          return AnswerButtonState.wrong;
        }
        return AnswerButtonState.dimmed;
      });
    }
  }

  Widget _buildHeader() {
    final diffLabel = switch (_difficulty) {
      'easy' => 'קל',
      'medium' => 'בינוני',
      'hard' => 'קשה',
      _ => _difficulty,
    };

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'שאלה ${widget.questionNumber}/${widget.totalQuestions}',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: AppColors.surfacePrimary,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Text(
            diffLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuestionCard(Color categoryAccent) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(38),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border(
          top: BorderSide(color: categoryAccent, width: 4),
        ),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Text(
        _text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 22,
          fontWeight: FontWeight.bold,
          height: 1.4,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildAnswerGrid(List<AnswerButtonState> states) {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: AppSpacing.md,
      mainAxisSpacing: AppSpacing.md,
      childAspectRatio: 2.5,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: List.generate(_answers.length, (i) {
        return AnswerButton(
          text: _answers[i],
          index: i,
          state: states[i],
          onTap: () => _submitAnswer(i),
        );
      }),
    );
  }

}

class _PointsFlyUp extends StatelessWidget {
  final String text;

  const _PointsFlyUp({required this.text});

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    Widget child = Text(
      '+$text',
      style: const TextStyle(
        color: AppColors.success,
        fontSize: 28,
        fontWeight: FontWeight.bold,
      ),
    );

    if (!reduceMotion) {
      child = child
          .animate()
          .moveY(begin: 0, end: -80, duration: const Duration(milliseconds: 600))
          .then()
          .fadeOut(duration: const Duration(milliseconds: 400));
    }

    return Center(
      child: child,
    );
  }
}
