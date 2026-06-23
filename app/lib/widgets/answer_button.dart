import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/tokens.dart';

enum AnswerButtonState { idle, locked, correct, wrong, dimmed }

class AnswerButton extends StatefulWidget {
  final String text;
  final int index;
  final AnswerButtonState state;
  final VoidCallback onTap;

  const AnswerButton({
    super.key,
    required this.text,
    required this.index,
    required this.state,
    required this.onTap,
  });

  @override
  State<AnswerButton> createState() => _AnswerButtonState();
}

class _AnswerButtonState extends State<AnswerButton> {
  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    // a11y (doc 04 §8 / M6): expose the button role + selected/checked state so a
    // screen reader announces the answer and its reveal state, not a bare tap area.
    return Semantics(
      button: true,
      enabled: widget.state == AnswerButtonState.idle,
      selected: widget.state == AnswerButtonState.locked ||
          widget.state == AnswerButtonState.correct ||
          widget.state == AnswerButtonState.wrong,
      label: widget.text,
      child: GestureDetector(
        onTap: widget.state == AnswerButtonState.idle ? widget.onTap : null,
        child: _buildButton(reduceMotion),
      ),
    );
  }

  Widget _buildButton(bool reduceMotion) {
    final backgroundColor = _getBackgroundColor();
    final textColor = _getTextColor();

    Widget button = Container(
      constraints: const BoxConstraints(minHeight: 64),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: widget.state == AnswerButtonState.correct
            ? Border.all(color: AppColors.answerCorrect, width: 2)
            : widget.state == AnswerButtonState.wrong
                ? Border.all(color: AppColors.answerWrong, width: 2)
                : null,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              widget.text,
              style: TextStyle(
                color: textColor,
                fontSize: 16,
                fontWeight: FontWeight.w500,
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          if (widget.state == AnswerButtonState.correct)
            const Icon(Icons.check_circle, color: AppColors.answerCorrect)
                .animate()
                .fadeIn(duration: AppDurations.normal)
          else if (widget.state == AnswerButtonState.wrong)
            const Icon(Icons.cancel, color: AppColors.answerWrong)
                .animate()
                .shake(hz: 2)
                .then()
                .fadeIn(duration: AppDurations.normal),
        ],
      ),
    );

    if (!reduceMotion && widget.state == AnswerButtonState.locked) {
      button = button
          .animate()
          .scale(
            begin: const Offset(1.0, 1.0),
            end: const Offset(0.96, 0.96),
            duration: AppDurations.fast,
          );
    } else if (!reduceMotion && widget.state == AnswerButtonState.wrong) {
      button = button
          .animate()
          .shake(hz: 3, duration: AppDurations.slow);
    }

    return button;
  }

  Color _getBackgroundColor() {
    switch (widget.state) {
      case AnswerButtonState.idle:
        return AppColors.answerIdle;
      case AnswerButtonState.locked:
        return AppColors.answerIdle.withAlpha(77);
      case AnswerButtonState.correct:
        return AppColors.answerCorrect.withAlpha(200);
      case AnswerButtonState.wrong:
        return AppColors.answerWrong.withAlpha(200);
      case AnswerButtonState.dimmed:
        return AppColors.answerDimmed;
    }
  }

  Color _getTextColor() {
    switch (widget.state) {
      case AnswerButtonState.idle:
      case AnswerButtonState.locked:
        return Colors.white;
      case AnswerButtonState.correct:
        return Colors.white;
      case AnswerButtonState.wrong:
        return Colors.white;
      case AnswerButtonState.dimmed:
        return Colors.white54;
    }
  }
}
