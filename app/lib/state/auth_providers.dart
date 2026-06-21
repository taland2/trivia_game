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

/// App session bootstrap: guarantees a signed-in (anonymous) user AND a
/// `users/{uid}` profile doc with a language set. The profile is a CLIENT-DIRECT
/// write of whitelisted preference fields only (firestore.rules `users` create
/// whitelist) — integrity fields stay function-written. Returns the uid.
///
/// The same-language duel rule (GDD §4.7) means this profile's `language` must
/// match seeded opponents (`he`), or `v1_createDuel` rejects with
/// `language-mismatch`. The whole app is gated on this completing.
final sessionProvider = FutureProvider<String>((ref) async {
  final auth = ref.watch(firebaseAuthProvider);
  final db = ref.watch(firestoreProvider);
  final language = ref.read(settingsProvider).languageCode;

  final user = auth.currentUser ?? (await auth.signInAnonymously()).user!;
  final uid = user.uid;

  final ref0 = db.doc('users/$uid');
  final snap = await ref0.get();
  if (!snap.exists) {
    // Minimal guest profile (a fuller FTUE lands in Phase 8). Keys are limited
    // to the rules `create` whitelist.
    await ref0.set({
      'language': language,
      'isGuest': true,
      'displayName': 'Guest',
      'avatarId': 0,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
  return uid;
});
