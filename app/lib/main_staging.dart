import 'app.dart';
import 'bootstrap.dart';

void main() => bootstrapAndRun(
      flavor: AppFlavor.staging,
      // TODO(gate-c): the staging Firebase project is created at Gate C (doc 15).
      // Run `flutterfire configure` for it, add `firebase_options_staging.dart`,
      // and replace this with `Firebase.initializeApp(options: stagingOptions)`.
      // Until then bootstrap catches this and the app opens in a degraded state
      // rather than crashing silently.
      initFirebase: () async {
        throw UnsupportedError(
          'Staging Firebase is not configured yet (Gate C). Run '
          '`flutterfire configure` and add firebase_options_staging.dart.',
        );
      },
    );
