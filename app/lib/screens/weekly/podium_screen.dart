import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../l10n/app_localizations.dart';
import '../../models/leaderboard.dart';
import '../../services/audio_service.dart';
import '../../services/haptics_service.dart';
import '../../theme/tokens.dart';

/// Top-3 celebration (GDD §7, doc 04 §3). Reuses the Phase-5 juice (staggered
/// entrance + fanfare), reduced-motion aware. Pushed from the weekly screen and
/// shown on the week-rollover moment; renders straight from the board rows (no
/// re-derivation). The medals are the same set as the weekly podium strip.
class PodiumScreen extends StatefulWidget {
  const PodiumScreen({super.key, required this.rows, this.meUid});

  final List<LeaderboardRow> rows;
  final String? meUid;

  @override
  State<PodiumScreen> createState() => _PodiumScreenState();
}

class _PodiumScreenState extends State<PodiumScreen> {
  static const _medals = ['🥇', '🥈', '🥉'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      HapticsService().success();
      AudioService().play('fanfare');
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final top = widget.rows.take(3).toList();
    // Display order 2nd · 1st · 3rd so the winner sits centre and tallest.
    final order = <int>[if (top.length > 1) 1, 0, if (top.length > 2) 2];
    final heights = {0: 180.0, 1: 130.0, 2: 100.0};

    return Scaffold(
      backgroundColor: AppColors.surfacePrimary,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: AppSpacing.lg),
            Text(
              l.weeklyPodiumTitle,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.5,
              ),
            ),
            const Spacer(),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var k = 0; k < order.length; k++)
                  Expanded(
                    child: _buildPedestal(
                      context,
                      row: top[order[k]],
                      medal: _medals[order[k]],
                      height: heights[order[k]]!,
                      delayMs: k * 180,
                      reduceMotion: reduceMotion,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.surfacePrimary,
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                  ),
                  child: Text(
                    l.roundResultBackHome,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPedestal(
    BuildContext context, {
    required LeaderboardRow row,
    required String medal,
    required double height,
    required int delayMs,
    required bool reduceMotion,
  }) {
    final l = AppLocalizations.of(context);
    final isMe = row.uid == widget.meUid;
    final initial =
        row.name.trim().isEmpty ? '?' : row.name.trim()[0].toUpperCase();

    Widget pedestal = Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(medal, style: const TextStyle(fontSize: 36)),
          const SizedBox(height: AppSpacing.xs),
          CircleAvatar(
            radius: 26,
            backgroundColor:
                isMe ? Colors.white : Colors.white.withAlpha(89),
            child: Text(
              initial,
              style: TextStyle(
                color: isMe ? AppColors.surfacePrimary : Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 20,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            row.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white,
              fontWeight: isMe ? FontWeight.bold : FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            height: height,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(isMe ? 77 : 38),
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadius.md)),
            ),
            alignment: Alignment.topCenter,
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              l.weeklyPointsLabel(row.points),
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (reduceMotion) return pedestal;
    return pedestal
        .animate()
        .fadeIn(delay: Duration(milliseconds: delayMs), duration: AppDurations.normal)
        .slideY(begin: 0.4, end: 0, curve: Curves.easeOutBack);
  }
}
