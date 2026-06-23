import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/round_screen.dart';

// Regression for the indexOf bug: two questions whose results are value-identical
// (same points/wasCorrect) must still carry their own difficulty. The old code
// used _results.indexOf(r) on Dart records, which returned the first match for
// both, mislabelling later questions.

void main() {
  test('value-identical results keep their own difficulty', () {
    final easy = roundResultFrom(
      {'difficulty': 'easy', 'qIx': 0, 'text': 'x', 'answers': [], 'timeLimitMs': 10000},
      0,
      false,
    );
    final hard = roundResultFrom(
      {'difficulty': 'hard', 'qIx': 1, 'text': 'y', 'answers': [], 'timeLimitMs': 20000},
      0,
      false,
    );

    // Both are wrong with 0 points (value-identical), but different difficulties.
    expect(easy.points, hard.points);
    expect(easy.wasCorrect, hard.wasCorrect);
    expect(easy.difficulty, 'easy');
    expect(hard.difficulty, 'hard');
  });

  test('carries the server-provided wasCorrect (no points > 0 heuristic)', () {
    // wasCorrect now comes from the server outcome, not derived from points.
    final correct = roundResultFrom({'difficulty': 'medium'}, 75, true);
    final wrong = roundResultFrom({'difficulty': 'medium'}, 0, false);

    expect(correct.wasCorrect, true);
    expect(wrong.wasCorrect, false);
  });
}
