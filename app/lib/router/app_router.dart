import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../data/category_mode.dart';
import '../data/seed_friends.dart';
import '../round_screen.dart';
import '../screens/friends/friends_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/play/category_mode_picker.dart';
import '../screens/play/friend_picker_screen.dart';
import '../screens/play/play_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/profile/settings_screen.dart';
import '../shell/home_shell.dart';
import 'routes.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// The app's GoRouter. A [StatefulShellRoute.indexedStack] hosts the four tabs
/// (each branch keeps its own Navigator + state), while the match route is
/// declared on the root navigator so it covers the full screen with no tab bar.
final appRouter = GoRouter(
  navigatorKey: _rootKey,
  initialLocation: Routes.home,
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          HomeShell(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.home,
              name: Routes.nameHome,
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.play,
              name: Routes.namePlay,
              builder: (context, state) => const PlayScreen(),
              routes: [
                GoRoute(
                  path: Routes.friendPicker,
                  name: Routes.nameFriendPicker,
                  builder: (context, state) => const FriendPickerScreen(),
                ),
                GoRoute(
                  path: Routes.categoryMode,
                  name: Routes.nameCategoryMode,
                  builder: (context, state) =>
                      CategoryModePicker(friend: state.extra as SeedFriend),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.friends,
              name: Routes.nameFriends,
              builder: (context, state) => const FriendsScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.profile,
              name: Routes.nameProfile,
              builder: (context, state) => const ProfileScreen(),
              routes: [
                GoRoute(
                  path: Routes.settings,
                  name: Routes.nameSettings,
                  builder: (context, state) => const SettingsScreen(),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: Routes.matchPattern,
      name: Routes.nameMatch,
      parentNavigatorKey: _rootKey, // full-screen, above the tab bar
      builder: (context, state) => RoundScreen(
        matchId: state.pathParameters['matchId']!,
        categoryMode: state.extra as CategoryMode?,
      ),
    ),
  ],
);
