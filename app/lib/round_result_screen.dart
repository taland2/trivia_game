import 'package:flutter/material.dart';

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

// Displays the round summary: total score + per-question breakdown.
class RoundResultScreen extends StatelessWidget {
  const RoundResultScreen({
    super.key,
    required this.category,
    required this.results,
    required this.onPlayAgain,
  });

  final String category;
  final List<RoundQuestionResult> results;
  final VoidCallback onPlayAgain;

  @override
  Widget build(BuildContext context) {
    final totalPoints = results.fold(0, (sum, r) => sum + r.points);
    final correct = results.where((r) => r.wasCorrect).length;

    return Scaffold(
      backgroundColor: const Color(0xFF6C63FF),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              _buildHeader(correct, totalPoints),
              const SizedBox(height: 32),
              _buildBreakdown(),
              const Spacer(),
              ElevatedButton(
                onPressed: onPlayAgain,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'סבב חדש',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(int correct, int totalPoints) {
    final categoryLabel = _categoryLabel(category);
    return Column(
      children: [
        Text(
          'סיום סבב',
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 16,
            letterSpacing: 1.2,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          categoryLabel,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
          textDirection: TextDirection.rtl,
        ),
        const SizedBox(height: 24),
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
        const SizedBox(height: 4),
        Text(
          'נקודות · $correct/${results.length} נכון',
          style: const TextStyle(color: Colors.white70, fontSize: 16),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildBreakdown() {
    return Column(
      children: results.asMap().entries.map((entry) {
        final i = entry.key;
        final r = entry.value;
        final diffLabel = _diffLabel(r.difficulty);
        final icon = r.wasCorrect ? '✓' : '✗';
        final iconColor = r.wasCorrect ? Colors.greenAccent : Colors.redAccent;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(26),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Text(
                icon,
                style: TextStyle(
                  color: iconColor,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  'שאלה ${i + 1} — $diffLabel',
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                  textDirection: TextDirection.rtl,
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

  static String _diffLabel(String d) => switch (d) {
        'easy' => 'קל',
        'medium' => 'בינוני',
        'hard' => 'קשה',
        _ => d,
      };

  static String _categoryLabel(String c) => switch (c) {
        'general_knowledge' => 'ידע כללי',
        'sports' => 'ספורט',
        'movies_tv' => 'קולנוע וטלוויזיה',
        'music' => 'מוזיקה',
        'science_tech' => 'מדע וטכנולוגיה',
        'history' => 'היסטוריה',
        'geography' => 'גיאוגרפיה',
        'israel_local' => 'ישראל ומקומי',
        _ => c,
      };
}
