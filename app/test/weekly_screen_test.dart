import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/l10n/app_localizations.dart';
import 'package:trivia/models/leaderboard.dart';
import 'package:trivia/screens/weekly/podium_screen.dart';
import 'package:trivia/screens/weekly/weekly_screen.dart';
import 'package:trivia/state/auth_providers.dart';
import 'package:trivia/state/weekly_providers.dart';

// WeeklyScreen renders the server `boards/{uid}` projection (no client
// re-derivation): the ranked list, the viewer's highlighted row, and the top-3
// podium. A solo/empty board shows the invite-to-race empty state.

WeeklyBoard _board() => const WeeklyBoard(
      rows: [
        LeaderboardRow(uid: 'a', name: 'Alice', avatarId: 0, level: 5, points: 120, rank: 1),
        LeaderboardRow(uid: 'me', name: 'Me', avatarId: 0, level: 3, points: 80, rank: 2),
        LeaderboardRow(uid: 'b', name: 'Bob', avatarId: 0, level: 2, points: 40, rank: 3),
      ],
      updatedAt: '2026-06-25T00:00:00.000Z',
    );

Future<void> _pump(WidgetTester tester, Widget home, List<Override> overrides) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: home,
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('renders the ranked board with all friends', (tester) async {
    await _pump(tester, const WeeklyScreen(), [
      currentUidProvider.overrideWithValue('me'),
      weeklyBoardProvider.overrideWith((ref) => Stream.value(_board())),
    ]);

    expect(find.text('Alice'), findsWidgets);
    expect(find.text('Bob'), findsWidgets);
    expect(find.text('Me'), findsWidgets);
    // Points render via the l10n "{points} pts" label.
    expect(find.text('120 pts'), findsWidgets);
    // Podium medals are present (top-3 strip).
    expect(find.text('🥇'), findsOneWidget);
  });

  testWidgets('solo board shows the invite-to-race empty state', (tester) async {
    await _pump(tester, const WeeklyScreen(), [
      currentUidProvider.overrideWithValue('me'),
      weeklyBoardProvider.overrideWith((ref) => Stream.value(null)),
    ]);

    expect(find.text('The race hasn\'t started'), findsOneWidget);
  });

  testWidgets('podium renders the top three from the board rows', (tester) async {
    await _pump(
      tester,
      PodiumScreen(rows: _board().rows, meUid: 'me'),
      const [],
    );
    await tester.pump(const Duration(milliseconds: 700)); // entrance animation

    expect(find.text('Alice'), findsOneWidget);
    expect(find.text('Me'), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    expect(find.text('🥇'), findsOneWidget);
    expect(find.text('🥈'), findsOneWidget);
    expect(find.text('🥉'), findsOneWidget);
  });
}
