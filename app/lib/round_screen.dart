import 'dart:async';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'question_screen.dart';
import 'round_result_screen.dart';

// Orchestrates a full round: calls v1_startRound, shows 3 questions one at a time
// with 1.5s auto-advance after each answer, then navigates to RoundResultScreen.
class RoundScreen extends StatefulWidget {
  const RoundScreen({super.key});

  @override
  State<RoundScreen> createState() => _RoundScreenState();
}

class _RoundScreenState extends State<RoundScreen> {
  bool _loading = true;
  String? _error;

  String? _matchId;
  String? _category;
  List<Map<String, dynamic>> _servings = [];

  // Current question index (0–2). -1 = loading, 3 = round complete.
  int _currentQ = 0;

  // Per-question results accumulated by this screen.
  final List<({int correctIx, int points, bool wasCorrect})> _results = [];

  // Tracks whether we're in the 1.5s auto-advance pause.
  bool _advancing = false;

  @override
  void initState() {
    super.initState();
    _loadRound();
  }

  Future<void> _loadRound() async {
    setState(() {
      _loading = true;
      _error = null;
      _currentQ = 0;
      _results.clear();
      _advancing = false;
    });

    try {
      final auth = FirebaseAuth.instance;
      if (auth.currentUser == null) {
        await auth.signInAnonymously();
      }

      final fn = FirebaseFunctions.instanceFor(region: 'me-west1');
      final result = await fn.httpsCallable('v1_startRound').call<Map>({});
      final data = result.data;

      setState(() {
        _matchId = data['matchId'] as String;
        _category = data['category'] as String;
        _servings = (data['servings'] as List)
            .map((s) => Map<String, dynamic>.from(s as Map))
            .toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _onQuestionResult(int correctIx, int points, bool roundDone) {
    // The serving tracks which answer was tapped; we just need correctIx & points here.
    // QuestionScreen already shows ✓/✗; we collect results for the round summary.
    // We derive wasCorrect in the result screen from correctIx vs selectedIx — but
    // QuestionScreen owns selectedIx. So we ask: did they score > 0 AND it was correct?
    // Actually we just store correctIx + points and let RoundResultScreen display them.
    _results.add((correctIx: correctIx, points: points, wasCorrect: points > 0));

    if (_advancing) return;
    _advancing = true;

    // Auto-advance after 1.5s so the user can read the feedback.
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      _advancing = false;
      if (roundDone) {
        _navigateToResult();
      } else {
        setState(() => _currentQ++);
      }
    });
  }

  void _navigateToResult() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => RoundResultScreen(
          category: _category ?? '',
          results: _results
              .map((r) => RoundQuestionResult(
                    difficulty: _servings[_results.indexOf(r)]['difficulty'] as String,
                    points: r.points,
                    wasCorrect: r.wasCorrect,
                  ))
              .toList(),
          onPlayAgain: () {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const RoundScreen()),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF6C63FF),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

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
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadRound,
                child: const Text('נסה שוב'),
              ),
            ],
          ),
        ),
      );
    }

    if (_currentQ >= _servings.length) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    // Key on _currentQ forces a fresh widget (and fresh timer) for each question.
    return QuestionScreen(
      key: ValueKey(_currentQ),
      matchId: _matchId!,
      serving: _servings[_currentQ],
      questionNumber: _currentQ + 1,
      totalQuestions: _servings.length,
      onResult: _onQuestionResult,
    );
  }
}
