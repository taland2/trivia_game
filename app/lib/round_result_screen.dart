import 'package:flutter/material.dart';
import 'data/categories.dart';
import 'l10n/app_localizations.dart';
import 'theme/tokens.dart';
import 'theme/category_colors.dart';
import 'services/audio_service.dart';
import 'services/haptics_service.dart';

class RoundQuestionResult {
  const RoundQuestionResult({
    required this.difficulty,
    required this.points,
    required this.wasCorrect,
  });
  final String difficulty;
  final int points;
  final bool wasCorrect;
}

// Displays the round summary: total score + per-question breakdown. After a turn
// the match flips to the opponent, so the primary action returns Home rather than
// replaying (which would fail the not-your-turn precondition).
class RoundResultScreen extends StatelessWidget {
  const RoundResultScreen({
    super.key,
    required this.category,
    required this.results,
    required this.onContinue,
    required this.continueLabel,
  });

  final String category;
  final List<RoundQuestionResult> results;
  final VoidCallback onContinue;
  final String continueLabel;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final totalPoints = results.fold(0, (sum, r) => sum + r.points);
    final correct = results.where((r) => r.wasCorrect).length;
    final categoryAccent = CategoryColors.getColor(category);

    return Scaffold(
      backgroundColor: AppColors.surfacePrimary,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.md),
              _buildHeader(l, correct, totalPoints, categoryAccent),
              const SizedBox(height: AppSpacing.xl),
              _buildBreakdown(l),
              const Spacer(),
              ElevatedButton(
                onPressed: () {
                  HapticsService().success();
                  AudioService().play('whoosh');
                  onContinue();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.surfacePrimary,
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                ),
                child: Text(
                  continueLabel,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(
    AppLocalizations l,
    int correct,
    int totalPoints,
    Color categoryAccent,
  ) {
    return Column(
      children: [
        Text(
          l.roundResultTitle,
          style: const TextStyle(color: Colors.white70, fontSize: 16, letterSpacing: 1.2),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          Categories.labelFor(l, category),
          style: TextStyle(color: categoryAccent, fontSize: 20, fontWeight: FontWeight.w600),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          '$totalPoints',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 72,
            fontWeight: FontWeight.bold,
            height: 1.0,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l.roundResultScore(correct, results.length),
          style: const TextStyle(color: Colors.white70, fontSize: 16),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildBreakdown(AppLocalizations l) {
    return Column(
      children: results.asMap().entries.map((entry) {
        final i = entry.key;
        final r = entry.value;
        final icon = r.wasCorrect ? '✓' : '✗';
        final iconColor = r.wasCorrect ? Colors.greenAccent : Colors.redAccent;

        return Container(
          margin: const EdgeInsets.only(bottom: AppSpacing.md),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(26),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            children: [
              Text(
                icon,
                style: TextStyle(color: iconColor, fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  l.roundResultQuestionLine(i + 1, _diffLabel(l, r.difficulty)),
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
              ),
              Text(
                r.wasCorrect ? '+${r.points}' : '0',
                style: TextStyle(
                  color: r.wasCorrect ? Colors.white : Colors.white38,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  static String _diffLabel(AppLocalizations l, String d) => switch (d) {
        'easy' => l.difficultyEasy,
        'medium' => l.difficultyMedium,
        'hard' => l.difficultyHard,
        _ => d,
      };
}
