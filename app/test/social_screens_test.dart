import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trivia/l10n/app_localizations.dart';
import 'package:trivia/models/social_models.dart';
import 'package:trivia/screens/friends/add_friend_screen.dart';
import 'package:trivia/screens/friends/friends_screen.dart';
import 'package:trivia/services/social_service.dart';
import 'package:trivia/state/social_providers.dart';

// Friends UI renders the live graph (overridden providers) and routes mutations
// through socialApi — no live backend. A fake SocialApi records the calls.

class _FakeSocialApi implements SocialApi {
  final calls = <String>[];
  List<UserSearchResult> searchResults = const [];

  @override
  Future<List<UserSearchResult>> searchUsername(String query) async {
    calls.add('search:$query');
    return searchResults;
  }

  @override
  Future<String> sendFriendRequest(String toUid) async {
    calls.add('send:$toUid');
    return 'pending';
  }

  @override
  Future<String> respondFriendRequest(String requestId, {required bool accept}) async {
    calls.add('respond:$requestId:$accept');
    return accept ? 'accepted' : 'declined';
  }

  @override
  Future<String> claimUsername(String username) async => username;
  @override
  Future<({String code, String link})> issueInviteCode() async =>
      (code: 'abcd1234', link: 'https://x/i/abcd1234');
  @override
  Future<RedeemResult> redeemInviteCode(String code) async =>
      const RedeemResult(friendUid: 'z');
  @override
  Future<void> unfriend(String uid) async => calls.add('unfriend:$uid');
  @override
  Future<void> block(String uid) async => calls.add('block:$uid');
  @override
  Future<void> unblock(String uid) async {}
  @override
  Future<void> completeOnboarding({String? displayName, int? avatarId}) async {}
  @override
  Future<void> deleteAccount() async {}
}

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
  testWidgets('Friends tab renders friends + requests and accepts a request',
      (tester) async {
    final fake = _FakeSocialApi();
    await _pump(tester, const FriendsScreen(), [
      socialApiProvider.overrideWithValue(fake),
      friendshipsStreamProvider.overrideWith(
        (ref) => Stream.value(const [FriendEdge(friendUid: 'b', source: 'search')]),
      ),
      incomingRequestsProvider.overrideWith(
        (ref) => Stream.value(const [
          FriendRequest(id: 'c_a', from: 'c', to: 'a', state: 'pending', fromName: 'Cara'),
        ]),
      ),
      friendProfileProvider.overrideWith(
        (ref, uid) => Stream.value(Opponent(uid: uid, displayName: 'Bob', avatarId: 0)),
      ),
    ]);
    await tester.pump();

    expect(find.text('Bob'), findsOneWidget); // friend row
    expect(find.text('Cara'), findsOneWidget); // request row

    await tester.tap(find.byIcon(Icons.check)); // accept
    await tester.pump();
    expect(fake.calls, contains('respond:c_a:true'));
  });

  testWidgets('Add-friend searches and sends a request', (tester) async {
    final fake = _FakeSocialApi()
      ..searchResults = const [
        UserSearchResult(uid: 'u9', username: 'dana', displayName: 'Dana', avatarId: 0),
      ];
    await _pump(tester, const AddFriendScreen(), [
      socialApiProvider.overrideWithValue(fake),
    ]);

    await tester.enterText(find.byType(TextField).first, 'dan');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump();
    await tester.pump();

    expect(find.text('Dana'), findsOneWidget);
    expect(fake.calls, contains('search:dan'));

    await tester.tap(find.text('Send request'));
    await tester.pump();
    expect(fake.calls, contains('send:u9'));
  });
}
