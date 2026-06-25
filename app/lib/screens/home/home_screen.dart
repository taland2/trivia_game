import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/match_list_entry.dart';
import '../../router/routes.dart';
import '../../state/auth_providers.dart';
import '../../state/daily_providers.dart';
import '../../state/match_list_providers.dart';
import '../../state/user_profile_provider.dart';
import '../../state/weekly_providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/async_value_view.dart';
import '../../widgets/empty_state.dart';
import 'match_card.dart';

/// Home tab: the player's active matches (pending turns first), plus Daily and
/// Weekly cards as Phase-7 placeholders. Empty → invite-to-play hero.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final matches = ref.watch(activeMatchesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.homeTitle)),
      body: AsyncValueView<List<MatchListEntry>>(
        value: matches,
        onRetry: () => ref.invalidate(matchListStreamProvider),
        isEmpty: (list) => list.isEmpty,
        emptyBuilder: (context) => EmptyState(
          icon: Icons.sports_esports_outlined,
          title: l.homeEmptyTitle,
          body: l.homeEmptyBody,
          ctaLabel: l.homeEmptyCta,
          onCta: () => context.go(Routes.play),
        ),
        data: (list) => _HomeBody(matches: list),
      ),
    );
  }
}

class _HomeBody extends StatelessWidget {
  const _HomeBody({required this.matches});
  final List<MatchListEntry> matches;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    // `matches` arrives already ordered pending-first then by recency
    // (activeMatchesProvider), so it's rendered as-is.
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        const _DailyChallengeCard(),
        const SizedBox(height: AppSpacing.md),
        const _WeeklyRaceCard(),
        const SizedBox(height: AppSpacing.lg),
        Text(l.homePendingTurns, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        ...matches.map((m) => MatchCard(entry: m)),
      ],
    );
  }
}

/// Daily Challenge entry (GDD §5): shows today's state (play CTA or done + score)
/// and the current streak, and routes into the full-screen daily flow.
class _DailyChallengeCard extends ConsumerWidget {
  const _DailyChallengeCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final today = ref.watch(dailyTodayProvider).valueOrNull ?? DailyToday.none;
    final streak = ref.watch(userProfileProvider).valueOrNull?.streakCount ?? 0;

    final subtitle = today.played
        ? l.dailyCardDone(today.score)
        : l.dailyCardPlay;

    return Card(
      child: ListTile(
        leading: Icon(Icons.today, color: Theme.of(context).colorScheme.primary),
        title: Text(l.homeDailyCardTitle),
        subtitle: Text(subtitle),
        trailing: streak > 0
            ? Text('🔥 $streak', style: const TextStyle(fontSize: 16))
            : const Icon(Icons.chevron_right),
        onTap: () => context.push(Routes.daily),
      ),
    );
  }
}

/// Weekly Race entry (GDD §7): my rank this week (or a join prompt when the race
/// hasn't started / I have no friends yet), routing into the full leaderboard.
class _WeeklyRaceCard extends ConsumerWidget {
  const _WeeklyRaceCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final uid = ref.watch(currentUidProvider);
    final board = ref.watch(weeklyBoardProvider).valueOrNull;
    final myRank =
        uid == null ? null : board?.rowFor(uid)?.rank;
    // Only show a rank when there is an actual race (more than just me).
    final hasRace = board != null && board.rows.length > 1 && myRank != null;

    return Card(
      child: ListTile(
        leading: Icon(Icons.emoji_events_outlined,
            color: Theme.of(context).colorScheme.primary),
        title: Text(l.homeWeeklyCardTitle),
        subtitle: Text(hasRace ? l.homeWeeklyRank(myRank) : l.homeWeeklyJoin),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push(Routes.weekly),
      ),
    );
  }
}
