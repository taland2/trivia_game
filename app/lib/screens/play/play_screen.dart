import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router/routes.dart';
import '../../theme/tokens.dart';

/// Play tab: entry to the duel-creation flow. Daily challenge + live modes are
/// later phases; for now the one action is "start a duel".
class PlayScreen extends StatelessWidget {
  const PlayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.playTitle)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.sports_kabaddi,
                  size: 72, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: AppSpacing.lg),
              Text(l.playStartDuelSubtitle,
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.xl),
              FilledButton.icon(
                onPressed: () => context.push('${Routes.play}/${Routes.friendPicker}'),
                icon: const Icon(Icons.add),
                label: Text(l.playStartDuel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
