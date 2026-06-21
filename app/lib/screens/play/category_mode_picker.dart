import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/category_mode.dart';
import '../../data/seed_friends.dart';
import '../../l10n/app_localizations.dart';
import '../../router/routes.dart';
import '../../screens/match/match_controller.dart';
import '../../theme/tokens.dart';

/// Choose the category-selection mode for the new duel (GDD §4.3), then create
/// the match and open it full-screen. The per-round category itself is decided
/// inside the match flow (pick offer / wheel / auto).
class CategoryModePicker extends ConsumerStatefulWidget {
  const CategoryModePicker({super.key, required this.friend});
  final SeedFriend friend;

  @override
  ConsumerState<CategoryModePicker> createState() => _CategoryModePickerState();
}

class _CategoryModePickerState extends ConsumerState<CategoryModePicker> {
  bool _creating = false;

  Future<void> _select(CategoryMode mode) async {
    if (_creating) return;
    setState(() => _creating = true);
    try {
      final matchId = await ref.read(matchApiProvider).createDuel(
            opponentUid: widget.friend.uid,
            mode: mode,
          );
      if (!mounted) return;
      // Open the match on the root navigator (full-screen, no tab bar).
      context.push(Routes.match(matchId), extra: mode);
      setState(() => _creating = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _creating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).commonError)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.categoryModeTitle)),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              for (final mode in CategoryMode.values)
                Card(
                  margin: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: ListTile(
                    leading: Icon(_iconFor(mode)),
                    title: Text(mode.label(l)),
                    subtitle: Text(mode.description(l)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: _creating ? null : () => _select(mode),
                  ),
                ),
            ],
          ),
          if (_creating)
            const ColoredBox(
              color: Color(0x66000000),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }

  IconData _iconFor(CategoryMode mode) => switch (mode) {
        CategoryMode.pick => Icons.touch_app,
        CategoryMode.spin => Icons.casino,
        CategoryMode.auto => Icons.auto_awesome,
      };
}
