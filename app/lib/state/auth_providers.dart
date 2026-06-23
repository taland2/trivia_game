import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'firebase_providers.dart';
import 'settings_providers.dart';

/// Live auth state. Anonymous sign-in is performed by [sessionProvider]; this
/// just reflects whatever user FirebaseAuth currently holds.
final authStateProvider = StreamProvider<User?>(
  (ref) => ref.watch(firebaseAuthProvider).authStateChanges(),
);

/// The current user id, or null while signed out. Most data providers derive
/// their query path from this.
final currentUidProvider = Provider<String?>(
  (ref) => ref.watch(authStateProvider).valueOrNull?.uid,
);

/// How long any single network step in the bootstrap may run before we give up
/// and let the app open in a degraded (no-uid) state. Kept short so a dead
/// network never strands the user on the splash screen.
const Duration _kBootstrapStepTimeout = Duration(seconds: 8);

/// Runs [op] up to [attempts] times with linear backoff. Used for the anonymous
/// sign-in, which can fail transiently right after a network comes back.
Future<T> _withRetry<T>(Future<T> Function() op, {int attempts = 3}) async {
  for (var i = 0; ; i++) {
    try {
      return await op().timeout(_kBootstrapStepTimeout);
    } catch (_) {
      if (i >= attempts - 1) rethrow;
      await Future<void>.delayed(Duration(milliseconds: 400 * (i + 1)));
    }
  }
}

/// App session bootstrap: tries to guarantee a signed-in (anonymous) user AND a
/// `users/{uid}` profile doc with a language set. The profile is a CLIENT-DIRECT
/// write of whitelisted preference fields only (firestore.rules `users` create
/// whitelist) — integrity fields stay function-written.
///
/// Resilience contract (so the app ALWAYS opens, even offline):
///   * Returns the uid on success, or **null** when no backend is reachable —
///     it never throws and never blocks the UI indefinitely. Downstream
///     providers already treat a null uid as "signed out" and render empty/retry
///     states, so the shell, local settings, and the (local) friend picker work
///     with no connection. The session is retried on app resume (see app.dart).
///   * The profile write is best-effort: a transient failure there must not
///     fail the whole session, because the uid alone is enough to run and the
///     doc is re-ensured on the next successful bootstrap.
///
/// The same-language duel rule (GDD §4.7) means this profile's `language` must
/// match seeded opponents (`he`), or `v1_createDuel` rejects with
/// `language-mismatch`.
final sessionProvider = FutureProvider<String?>((ref) async {
  final auth = ref.watch(firebaseAuthProvider);
  final db = ref.watch(firestoreProvider);
  final language = ref.read(settingsProvider).languageCode;

  // 1. Ensure a signed-in user. Returning users have a cached user available
  //    offline; a first launch needs the network, so bound the attempt and
  //    degrade to a no-uid session rather than stranding the splash screen.
  User? user = auth.currentUser;
  if (user == null) {
    try {
      user = await _withRetry(() => auth.signInAnonymously()).then((c) => c.user);
    } catch (_) {
      return null; // Open the app offline; retry on resume / next launch.
    }
  }
  if (user == null) return null;
  final uid = user.uid;

  // 2. Ensure the profile doc. Best-effort — never fail the session on this.
  try {
    final ref0 = db.doc('users/$uid');
    final snap = await ref0.get().timeout(_kBootstrapStepTimeout);
    if (!snap.exists) {
      // Minimal guest profile (a fuller FTUE lands in Phase 8). Keys are limited
      // to the rules `create` whitelist.
      await ref0.set({
        'language': language,
        'isGuest': true,
        'displayName': 'Guest',
        'avatarId': 0,
        'createdAt': FieldValue.serverTimestamp(),
      }).timeout(_kBootstrapStepTimeout);
    }
  } catch (_) {
    // Ignore: the uid is enough to run; the profile syncs on a later bootstrap.
  }
  return uid;
});
