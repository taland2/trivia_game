import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import '../state/match_list_providers.dart';

/// The tab-bar scaffold hosting the four-branch [StatefulNavigationShell]. The
/// shell uses an IndexedStack internally, so each tab keeps its own state and
/// scroll position (e.g. Home's Firestore stream stays subscribed across tabs).
/// Match screens render on the root navigator, above this scaffold (no tab bar).
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    // Tapping the active tab again pops it to its root (go_router idiom).
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final pendingCount = ref.watch(pendingTurnsProvider).maybeWhen(
          data: (turns) => turns.length,
          orElse: () => 0,
        );

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onTap,
        destinations: [
          NavigationDestination(
            icon: _BadgedIcon(icon: Icons.home_outlined, count: pendingCount),
            selectedIcon: _BadgedIcon(icon: Icons.home, count: pendingCount),
            label: l.tabHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.play_circle_outline),
            selectedIcon: const Icon(Icons.play_circle),
            label: l.tabPlay,
          ),
          NavigationDestination(
            icon: const Icon(Icons.people_outline),
            selectedIcon: const Icon(Icons.people),
            label: l.tabFriends,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: l.tabProfile,
          ),
        ],
      ),
    );
  }
}

/// Wraps an icon with a small count badge for pending turns.
class _BadgedIcon extends StatelessWidget {
  const _BadgedIcon({required this.icon, required this.count});
  final IconData icon;
  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return Icon(icon);
    return Badge(label: Text('$count'), child: Icon(icon));
  }
}
