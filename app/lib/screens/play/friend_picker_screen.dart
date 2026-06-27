import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/social_models.dart';
import '../../router/routes.dart';
import '../../state/social_providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/async_value_view.dart';
import '../../widgets/empty_state.dart';

/// Pick an opponent for a new duel from the LIVE friends graph (Phase 8a — the
/// dev seed roster is gone). Selecting one advances to the category-mode picker,
/// carrying the friend as an [Opponent]. No friends → add-friends empty state.
class FriendPickerScreen extends ConsumerWidget {
  const FriendPickerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final friends = ref.watch(friendshipsStreamProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.friendPickerTitle)),
      body: AsyncValueView<List<FriendEdge>>(
        value: friends,
        onRetry: () => ref.invalidate(friendshipsStreamProvider),
        isEmpty: (list) => list.isEmpty,
        emptyBuilder: (context) => EmptyState(
          icon: Icons.group_add_outlined,
          title: l.friendPickerEmpty,
          body: l.friendsEmptyBody,
          ctaLabel: l.friendsAddTitle,
          onCta: () => context.push(Routes.friendsAddPath),
        ),
        data: (edges) => ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.md),
          itemCount: edges.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
          itemBuilder: (context, i) => _FriendPickTile(friendUid: edges[i].friendUid),
        ),
      ),
    );
  }
}

class _FriendPickTile extends ConsumerWidget {
  const _FriendPickTile({required this.friendUid});
  final String friendUid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(friendProfileProvider(friendUid)).valueOrNull;
    final name = profile?.displayName.isNotEmpty == true
        ? profile!.displayName
        : friendUid;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Text(name.isEmpty ? '?' : name.characters.first),
        ),
        title: Text(name),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.pushNamed(
          Routes.nameCategoryMode,
          extra: Opponent(
            uid: friendUid,
            displayName: name,
            avatarId: profile?.avatarId ?? 0,
          ),
        ),
      ),
    );
  }
}
