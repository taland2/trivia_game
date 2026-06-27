import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router/routes.dart';
import '../../services/social_service.dart';
import '../../state/auth_providers.dart';
import '../../state/firebase_providers.dart';
import '../../state/user_profile_provider.dart';
import '../../theme/tokens.dart';

/// Edit profile (doc 04 §3.10, Phase 8a): display name + avatar + the @username
/// claim + the search opt-in, plus account deletion. displayName/avatar/searchable
/// are client-direct whitelisted writes (guardrail #1); username goes through
/// v1_claimUsername; deletion through v1_deleteAccount.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _nameCtl = TextEditingController();
  final _userCtl = TextEditingController();
  int _avatarId = 1;
  bool _searchable = false;
  bool _initialized = false;

  @override
  void dispose() {
    _nameCtl.dispose();
    _userCtl.dispose();
    super.dispose();
  }

  void _initFrom(UserProfile p) {
    if (_initialized) return;
    _initialized = true;
    _nameCtl.text = p.displayName;
    _userCtl.text = p.username ?? '';
    _avatarId = p.avatarId == 0 ? 1 : p.avatarId;
    _searchable = p.searchable;
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _saveProfile() async {
    final l = AppLocalizations.of(context);
    final uid = ref.read(currentUidProvider);
    if (uid == null) return;
    // displayName/avatar/searchable are whitelisted client-direct writes.
    await ref.read(firestoreProvider).doc('users/$uid').set({
      'displayName': _nameCtl.text.trim(),
      'avatarId': _avatarId,
      'searchable': _searchable,
    }, SetOptions(merge: true));
    if (mounted) _snack(l.editProfileSaved);
  }

  Future<void> _claimUsername() async {
    final l = AppLocalizations.of(context);
    final raw = _userCtl.text.trim();
    if (raw.isEmpty) return;
    try {
      final claimed = await ref.read(socialApiProvider).claimUsername(raw);
      if (mounted) {
        _userCtl.text = claimed;
        _snack(l.usernameClaimed);
      }
    } on FirebaseFunctionsException catch (e) {
      final reason = (e.details is Map) ? e.details['reason'] as String? : null;
      _snack(switch (reason) {
        'username-taken' => l.usernameTaken,
        'username-profane' => l.usernameProfane,
        _ => l.usernameInvalid,
      });
    } catch (_) {
      if (mounted) _snack(l.commonError);
    }
  }

  Future<void> _deleteAccount() async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.deleteAccount),
        content: Text(l.deleteAccountWarning),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.commonCancel)),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.deleteAccount, style: const TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(socialApiProvider).deleteAccount();
      if (mounted) context.go(Routes.home);
    } catch (_) {
      if (mounted) _snack(l.commonError);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final profile = ref.watch(userProfileProvider).valueOrNull;
    if (profile != null) _initFrom(profile);

    return Scaffold(
      appBar: AppBar(title: Text(l.editProfileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          TextField(
            controller: _nameCtl,
            decoration: InputDecoration(labelText: l.editProfileDisplayName),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(l.editProfileAvatar, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              for (var i = 1; i <= 8; i++)
                ChoiceChip(
                  label: Text('$i'),
                  selected: _avatarId == i,
                  onSelected: (_) => setState(() => _avatarId = i),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(l.editProfileSearchable),
            subtitle: Text(l.editProfileSearchableHint),
            value: _searchable,
            onChanged: (v) => setState(() => _searchable = v),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton(onPressed: _saveProfile, child: Text(l.editProfileSave)),

          const Divider(height: AppSpacing.xl),

          Text(l.editProfileUsername, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _userCtl,
            decoration: InputDecoration(
              labelText: l.editProfileUsername,
              prefixText: '@',
              suffixIcon: IconButton(
                icon: const Icon(Icons.check),
                onPressed: _claimUsername,
              ),
            ),
          ),

          const Divider(height: AppSpacing.xl),

          TextButton.icon(
            icon: const Icon(Icons.delete_forever, color: AppColors.error),
            label: Text(l.deleteAccount, style: const TextStyle(color: AppColors.error)),
            onPressed: _deleteAccount,
          ),
        ],
      ),
    );
  }
}
