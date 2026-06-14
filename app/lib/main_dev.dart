import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'app.dart';
import 'firebase_options_dev.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: devFirebaseOptions);

  // Point all Firebase SDKs at the local emulator suite.
  // Physical device: run `adb reverse tcp:9099 tcp:9099 && adb reverse tcp:5001 tcp:5001`
  // so that 'localhost' on the device resolves to the dev machine.
  await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
  FirebaseFunctions.instanceFor(region: 'me-west1')
      .useFunctionsEmulator('localhost', 5001);

  runApp(const TriviaApp(flavor: AppFlavor.dev));
}
