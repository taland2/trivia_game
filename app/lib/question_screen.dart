import 'dart:async';
import 'dart:math';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'theme/tokens.dart';
import 'theme/category_colors.dart';
import 'widgets/countdown_ring.dart';
import 'widgets/answer_button.dart';
import 'services/audio_service.dart';

class QuestionScreen extends StatefulWidget {
  const QuestionScreen({
    super.key,
    required this.matchId,
    required this.serving,
    required this.questionNumber,
    required this.totalQuestions,
    required this.onResult,
  });

  final String matchId;
  final Map<String, dynamic> serving;
  final int questionNumber;
  final int totalQuestions;
  final void Function(int correctIx, int points, bool roundDone) onResult;

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
    _servedAt = DateTime.now();
    _startVisualTimer();
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
      final elapsed = DateTime.now().difference(_servedAt).inMilliseconds;
      final fraction = 1.0 - (elapsed / _timeLimitMs).clamp(0.0, 1.0);

      setState(() => _timerFraction = fraction);

      if (fraction <= 0 && !_timerExpired) {
        _timerExpired = true;
        _ticker?.cancel();
        if (_selectedIx == null) _submitAnswer(null);
      }
    });

    _secondTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      final elapsed = DateTime.now().difference(_servedAt).inMilliseconds;
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
    HapticFeedback.lightImpact();

    try {
      final fn = FirebaseFunctions.instanceFor(region: 'me-west1');
      final result = await fn.httpsCallable('v1_submitAnswer').call<Map>({
        'matchId': widget.matchId,
        'roundIx': 0,
        'qIx': _qIx,
        'answerIx': answerIx,
        'idempotencyKey': _uuid(),
      });

      final data = result.data;
      final correctIx = (data['correctIx'] as num).toInt();
      final points = (data['points'] as num).toInt();
      final roundDone = data['roundDone'] as bool? ?? false;

      setState(() {
        _correctIx = correctIx;
        _points = points;
      });

      if (answerIx == correctIx) {
        HapticFeedback.mediumImpact();
        await AudioService().play('correct');
      } else {
        HapticFeedback.heavyImpact();
        await AudioService().play('wrong');
      }

      await Future.delayed(const Duration(milliseconds: 500));
      _showPointsFlyUp(points);

      await Future.delayed(const Duration(milliseconds: 2000));
      widget.onResult(correctIx, points, roundDone);
    } catch (e) {
      setState(() => _error = e.toString());
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
      onTap: _correctIx != null ? () => widget.onResult(_correctIx!, _points!, false) : null,
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
              const SizedBox(height: AppSpacing.lg),
              _buildProgressText(),
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

  Widget _buildProgressText() {
    return Center(
      child: Text(
        'שאלה ${widget.questionNumber}/${widget.totalQuestions}',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Colors.white70,
        ),
      ),
    );
  }

  String _uuid() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20, 32)}';
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
