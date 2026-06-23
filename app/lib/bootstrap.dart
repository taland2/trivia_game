import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

/// Single entrypoint shared by every flavor's `main_*.dart`. It installs global
/// error handling, initializes Firebase defensively, and runs the app inside a
/// guarded zone so that NO failure — a bad network, a missing backend config, an
/// uncaught async error — can prevent the app from opening.
///
/// [initFirebase] is flavor-specific (dev wires the emulators; prod/staging wire
/// the real project). If it throws, we log and continue: the session layer then
/// degrades to a no-uid state (see auth_providers.dart) and screens show their
/// retry/empty variants instead of a white screen.
Future<void> bootstrapAndRun({
  required AppFlavor flavor,
  required Future<void> Function() initFirebase,
}) async {
  // ensureInitialized() and runApp() must share the zone created by
  // runZonedGuarded, so both live inside this callback.
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // Framework (build/layout/paint) errors.
      FlutterError.onError = (FlutterErrorDetails details) {
        FlutterError.presentError(details);
        // TODO(crashlytics): forward to Crashlytics once wired (doc 06 stack).
      };

      // Uncaught platform/async errors that escape the framework.
      PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
        debugPrint('Uncaught platform error: $error\n$stack');
        return true; // handled — do not crash the isolate.
      };

      // Replace the red error screen with a calm, self-contained fallback so a
      // single widget failure degrades to a message instead of a scary box.
      ErrorWidget.builder = (FlutterErrorDetails details) => const _SafeErrorWidget();

      try {
        await initFirebase();
      } catch (e, st) {
        // Backend unavailable or not yet configured: open the app anyway.
        debugPrint('Firebase init failed (continuing degraded): $e\n$st');
      }

      runApp(ProviderScope(child: TriviaApp(flavor: flavor)));
    },
    (Object error, StackTrace stack) {
      debugPrint('Uncaught zone error: $error\n$stack');
    },
  );
}

/// Minimal, context-free fallback shown by [ErrorWidget.builder]. It can render
/// anywhere (even outside a MaterialApp), so it brings its own Directionality
/// and avoids any localization lookups.
class _SafeErrorWidget extends StatelessWidget {
  const _SafeErrorWidget();

  @override
  Widget build(BuildContext context) {
    return const Directionality(
      textDirection: TextDirection.ltr,
      child: Material(
        color: Color(0xFF1A1A2E),
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.refresh, color: Colors.white70, size: 40),
                SizedBox(height: 12),
                Text(
                  'Something went wrong.\nPlease reopen the app.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
