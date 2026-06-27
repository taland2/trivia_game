import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/seed_friends.dart';
import '../../l10n/app_localizations.dart';
import '../../models/match_list_entry.dart';
import '../../router/routes.dart';
import '../../state/social_providers.dart';
import '../../theme/tokens.dart';

/// A single match row on Home. Resolves the opponent's display name from the live
/// friends graph (Phase 8a — you duel friends, whose `users/{uid}` is readable),
/// falling back to the dev seed roster then the raw uid. Tapping a your-turn match
/// opens the full-screen match flow.
class MatchCard extends ConsumerWidget {
  const MatchCard({super.key, required this.entry});

  final MatchListEntry entry;

  void _open(BuildContext context) {
    context.push(Routes.match(entry.matchId), extra: entry.categoryMode);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final friendName =
        ref.watch(friendProfileProvider(entry.opponentUid)).valueOrNull?.displayName;
    final name = (friendName != null && friendName.isNotEmpty)
        ? friendName
        : (seedFriendName(entry.opponentUid) ?? entry.opponentUid);
    final canPlay = entry.isPendingTurn;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      child: ListTile(
        onTap: canPlay ? () => _open(context) : null,
        leading: CircleAvatar(child: Text(name.characters.first)),
        title: Text(l.matchVsOpponent(name)),
        subtitle: Text(
          canPlay ? l.homeYourTurn : l.homeWaitingForOpponent,
          style: TextStyle(
            color: canPlay ? theme.colorScheme.primary : AppColors.textSecondary,
            fontWeight: canPlay ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        trailing: canPlay
            ? Icon(Icons.play_arrow, color: theme.colorScheme.primary)
            : const Icon(Icons.hourglass_empty, color: AppColors.textSecondary),
      ),
    );
  }
}
