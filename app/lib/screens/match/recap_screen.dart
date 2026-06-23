import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/categories.dart';
import '../../l10n/app_localizations.dart';
import '../../models/round_result.dart';
import '../../services/audio_service.dart';
import '../../services/haptics_service.dart';
import '../../theme/category_colors.dart';
import '../../theme/tokens.dart';
import '../../widgets/emote_strip.dart';

/// Round recap (doc 04 §3.3/§3.6): the round-by-round comparison shown to BOTH
/// players once both have finished. Rendered entirely from the server reveal
/// projection (`RoundResult`), never re-derived from local state (H7).
class RecapScreen extends ConsumerWidget {
  const RecapScreen({
    super.key,
    required this.matchId,
    required this.meUid,
    required this.result,
    required this.category,
    required this.onContinue,
  });

  final String matchId;
  final String? meUid;
  final RoundResult result;
  final String category;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    // meUid can be null only in a degraded offline session; fall back to the
    // first player so the comparison still renders deterministically.
    final me = meUid ?? result.players.first.uid;
    final mine = result.players.firstWhere(
      (p) => p.uid == me,
      orElse: () => result.players.first,
    );
    final theirs = result.players.firstWhere(
      (p) => p.uid != mine.uid,
      orElse: () => result.players.last,
    );
    final iWon = result.winner == mine.uid;
    final accent = CategoryColors.getColor(category);

    return Scaffold(
      backgroundColor: AppColors.surfacePrimary,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.sm),
              Text(
                l.recapTitle,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 16,
                  letterSpacing: 1.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                Categories.labelFor(l, category),
                style: TextStyle(color: accent, fontSize: 20, fontWeight: FontWeight.w600),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                iWon ? l.recapYouWonRound : l.recapOpponentWonRound,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              _ColumnHeaders(youLabel: l.recapYou, themLabel: l.recapOpponent),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: ListView(
                  children: [
                    for (var i = 0; i < mine.answers.length; i++)
                      _CompareRow(mine: mine.answers[i], theirs: theirs.answers[i]),
                    const SizedBox(height: AppSpacing.sm),
                    _ScoreRow(mineScore: mine.score, theirsScore: theirs.score),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              EmoteStrip(matchId: matchId, meUid: meUid),
              const SizedBox(height: AppSpacing.sm),
              _ContinueButton(label: l.roundResultBackHome, onContinue: onContinue),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}

class _ColumnHeaders extends StatelessWidget {
  const _ColumnHeaders({required this.youLabel, required this.themLabel});
  final String youLabel;
  final String themLabel;

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(color: Colors.white70, fontWeight: FontWeight.w600);
    return Row(
      children: [
        const SizedBox(width: 40),
        Expanded(child: Text(youLabel, style: style, textAlign: TextAlign.center)),
        Expanded(child: Text(themLabel, style: style, textAlign: TextAlign.center)),
      ],
    );
  }
}

class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.mine, required this.theirs});
  final RecapAnswer mine;
  final RecapAnswer theirs;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: AppSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(20),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          SizedBox(width: 40, child: Text('Q${mine.qIx + 1}',
              style: const TextStyle(color: Colors.white54, fontWeight: FontWeight.bold))),
          Expanded(child: _Cell(a: mine)),
          Expanded(child: _Cell(a: theirs)),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.a});
  final RecapAnswer a;

  @override
  Widget build(BuildContext context) {
    final icon = a.correct ? '✓' : '✗';
    final color = a.correct ? Colors.greenAccent : Colors.redAccent;
    return Column(
      children: [
        Text(icon, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(
          a.correct ? '+${a.points} · ${(a.ms / 1000).toStringAsFixed(1)}s' : '0',
          style: const TextStyle(color: Colors.white, fontSize: 13),
        ),
      ],
    );
  }
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({required this.mineScore, required this.theirsScore});
  final int mineScore;
  final int theirsScore;

  @override
  Widget build(BuildContext context) {
    TextStyle style(bool win) => TextStyle(
          color: win ? Colors.white : Colors.white70,
          fontSize: 22,
          fontWeight: FontWeight.bold,
        );
    return Row(
      children: [
        const SizedBox(width: 40),
        Expanded(
          child: Text('$mineScore',
              style: style(mineScore >= theirsScore), textAlign: TextAlign.center),
        ),
        Expanded(
          child: Text('$theirsScore',
              style: style(theirsScore >= mineScore), textAlign: TextAlign.center),
        ),
      ],
    );
  }
}

class _ContinueButton extends StatelessWidget {
  const _ContinueButton({required this.label, required this.onContinue});
  final String label;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () {
        HapticsService().success();
        AudioService().play('whoosh');
        onContinue();
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.surfacePrimary,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
      ),
      child: Text(label, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
    );
  }
}
