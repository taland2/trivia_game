import 'package:flutter/material.dart';
import 'round_screen.dart';
import 'theme/app_theme.dart';
import 'services/audio_service.dart';

enum AppFlavor { dev, staging, prod }

class TriviaApp extends StatefulWidget {
  const TriviaApp({super.key, required this.flavor});
  final AppFlavor flavor;

  @override
  State<TriviaApp> createState() => _TriviaAppState();
}

class _TriviaAppState extends State<TriviaApp> {
  @override
  void initState() {
    super.initState();
    AudioService().initialize();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'טריוויה',
      debugShowCheckedModeBanner: widget.flavor != AppFlavor.prod,
      theme: AppTheme.buildLightTheme(),
      darkTheme: AppTheme.buildDarkTheme(),
      themeMode: ThemeMode.light,
      supportedLocales: const [
        Locale('he'),
        Locale('en'),
      ],
      locale: const Locale('he'),
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: const RoundScreen(),
    );
  }
}
