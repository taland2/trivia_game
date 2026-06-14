import 'package:flutter/material.dart';
import 'app.dart';

// Phase 0: no Firebase yet — just proves the app runs on device.
// Firebase initialization lands in Phase 1 (walking skeleton).
void main() {
  runApp(const TriviaApp(flavor: AppFlavor.dev));
}
