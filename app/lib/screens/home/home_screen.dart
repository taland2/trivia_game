import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/match_list_entry.dart';
import '../../router/routes.dart';
import '../../state/match_list_providers.dart';
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

/// Phase 7 placeholder.
class _DailyChallengeCard extends StatelessWidget {
  const _DailyChallengeCard();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return _PlaceholderCard(
      icon: Icons.today,
      title: l.homeDailyCardTitle,
      subtitle: l.homeDailyCardSoon,
    );
  }
}

/// Phase 7 placeholder.
class _WeeklyRaceCard extends StatelessWidget {
  const _WeeklyRaceCard();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return _PlaceholderCard(
      icon: Icons.emoji_events_outlined,
      title: l.homeWeeklyCardTitle,
      subtitle: l.homeWeeklyCardSoon,
    );
  }
}

class _PlaceholderCard extends StatelessWidget {
  const _PlaceholderCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
      ),
    );
  }
}
