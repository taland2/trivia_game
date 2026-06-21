import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../state/auth_providers.dart';
import '../../theme/tokens.dart';

/// Profile tab skeleton. Level/XP, match history, and the full settings screen
/// (language switch, sound/haptics toggles) land in Phase 6b.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final uid = ref.watch(currentUidProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.profileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person)),
            title: Text(l.profileGuest),
            subtitle: uid == null ? null : Text(uid),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: Text(l.profileSettings),
            subtitle: Text(l.profileComingSoon),
            enabled: false,
          ),
        ],
      ),
    );
  }
}
