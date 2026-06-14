import 'dart:async';
import 'dart:math';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

// A single question card: shows question text, 4 answers, a visual countdown,
// and calls v1_submitAnswer when the user taps or time runs out.
//
// The widget is stateless about round context — RoundScreen owns the serving
// list and wires the callbacks. QuestionScreen handles only one question at a time.
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

  // 1-based index shown to the user (e.g. "שאלה 2/3").
  final int questionNumber;
  final int totalQuestions;

  // Called with (correctIx, points, roundDone) after the server responds.
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

  // Visual-only countdown (server clock is authoritative per doc 06 §4).
  late DateTime _servedAt;
  Timer? _ticker;
  double _timerFraction = 1.0;

  @override
  void initState() {
    super.initState();
    final s = widget.serving;
    _qIx = (s['qIx'] as num).toInt();
    _text = s['text'] as String;
    _answers = List<String>.from(s['answers'] as List);
    _timeLimitMs = (s['timeLimitMs'] as num).toInt();
    _difficulty = s['difficulty'] as String;
    _servedAt = DateTime.now();
    _startVisualTimer();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _startVisualTimer() {
    _ticker = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (!mounted) return;
      final elapsed = DateTime.now().difference(_servedAt).inMilliseconds;
      final fraction = 1.0 - (elapsed / _timeLimitMs).clamp(0.0, 1.0);
      setState(() => _timerFraction = fraction);
      if (fraction <= 0) {
        _ticker?.cancel();
        if (_selectedIx == null) _submitAnswer(null);
      }
    });
  }

  Future<void> _submitAnswer(int? answerIx) async {
    if (_selectedIx != null) return;
    _ticker?.cancel();
    setState(() => _selectedIx = answerIx ?? -1);

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
      widget.onResult(correctIx, points, roundDone);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 48),
              const SizedBox(height: 16),
              Text(
                _error!,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(),
          const SizedBox(height: 12),
          _buildTimer(),
          const SizedBox(height: 24),
          _buildQuestion(),
          const SizedBox(height: 32),
          ..._buildAnswers(),
          if (_correctIx != null) ...[
            const SizedBox(height: 24),
            _buildResult(),
          ],
        ],
      ),
    );
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
          style: const TextStyle(color: Colors.white70, fontSize: 15),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(38),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            diffLabel,
            style: const TextStyle(color: Colors.white, fontSize: 13),
          ),
        ),
      ],
    );
  }

  Widget _buildTimer() {
    final color = _timerFraction > 0.5
        ? Colors.white
        : _timerFraction > 0.25
            ? Colors.yellow
            : Colors.red;
    return LinearProgressIndicator(
      value: _timerFraction,
      backgroundColor: Colors.white24,
      valueColor: AlwaysStoppedAnimation<Color>(color),
      minHeight: 6,
    );
  }

  Widget _buildQuestion() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(26),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        _text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 22,
          fontWeight: FontWeight.bold,
          height: 1.4,
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.rtl,
      ),
    );
  }

  List<Widget> _buildAnswers() {
    return List.generate(_answers.length, (i) {
      final answered = _correctIx != null;
      Color bg = Colors.white.withAlpha(38);
      Color fg = Colors.white;

      if (answered) {
        if (i == _correctIx) {
          bg = Colors.green.shade600;
        } else if (i == _selectedIx) {
          bg = Colors.red.shade600;
        } else {
          bg = Colors.white.withAlpha(20);
          fg = Colors.white54;
        }
      } else if (i == _selectedIx) {
        bg = Colors.white.withAlpha(77);
      }

      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: GestureDetector(
          onTap: answered || _selectedIx != null ? null : () => _submitAnswer(i),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white24),
            ),
            child: Text(
              _answers[i],
              style: TextStyle(color: fg, fontSize: 17),
              textAlign: TextAlign.center,
              textDirection: TextDirection.rtl,
            ),
          ),
        ),
      );
    });
  }

  Widget _buildResult() {
    final correct = _selectedIx == _correctIx;
    return Text(
      correct ? '✓  +$_points נקודות' : '✗  שגוי',
      style: TextStyle(
        color: correct ? Colors.greenAccent : Colors.redAccent,
        fontSize: 22,
        fontWeight: FontWeight.bold,
      ),
      textAlign: TextAlign.center,
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
