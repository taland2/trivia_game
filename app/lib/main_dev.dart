import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'firebase_options_dev.dart';
import 'state/firebase_providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: devFirebaseOptions);

  // Point all Firebase SDKs at the local emulator suite.
  // Physical device: run `adb reverse tcp:9099 tcp:9099 && adb reverse tcp:5001 tcp:5001`
  // (and tcp:8088 for Firestore) so 'localhost' on the device resolves to the dev machine.
  await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
  FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8088);
  FirebaseFunctions.instanceFor(region: kFunctionsRegion)
      .useFunctionsEmulator('localhost', 5001);

  runApp(
    const ProviderScope(
      child: TriviaApp(flavor: AppFlavor.dev),
    ),
  );
}
