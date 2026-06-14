import 'package:firebase_core/firebase_core.dart';

// Dev-flavor Firebase options for the local emulator suite.
// projectId uses the 'demo-' prefix so Firebase treats it as an offline demo project
// (no real GCP project needed until Phase 7 first deploy).
// Run `scripts/dev.ps1` to start emulators, then `flutter run --flavor dev -t lib/main_dev.dart`.
const FirebaseOptions devFirebaseOptions = FirebaseOptions(
  apiKey: 'dev-fake-api-key',
  appId: '1:000000000000:android:0000000000000000',
  messagingSenderId: '000000000000',
  projectId: 'demo-trivia-dev',
  storageBucket: 'demo-trivia-dev.appspot.com',
);
