import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/round_result.dart';
import '../../router/routes.dart';
import '../../services/audio_service.dart';
import '../../services/haptics_service.dart';
import '../../theme/tokens.dart';
import '../../widgets/emote_strip.dart';
import 'match_controller.dart';

/// Match-result celebration (doc 04 §3.7). Rendered from the server `MatchResult`
/// projection: who won, the final rounds score, and the weekly points granted
/// (GDD §7). Offers a rematch (a fresh `v1_acceptRematch` match) and a share.
class MatchResultScreen extends ConsumerStatefulWidget {
  const MatchResultScreen({
    super.key,
    required this.matchId,
    required this.meUid,
    required this.result,
  });

  final String matchId;
  final String? meUid;
  final MatchResult result;

  @override
  ConsumerState<MatchResultScreen> createState() => _MatchResultScreenState();
}

class _MatchResultScreenState extends ConsumerState<MatchResultScreen> {
  bool _rematching = false;

  String get _me => widget.meUid ?? widget.result.finalScore.keys.first;
  bool get _iWon => widget.result.winner == _me;

  @override
  void initState() {
    super.initState();
    // Celebrate on entry. HapticsService / AudioService respect their settings.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_iWon) {
        HapticsService().heavy();
        AudioService().play('fanfare');
      }
    });
  }

  Future<void> _rematch() async {
    if (_rematching) return;
    setState(() => _rematching = true);
    try {
      final newId =
          await ref.read(matchApiProvider).acceptRematch(matchId: widget.matchId);
      if (mounted) context.go(Routes.match(newId));
    } catch (_) {
      if (mounted) {
        setState(() => _rematching = false);
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(AppLocalizations.of(context).commonError)));
      }
    }
  }

  void _share() {
    final l = AppLocalizations.of(context);
    final them = widget.result.finalScore.keys.firstWhere((k) => k != _me, orElse: () => _me);
    final mine = widget.result.finalScore[_me] ?? 0;
    final theirs = widget.result.finalScore[them] ?? 0;
    // No third-party share dep yet (Phase 9/12); copy a shareable line to the
    // clipboard so the action is real and dependency-free.
    Clipboard.setData(ClipboardData(text: l.matchResultShareText(mine, theirs)));
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l.matchResultShareCopied)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final them = widget.result.finalScore.keys.firstWhere((k) => k != _me, orElse: () => _me);
    final mine = widget.result.finalScore[_me] ?? 0;
    final theirs = widget.result.finalScore[them] ?? 0;
    final weekly = widget.result.weeklyPointsAwarded[_me] ?? 0;

    Widget trophy = Text(
      _iWon ? '🏆' : '🤝',
      style: const TextStyle(fontSize: 96),
    );
    if (!reduceMotion) {
      trophy = trophy.animate().scale(
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
              const Spacer(),
              Center(child: trophy),
              const SizedBox(height: AppSpacing.md),
              Text(
                _iWon ? l.matchResultWin : l.matchResultLoss,
                style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '$mine – $theirs',
                style: const TextStyle(color: Colors.white70, fontSize: 24, fontWeight: FontWeight.w600),
                textAlign: TextAlign.center,
              ),
              if (weekly > 0) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  l.matchResultWeeklyPoints(weekly),
                  style: const TextStyle(color: AppColors.success, fontSize: 18, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
              ],
              const Spacer(),
              EmoteStrip(matchId: widget.matchId, meUid: widget.meUid),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: _rematching ? null : _rematch,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.surfacePrimary,
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
                ),
                child: _rematching
                    ? const SizedBox(
                        height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l.matchResultRematch,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: _share,
                      child: Text(l.matchResultShare, style: const TextStyle(color: Colors.white)),
                    ),
                  ),
                  Expanded(
                    child: TextButton(
                      onPressed: () => context.go(Routes.home),
                      child: Text(l.roundResultBackHome, style: const TextStyle(color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
