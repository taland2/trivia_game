import 'package:flutter/material.dart';
import 'question_screen.dart';

export 'question_screen.dart';

enum AppFlavor { dev, staging, prod }

class TriviaApp extends StatelessWidget {
  const TriviaApp({super.key, required this.flavor});
  final AppFlavor flavor;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'טריוויה',
      debugShowCheckedModeBanner: flavor != AppFlavor.prod,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6C63FF)),
        useMaterial3: true,
      ),
      home: const QuestionScreen(),
    );
  }
}
