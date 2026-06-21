import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../widgets/empty_state.dart';

/// Friends tab placeholder. The weekly leaderboard, friends list, and add-friend
/// flows land in Phase 8.
class FriendsScreen extends StatelessWidget {
  const FriendsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.friendsTitle)),
      body: EmptyState(
        icon: Icons.people_outline,
        title: l.friendsTitle,
        body: l.friendsComingSoon,
      ),
    );
  }
}
