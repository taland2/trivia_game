import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The Cloud Functions region. All callables are pinned to `me-west1`
/// (doc 06 §1). Centralized so screens never hardcode it.
const String kFunctionsRegion = 'me-west1';

/// Dependency-injection seams for Firebase singletons. Tests override these in a
/// `ProviderScope` to run without a live backend; production reads the real
/// instances. Keeping them behind providers is what makes the rest of the state
/// layer unit-testable.
final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);

final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);

final functionsProvider = Provider<FirebaseFunctions>(
  (ref) => FirebaseFunctions.instanceFor(region: kFunctionsRegion),
);
