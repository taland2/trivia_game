import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/seed_friends.dart';
import '../../l10n/app_localizations.dart';
import '../../router/routes.dart';
import '../../theme/tokens.dart';

/// Pick an opponent for a new duel. For now the roster is the dev seed friends
/// (real friends + invite flow arrive in Phase 8). Selecting one advances to the
/// category-mode picker, carrying the friend as route `extra`.
class FriendPickerScreen extends StatelessWidget {
  const FriendPickerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.friendPickerTitle)),
      body: kSeedFriends.isEmpty
          ? Center(child: Text(l.friendPickerEmpty))
          : ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: kSeedFriends.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, i) {
                final friend = kSeedFriends[i];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Text(friend.displayName.characters.first),
                    ),
                    title: Text(friend.displayName),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.pushNamed(
                      Routes.nameCategoryMode,
                      extra: friend,
                    ),
                  ),
                );
              },
            ),
    );
  }
}
