import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../state/auth_providers.dart';
import '../../state/firebase_providers.dart';
import '../../state/settings_providers.dart';
import '../../theme/tokens.dart';

/// Settings (doc 04 §3.10 / §5): language, sound, haptics. Sound + haptics are
/// device-local (settingsProvider). Language is local AND mirrored to the
/// whitelisted `users/{uid}.language` profile field (guardrail #1) so the
/// same-language duel rule (GDD §4.7) sees the player's real choice.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  Future<void> _setLanguage(WidgetRef ref, String code) async {
    await ref.read(settingsProvider.notifier).setLanguage(code);
    // Best-effort profile mirror — a transient failure must not block the toggle;
    // the next sign-in bootstrap re-ensures the doc.
    final uid = ref.read(currentUidProvider);
    if (uid == null) return;
    try {
      await ref.read(firestoreProvider).doc('users/$uid').set(
        {'language': code},
        SetOptions(merge: true),
      );
    } catch (_) {
      // Ignore; local preference still applied and RTL still flips live.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final settings = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          _SectionLabel(l.settingsLanguage),
          _LanguageTile(
            code: 'he',
            label: 'עברית',
            selected: settings.languageCode == 'he',
            onTap: () => _setLanguage(ref, 'he'),
          ),
          _LanguageTile(
            code: 'en',
            label: 'English',
            selected: settings.languageCode == 'en',
            onTap: () => _setLanguage(ref, 'en'),
          ),
          const Divider(),
          _SectionLabel(l.settingsFeedback),
          SwitchListTile(
            value: settings.soundEnabled,
            onChanged: (v) => ref.read(settingsProvider.notifier).setSoundEnabled(v),
            title: Text(l.settingsSound),
            secondary: const Icon(Icons.volume_up_outlined),
          ),
          SwitchListTile(
            value: settings.hapticsEnabled,
            onChanged: (v) => ref.read(settingsProvider.notifier).setHapticsEnabled(v),
            title: Text(l.settingsHaptics),
            secondary: const Icon(Icons.vibration_outlined),
          ),
        ],
      ),
    );
  }
}

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.code,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String code;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      onTap: onTap,
      trailing: selected
          ? Icon(Icons.check, color: Theme.of(context).colorScheme.primary)
          : null,
      selected: selected,
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.sm, AppSpacing.sm, AppSpacing.xs),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              letterSpacing: 1.0,
            ),
      ),
    );
  }
}
