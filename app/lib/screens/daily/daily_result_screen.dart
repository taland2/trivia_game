import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../models/leaderboard.dart';
import '../../round_result_screen.dart' show RoundQuestionResult;
import '../../services/audio_service.dart';
import '../../services/haptics_service.dart';
import '../../state/weekly_providers.dart';
import '../../theme/tokens.dart';

/// Daily-challenge result (GDD §5, doc 04 §3): final score, accuracy, the streak
/// flame, weekly points earned, a spoiler-free share, then back Home. Built from
/// the server `dailyResult` + streak — no client re-derivation.
class DailyResultScreen extends StatefulWidget {
  const DailyResultScreen({
    super.key,
    required this.results,
    required this.score,
    required this.correctCount,
    required this.streakCount,
    required this.weeklyPoints,
    required this.onContinue,
    this.dayId,
  });

  final List<RoundQuestionResult> results;
  final int score;
  final int correctCount;
  final int streakCount;
  final int weeklyPoints;
  final VoidCallback onContinue;

  /// Today's dayId — drives the friends-today board (post-play, GDD §5). Null in
  /// tests/contexts that don't surface the board.
  final String? dayId;

  @override
  State<DailyResultScreen> createState() => _DailyResultScreenState();
}

class _DailyResultScreenState extends State<DailyResultScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      HapticsService().success();
      AudioService().play('fanfare');
    });
  }

  void _share() {
    final l = AppLocalizations.of(context);
    // Anti-spoiler (GDD §5): the share NEVER includes question content.
    Clipboard.setData(ClipboardData(text: l.dailyShareText(widget.score)));
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l.matchResultShareCopied)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    Widget flame = Text(
      widget.streakCount > 0 ? '🔥' : '🎯',
      style: const TextStyle(fontSize: 80),
    );
    if (!reduceMotion) {
      flame = flame.animate().scale(
            begin: const Offset(0.4, 0.4),
            end: const Offset(1, 1),
            duration: AppDurations.slow,
            curve: Curves.elasticOut,
          );
    }

    return Scaffold(
      backgroundColor: AppColors.surfacePrimary,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.md),
              Center(child: flame),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l.dailyResultTitle,
                style: const TextStyle(color: Colors.white70, fontSize: 16, letterSpacing: 1.2),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                '${widget.score}',
                style: const TextStyle(
                  color: Colors.white, fontSize: 64, fontWeight: FontWeight.bold, height: 1.0,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l.roundResultScore(widget.correctCount, widget.results.length),
                style: const TextStyle(color: Colors.white70, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              if (widget.streakCount > 0) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l.dailyResultStreak(widget.streakCount),
                  style: const TextStyle(
                    color: Colors.orangeAccent, fontSize: 18, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
              ],
              if (widget.weeklyPoints > 0) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l.matchResultWeeklyPoints(widget.weeklyPoints),
                  style: const TextStyle(
                    color: AppColors.success, fontSize: 16, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Expanded(child: _Breakdown(results: widget.results)),
              if (widget.dayId != null) _FriendsTodayBoard(dayId: widget.dayId!),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: _share,
                      child: Text(l.matchResultShare, style: const TextStyle(color: Colors.white)),
                    ),
                  ),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: widget.onContinue,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.surfacePrimary,
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.lg)),
                      ),
                      child: Text(l.roundResultBackHome,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}

/// Friends-today board (GDD §7, doc 07 §2.4): how the viewer's friends did on
/// today's daily, shown only AFTER the viewer has played (this screen is reached
/// post-play, and the rules gate friend reads on the viewer's own `finishedAt` —
/// anti-spoiler, GDD §5). Reads `daily/{dayId}/friendScores/*` (no question
/// content). A thin/empty friend graph just collapses to an empty line.
class _FriendsTodayBoard extends ConsumerWidget {
  const _FriendsTodayBoard({required this.dayId});
  final String dayId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final scores = ref.watch(dailyFriendsBoardProvider(dayId));
    final rows = scores.valueOrNull ?? const <FriendScore>[];
    // Hide entirely while loading or on error — it's a secondary, best-effort
    // section and must never block the result screen.
    if (scores.isLoading || rows.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.friendsTodayTitle,
            style: const TextStyle(
                color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...rows.take(5).toList().asMap().entries.map((e) {
            final i = e.key;
            final s = e.value;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  SizedBox(
                    width: 22,
                    child: Text('${i + 1}',
                        style: const TextStyle(
                            color: Colors.white54, fontWeight: FontWeight.bold)),
                  ),
                  Expanded(
                    child: Text(
                      s.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                  Text('${s.score}',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _Breakdown extends StatelessWidget {
  const _Breakdown({required this.results});
  final List<RoundQuestionResult> results;

  static String _diffLabel(AppLocalizations l, String d) => switch (d) {
        'easy' => l.difficultyEasy,
        'medium' => l.difficultyMedium,
        'hard' => l.difficultyHard,
        _ => d,
      };

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return ListView(
      children: results.asMap().entries.map((entry) {
        final i = entry.key;
        final r = entry.value;
        return Container(
          margin: const EdgeInsets.only(bottom: AppSpacing.sm),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: AppSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(26),
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Row(
            children: [
              Text(
                r.wasCorrect ? '✓' : '✗',
                style: TextStyle(
                  color: r.wasCorrect ? Colors.greenAccent : Colors.redAccent,
                  fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l.roundResultQuestionLine(i + 1, _diffLabel(l, r.difficulty)),
                  style: const TextStyle(color: Colors.white, fontSize: 15),
                ),
              ),
              Text(
                r.wasCorrect ? '+${r.points}' : '0',
                style: TextStyle(
                  color: r.wasCorrect ? Colors.white : Colors.white38,
                  fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
