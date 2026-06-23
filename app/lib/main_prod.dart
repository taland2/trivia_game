import 'app.dart';
import 'bootstrap.dart';

void main() => bootstrapAndRun(
      flavor: AppFlavor.prod,
      // TODO(gate-c): the prod Firebase project is created at Gate C (doc 15).
      // Run `flutterfire configure` for it, add `firebase_options_prod.dart`,
      // and replace this with `Firebase.initializeApp(options: prodOptions)`.
      // Until then bootstrap catches this and the app opens in a degraded state
      // rather than crashing silently.
      initFirebase: () async {
        throw UnsupportedError(
          'Prod Firebase is not configured yet (Gate C). Run '
          '`flutterfire configure` and add firebase_options_prod.dart.',
        );
      },
    );
