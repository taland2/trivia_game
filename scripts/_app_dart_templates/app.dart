import 'package:flutter/material.dart';

enum AppFlavor { dev, staging, prod }

class TriviaApp extends StatelessWidget {
  const TriviaApp({super.key, required this.flavor});
  final AppFlavor flavor;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Trivia',
      debugShowCheckedModeBanner: flavor != AppFlavor.prod,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6C63FF)),
        useMaterial3: true,
      ),
      home: HelloScreen(flavor: flavor),
    );
  }
}

// Phase 0 hello screen — no Firebase dependency yet.
// Firebase init + real screens land in Phase 1 (walking skeleton).
class HelloScreen extends StatelessWidget {
  const HelloScreen({super.key, required this.flavor});
  final AppFlavor flavor;

  @override
  Widget build(BuildContext context) {
    final flavorLabel = switch (flavor) {
      AppFlavor.dev => 'dev',
      AppFlavor.staging => 'staging',
      AppFlavor.prod => 'prod',
    };
    return Scaffold(
      backgroundColor: const Color(0xFF6C63FF),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'טריוויה',
              style: TextStyle(
                color: Colors.white,
                fontSize: 48,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '[$flavorLabel]',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 32),
            const Text(
              'Phase 0 ✓',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
