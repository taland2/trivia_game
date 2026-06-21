import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/l10n/app_localizations.dart';
import 'package:trivia/widgets/async_value_view.dart';

// The reusable async-state widget is rendered on every screen, so it carries the
// highest test value: each AsyncValue state must map to the right slot, retry
// must fire, and the offline banner must show on demand.

Widget _host(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('loading state shows a progress indicator', (tester) async {
    await tester.pumpWidget(_host(
      AsyncValueView<int>(
        value: const AsyncValue.loading(),
        data: (d) => Text('data $d'),
      ),
    ));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('data state renders the data builder', (tester) async {
    await tester.pumpWidget(_host(
      AsyncValueView<int>(
        value: const AsyncValue.data(7),
        data: (d) => Text('data $d'),
      ),
    ));
    expect(find.text('data 7'), findsOneWidget);
  });

  testWidgets('error state shows retry and fires onRetry', (tester) async {
    var retried = 0;
    await tester.pumpWidget(_host(
      AsyncValueView<int>(
        value: AsyncValue.error('boom', StackTrace.current),
        onRetry: () => retried++,
        data: (d) => Text('data $d'),
      ),
    ));
    final retry = find.text('Try again');
    expect(retry, findsOneWidget);
    await tester.tap(retry);
    expect(retried, 1);
  });

  testWidgets('empty predicate routes to emptyBuilder, not data', (tester) async {
    await tester.pumpWidget(_host(
      AsyncValueView<List<int>>(
        value: const AsyncValue.data(<int>[]),
        isEmpty: (list) => list.isEmpty,
        emptyBuilder: (_) => const Text('nothing here'),
        data: (d) => Text('count ${d.length}'),
      ),
    ));
    expect(find.text('nothing here'), findsOneWidget);
    expect(find.textContaining('count'), findsNothing);
  });

  testWidgets('offline banner shows above the body when isOffline', (tester) async {
    await tester.pumpWidget(_host(
      AsyncValueView<int>(
        value: const AsyncValue.data(1),
        isOffline: true,
        data: (d) => Text('data $d'),
      ),
    ));
    expect(find.text('No internet connection'), findsOneWidget);
    expect(find.text('data 1'), findsOneWidget);
  });
}
