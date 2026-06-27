import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router/routes.dart';
import '../../state/user_profile_provider.dart';
import '../../theme/tokens.dart';

/// Profile tab: level ring + XP bar (read from the server-written `users/{uid}`
/// economy fields) and an entry into Settings. Match history is a Phase-7
/// placeholder (it lands with the weekly/daily UI).
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final profile = ref.watch(userProfileProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.profileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          _LevelHeader(profile: profile.valueOrNull, l: l),
          const SizedBox(height: AppSpacing.lg),
          ListTile(
            leading: const Icon(Icons.edit_outlined),
            title: Text(l.editProfileTitle),
            subtitle: profile.valueOrNull?.username != null
                ? Text('@${profile.valueOrNull!.username}')
                : null,
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('${Routes.profile}/${Routes.editProfile}'),
          ),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: Text(l.profileSettings),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.go('${Routes.profile}/${Routes.settings}'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.history),
            title: Text(l.profileMatchHistory),
            subtitle: Text(l.profileComingSoon),
            enabled: false,
          ),
        ],
      ),
    );
  }
}

class _LevelHeader extends StatelessWidget {
  const _LevelHeader({required this.profile, required this.l});
  final UserProfile? profile;
  final AppLocalizations l;

  @override
  Widget build(BuildContext context) {
    final level = profile?.level ?? 1;
    final xp = profile?.xp ?? 0;
    final progress = profile?.levelProgress ?? 0;
    final name = profile?.displayName ?? l.profileGuest;
    final theme = Theme.of(context);

    return Column(
      children: [
        // Level ring: a circular progress to the next level wrapping the avatar.
        SizedBox(
          width: 96,
          height: 96,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 96,
                height: 96,
                child: CircularProgressIndicator(
                  value: progress,
                  strokeWidth: 6,
                  backgroundColor: theme.colorScheme.primary.withAlpha(40),
                ),
              ),
              CircleAvatar(
                radius: 36,
                child: Text(
                  '$level',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(name, style: theme.textTheme.titleLarge),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l.profileLevelXp(level, xp),
          style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
