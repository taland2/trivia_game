import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../models/social_models.dart';
import '../../router/routes.dart';
import '../../services/social_service.dart';
import '../../state/social_providers.dart';
import '../../theme/tokens.dart';
import '../../widgets/async_value_view.dart';
import '../../widgets/empty_state.dart';

/// Friends tab (GDD §10.1, Phase 8a): incoming requests + the friends list, with
/// entry points to add-by-username, show-my-QR, and scan. Tapping a friend starts
/// a duel; the overflow menu unfriends/blocks. All reads are the live graph
/// (social_providers); all mutations go through socialApi.
class FriendsScreen extends ConsumerWidget {
  const FriendsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final friends = ref.watch(friendshipsStreamProvider);
    final requests = ref.watch(incomingRequestsProvider).valueOrNull ?? const [];

    return Scaffold(
      appBar: AppBar(
        title: Text(l.friendsTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code),
            tooltip: l.friendsMyQr,
            onPressed: () => context.push(Routes.friendsMyQrPath),
          ),
          IconButton(
            icon: const Icon(Icons.person_add_alt),
            tooltip: l.friendsAddTitle,
            onPressed: () => context.push(Routes.friendsAddPath),
          ),
        ],
      ),
      body: AsyncValueView<List<FriendEdge>>(
        value: friends,
        onRetry: () => ref.invalidate(friendshipsStreamProvider),
        isEmpty: (list) => list.isEmpty && requests.isEmpty,
        emptyBuilder: (context) => EmptyState(
          icon: Icons.group_add_outlined,
          title: l.friendsEmptyTitle,
          body: l.friendsEmptyBody,
          ctaLabel: l.friendsAddTitle,
          onCta: () => context.push(Routes.friendsAddPath),
        ),
        data: (edges) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            if (requests.isNotEmpty) ...[
              Text(l.friendsRequestsTitle,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              ...requests.map((r) => _RequestTile(request: r)),
              const SizedBox(height: AppSpacing.lg),
            ],
            Text(l.friendsTitle, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            ...edges.map((e) => _FriendTile(friendUid: e.friendUid)),
          ],
        ),
      ),
    );
  }
}

class _RequestTile extends ConsumerWidget {
  const _RequestTile({required this.request});
  final FriendRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final api = ref.read(socialApiProvider);
    final label = request.fromUsername != null
        ? '${request.fromName} @${request.fromUsername}'
        : request.fromName;

    return Card(
      child: ListTile(
        leading: _Avatar(name: request.fromName),
        title: Text(label.trim().isEmpty ? request.from : label),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.check, color: AppColors.success),
              tooltip: l.friendsAccept,
              onPressed: () => api.respondFriendRequest(request.id, accept: true),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: AppColors.error),
              tooltip: l.friendsDecline,
              onPressed: () => api.respondFriendRequest(request.id, accept: false),
            ),
          ],
        ),
      ),
    );
  }
}

class _FriendTile extends ConsumerWidget {
  const _FriendTile({required this.friendUid});
  final String friendUid;

  Future<bool> _confirm(BuildContext context, String title) async {
    final l = AppLocalizations.of(context);
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(title),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: Text(l.commonCancel),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(l.commonConfirm),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final api = ref.read(socialApiProvider);
    final profile = ref.watch(friendProfileProvider(friendUid)).valueOrNull;
    final name = profile?.displayName.isNotEmpty == true
        ? profile!.displayName
        : friendUid;

    return Card(
      child: ListTile(
        leading: _Avatar(name: name),
        title: Text(name),
        onTap: () => context.pushNamed(
          Routes.nameCategoryMode,
          extra: Opponent(
            uid: friendUid,
            displayName: name,
            avatarId: profile?.avatarId ?? 0,
          ),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (v) async {
            final ok = await _confirm(
              context,
              v == 'unfriend' ? l.friendsUnfriendConfirm : l.friendsBlockConfirm,
            );
            if (!ok) return;
            if (v == 'unfriend') {
              await api.unfriend(friendUid);
            } else {
              await api.block(friendUid);
            }
          },
          itemBuilder: (ctx) => [
            PopupMenuItem(value: 'unfriend', child: Text(l.friendsUnfriend)),
            PopupMenuItem(value: 'block', child: Text(l.friendsBlock)),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return CircleAvatar(
      backgroundColor: theme.colorScheme.primary.withAlpha(40),
      child: Text(initial,
          style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold)),
    );
  }
}
