import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'state/auth_providers.dart';
import 'state/daily_providers.dart';
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

class _TriviaAppState extends ConsumerState<TriviaApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Sound effects are intentionally fire-and-forget: the app can render before
    // assets finish loading, and play() silently no-ops until then.
    unawaited(AudioService().initialize());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // The local calendar date may have rolled over while the app was warm in
      // the background. Recompute it so the Home daily card and the daily flow
      // track today, not the day the app was last opened (todayDayIdProvider is
      // otherwise cached for the whole session).
      ref.invalidate(todayDayIdProvider);

      // When the app comes back to the foreground without a uid (e.g. the user
      // launched offline and has since regained connectivity), retry the
      // bootstrap so the backend-dependent screens come to life without a
      // restart.
      if (ref.read(sessionProvider).valueOrNull == null) {
        ref.invalidate(sessionProvider);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: widget.flavor != AppFlavor.prod,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.light, // MVP ships light only (UX spec §5)
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      routerConfig: appRouter,
      // The app is NEVER hard-gated on the backend. We show a brief splash only
      // while the (bounded) bootstrap runs; once it settles we always render the
      // app, whether or not a uid was obtained. sessionProvider returns null
      // instead of throwing when offline, so the error branch is purely
      // defensive — it offers a retry rather than stranding the user.
      builder: (context, child) {
        final session = ref.watch(sessionProvider);
        return session.when(
          data: (_) => child!,
          loading: () => const _Splash(),
          error: (_, _) =>
              _Splash(failed: true, onRetry: () => ref.invalidate(sessionProvider)),
        );
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash({this.failed = false, this.onRetry});
  final bool failed;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppTheme.light.colorScheme.primary,
      body: Center(
        child: failed
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off, color: Colors.white, size: 48),
                    const SizedBox(height: 16),
                    Text(
                      l.commonError,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white),
                    ),
                    if (onRetry != null) ...[
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: onRetry,
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppTheme.light.colorScheme.primary,
                        ),
                        child: Text(l.commonRetry),
                      ),
                    ],
                  ],
                ),
              )
            : const CircularProgressIndicator(color: Colors.white),
      ),
    );
  }
}
