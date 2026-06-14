import 'dart:async';
import 'dart:math';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

// Walking skeleton (Phase 1): one question from the server, tap an answer,
// get correctIx + points back. No match state, no real timer enforcement —
// server clock is authoritative (doc 06 §4); the countdown here is display-only.
class QuestionScreen extends StatefulWidget {
  const QuestionScreen({super.key});

  @override
  State<QuestionScreen> createState() => _QuestionScreenState();
}

class _QuestionScreenState extends State<QuestionScreen> {
  // ---- state ----
  bool _loading = true;
  String? _error;

  String? _matchId;
  String? _text;
  List<String> _answers = [];
  int _timeLimitMs = 10000;

  int? _selectedIx;
  int? _correctIx;
  int? _points;

  // Visual-only countdown (server timing is authoritative).
  late DateTime _servedAt;
  Timer? _ticker;
  double _timerFraction = 1.0; // 1.0 = full, 0.0 = expired

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      // Anonymous sign-in (guest-first per doc 05 §1).
      final auth = FirebaseAuth.instance;
      if (auth.currentUser == null) {
        await auth.signInAnonymously();
      }

      final fn = FirebaseFunctions.instanceFor(region: 'me-west1');
      final result = await fn.httpsCallable('v1_serveQuestion').call<Map>({});
      final data = result.data as Map;
      final serving = data['serving'] as Map;

      setState(() {
        _matchId = data['matchId'] as String;
        _text = serving['text'] as String;
        _answers = List<String>.from(serving['answers'] as List);
        _timeLimitMs = (serving['timeLimitMs'] as num).toInt();
        _loading = false;
        _servedAt = DateTime.now();
      });
      _startVisualTimer();
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _startVisualTimer() {
    _ticker = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (!mounted) return;
      final elapsed = DateTime.now().difference(_servedAt).inMilliseconds;
      final fraction = 1.0 - (elapsed / _timeLimitMs).clamp(0.0, 1.0);
      setState(() => _timerFraction = fraction);
      if (fraction <= 0) {
        _ticker?.cancel();
        if (_selectedIx == null) _submitAnswer(null); // visual timeout
      }
    });
  }

  Future<void> _submitAnswer(int? answerIx) async {
    if (_selectedIx != null || _matchId == null) return;
    _ticker?.cancel();
    setState(() => _selectedIx = answerIx ?? -1);

    try {
      final fn = FirebaseFunctions.instanceFor(region: 'me-west1');
      final result = await fn.httpsCallable('v1_submitAnswer').call<Map>({
        'matchId': _matchId,
        'roundIx': 0,
        'qIx': 0,
        'answerIx': answerIx,
        'idempotencyKey': _uuid(),
      });
      final data = result.data as Map;
      setState(() {
        _correctIx = (data['correctIx'] as num).toInt();
        _points = (data['points'] as num).toInt();
      });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF6C63FF),
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: const Color(0xFF6C63FF),
        body: Center(
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
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _loading = true;
                      _error = null;
                      _selectedIx = null;
                      _correctIx = null;
                      _points = null;
                    });
                    _load();
                  },
                  child: const Text('נסה שוב'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF6C63FF),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildTimer(),
              const SizedBox(height: 24),
              _buildQuestion(),
              const SizedBox(height: 32),
              ..._buildAnswers(),
              if (_correctIx != null) ...[
                const SizedBox(height: 32),
                _buildResult(),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _loading = true;
                      _error = null;
                      _selectedIx = null;
                      _correctIx = null;
                      _points = null;
                    });
                    _load();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF6C63FF),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('שאלה הבאה', style: TextStyle(fontSize: 16)),
                ),
              ],
            ],
          ),
        ),
      ),
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
        _text ?? '',
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
          fg = Colors.white;
        } else if (i == _selectedIx) {
          bg = Colors.red.shade600;
          fg = Colors.white;
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
    return Column(
      children: [
        Text(
          correct ? '✓ נכון!' : '✗ טעות',
          style: TextStyle(
            color: correct ? Colors.greenAccent : Colors.redAccent,
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '+$_points נקודות',
          style: const TextStyle(color: Colors.white, fontSize: 20),
        ),
      ],
    );
  }

  // Minimal UUID v4 generator — avoids adding a package dependency.
  String _uuid() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex =
        bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20, 32)}';
  }
}
