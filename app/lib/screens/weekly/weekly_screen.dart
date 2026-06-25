import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/leaderboard.dart';
import '../../router/routes.dart';
import '../../state/auth_providers.dart';
import '../../state/weekly_providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/async_value_view.dart';
import '../../widgets/empty_state.dart';
import 'podium_screen.dart';

/// Weekly friends leaderboard (GDD §7, doc 04 §3). Reads the single owner-readable
/// `weekly/{weekId}/boards/{uid}` projection (it already embeds friends' rows) and
/// renders the race: a top-3 podium strip then the full ranked list, the viewer's
/// own row highlighted. A near-empty friend graph (the common early state) shows
/// the invite-to-race empty hero. The board is function-written — read-only here.
class WeeklyScreen extends ConsumerWidget {
  const WeeklyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final board = ref.watch(weeklyBoardProvider);
    final uid = ref.watch(currentUidProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l.weeklyTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.emoji_events_outlined),
            tooltip: l.weeklyPodiumTitle,
            onPressed: () {
              final rows = board.valueOrNull?.rows ?? const [];
              if (rows.isEmpty) return;
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => PodiumScreen(rows: rows, meUid: uid),
              ));
            },
          ),
        ],
      ),
      body: AsyncValueView<WeeklyBoard?>(
        value: board,
        onRetry: () => ref.invalidate(weeklyBoardProvider),
        // Solo (only your own row, or no board yet) reads as "race not started".
        isEmpty: (b) => b == null || b.rows.length <= 1,
        emptyBuilder: (context) => EmptyState(
          icon: Icons.emoji_events_outlined,
          title: l.weeklyEmptyTitle,
          body: l.weeklyEmptyBody,
          ctaLabel: l.weeklyEmptyCta,
          onCta: () => context.go(Routes.play),
        ),
        data: (b) => _BoardList(rows: b!.rows, meUid: uid),
      ),
    );
  }
}

class _BoardList extends StatelessWidget {
  const _BoardList({required this.rows, required this.meUid});
  final List<LeaderboardRow> rows;
  final String? meUid;

  @override
  Widget build(BuildContext context) {
    final podium = rows.take(3).toList();
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        PodiumStrip(rows: podium, meUid: meUid),
        const SizedBox(height: AppSpacing.lg),
        ...rows.map((r) => _RankTile(row: r, isMe: r.uid == meUid)),
      ],
    );
  }
}

/// Compact top-3 visual reused on the weekly screen (the full celebration lives in
/// [PodiumScreen]). Centre pedestal (rank 1) is tallest.
class PodiumStrip extends StatelessWidget {
  const PodiumStrip({super.key, required this.rows, required this.meUid});
  final List<LeaderboardRow> rows;
  final String? meUid;

  static const _medals = ['🥇', '🥈', '🥉'];

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    // Render order: 2nd, 1st, 3rd so #1 sits centre.
    final order = <int>[if (rows.length > 1) 1, 0, if (rows.length > 2) 2];
    final heights = {0: 96.0, 1: 72.0, 2: 56.0};
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final i in order)
          Expanded(
            child: _Pedestal(
              row: rows[i],
              medal: _medals[i],
              height: heights[i]!,
              isMe: rows[i].uid == meUid,
            ),
          ),
      ],
    );
  }
}

class _Pedestal extends StatelessWidget {
  const _Pedestal({
    required this.row,
    required this.medal,
    required this.height,
    required this.isMe,
  });
  final LeaderboardRow row;
  final String medal;
  final double height;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(medal, style: const TextStyle(fontSize: 28)),
          const SizedBox(height: AppSpacing.xs),
          _Avatar(name: row.name, highlight: isMe),
          const SizedBox(height: AppSpacing.xs),
          Text(
            row.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: isMe ? FontWeight.bold : FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            height: height,
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withAlpha(isMe ? 89 : 46),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.sm)),
            ),
            alignment: Alignment.topCenter,
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              l.weeklyPointsLabel(row.points),
              style: theme.textTheme.labelSmall
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}

class _RankTile extends StatelessWidget {
  const _RankTile({required this.row, required this.isMe});
  final LeaderboardRow row;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      color: isMe ? theme.colorScheme.primaryContainer : null,
      child: ListTile(
        leading: SizedBox(
          width: 28,
          child: Text(
            '${row.rank}',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(
          row.name,
          style: TextStyle(fontWeight: isMe ? FontWeight.bold : FontWeight.w500),
        ),
        subtitle: Text(l.weeklyLevelLabel(row.level)),
        trailing: Text(
          l.weeklyPointsLabel(row.points),
          style: theme.textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

/// Initial-circle stand-in until the real avatar set lands (Phase 8).
class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.highlight = false});
  final String name;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return CircleAvatar(
      radius: 20,
      backgroundColor: highlight
          ? theme.colorScheme.primary
          : theme.colorScheme.primary.withAlpha(64),
      child: Text(
        initial,
        style: TextStyle(
          color: highlight ? Colors.white : theme.colorScheme.primary,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
