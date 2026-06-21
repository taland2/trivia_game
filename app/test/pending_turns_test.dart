import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/data/category_mode.dart';
import 'package:trivia/models/match_list_entry.dart';
import 'package:trivia/state/match_list_providers.dart';

// Verifies the derived match providers' filtering, independent of Firestore: the
// matchList stream is overridden with canned entries.

MatchListEntry _entry({
  required String id,
  required String state,
  required bool yourTurn,
  int lastEventMs = 0,
  bool finished = false,
}) =>
    MatchListEntry(
      matchId: id,
      opponentUid: 'seed_dana',
      state: state,
      yourTurn: yourTurn,
      currentRound: 0,
      categoryMode: CategoryMode.spin,
      roundWins: const {},
      lastEventMs: lastEventMs,
      finished: finished,
    );

ProviderContainer _containerWith(List<MatchListEntry> entries) {
  return ProviderContainer(
    overrides: [
      matchListStreamProvider.overrideWith((ref) => Stream.value(entries)),
    ],
  );
}

void main() {
  test('pendingTurnsProvider keeps only active + your-turn matches', () async {
    final container = _containerWith([
      _entry(id: 'a', state: 'active', yourTurn: true),
      _entry(id: 'b', state: 'active', yourTurn: false),
      _entry(id: 'c', state: 'finished', yourTurn: true, finished: true),
    ]);
    addTearDown(container.dispose);

    await container.read(matchListStreamProvider.future);

    final pending = container.read(pendingTurnsProvider).requireValue;
    expect(pending.map((e) => e.matchId), ['a']);

    final active = container.read(activeMatchesProvider).requireValue;
    expect(active.map((e) => e.matchId).toSet(), {'a', 'b'});
  });

  test('no matches yields empty pending list', () async {
    final container = _containerWith(const []);
    addTearDown(container.dispose);

    await container.read(matchListStreamProvider.future);

    expect(container.read(pendingTurnsProvider).requireValue, isEmpty);
    expect(container.read(activeMatchesProvider).requireValue, isEmpty);
  });
}
