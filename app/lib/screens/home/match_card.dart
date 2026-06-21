import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/seed_friends.dart';
import '../../l10n/app_localizations.dart';
import '../../models/match_list_entry.dart';
import '../../router/routes.dart';
import '../../theme/tokens.dart';

/// A single match row on Home. Resolves the opponent's display name from the
/// seed roster (real profiles arrive in Phase 8). Tapping a your-turn match opens
/// the full-screen match flow.
class MatchCard extends StatelessWidget {
  const MatchCard({super.key, required this.entry});

  final MatchListEntry entry;

  void _open(BuildContext context) {
    context.push(Routes.match(entry.matchId), extra: entry.categoryMode);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final name = seedFriendName(entry.opponentUid) ?? entry.opponentUid;
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
