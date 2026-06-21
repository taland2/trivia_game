import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'state/auth_providers.dart';
import 'state/settings_providers.dart';
import 'theme/app_theme.dart';
import 'services/audio_service.dart';

enum AppFlavor { dev, staging, prod }

class TriviaApp extends ConsumerStatefulWidget {
  const TriviaApp({super.key, required this.flavor});
  final AppFlavor flavor;

  @override
  ConsumerState<TriviaApp> createState() => _TriviaAppState();
}

class _TriviaAppState extends ConsumerState<TriviaApp> {
  @override
  void initState() {
    super.initState();
    // Sound effects are intentionally fire-and-forget: the app can render before
    // assets finish loading, and play() silently no-ops until then.
    unawaited(AudioService().initialize());
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: widget.flavor != AppFlavor.prod,
      theme: AppTheme.buildLightTheme(),
      darkTheme: AppTheme.buildDarkTheme(),
      themeMode: ThemeMode.light, // MVP ships light only (UX spec §5)
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      routerConfig: appRouter,
      // Gate the whole app on the session bootstrap (anon sign-in + profile doc),
      // so no screen queries Firestore before a uid + same-language profile exist.
      builder: (context, child) {
        final session = ref.watch(sessionProvider);
        return session.when(
          data: (_) => child!,
          loading: () => const _Splash(),
          error: (_, _) => const _Splash(failed: true),
        );
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash({this.failed = false});
  final bool failed;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.buildLightTheme().colorScheme.primary,
      body: Center(
        child: failed
            ? const Icon(Icons.cloud_off, color: Colors.white, size: 48)
            : const CircularProgressIndicator(color: Colors.white),
      ),
    );
  }
}
