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
    );
    final hard = roundResultFrom(
      {'difficulty': 'hard', 'qIx': 1, 'text': 'y', 'answers': [], 'timeLimitMs': 20000},
      0,
    );

    // Both are wrong with 0 points (value-identical), but different difficulties.
    expect(easy.points, hard.points);
    expect(easy.wasCorrect, hard.wasCorrect);
    expect(easy.difficulty, 'easy');
    expect(hard.difficulty, 'hard');
  });

  test('points > 0 marks the answer correct', () {
    final correct = roundResultFrom({'difficulty': 'medium'}, 75);
    final wrong = roundResultFrom({'difficulty': 'medium'}, 0);

    expect(correct.wasCorrect, true);
    expect(wrong.wasCorrect, false);
  });
}
