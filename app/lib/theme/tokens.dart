import 'package:flutter/material.dart';

abstract class AppColors {
  // Surface / Primary
  static const Color surfacePrimary = Color(0xFF6C63FF);
  static const Color surfacePrimaryDark = Color(0xFF8A84FF);
  static const Color surface = Color(0xFFFAFAFA);
  static const Color surfaceDark = Color(0xFF121212);

  // Answer buttons
  static const Color answerIdle = Color(0x26FFFFFF);
  static const Color answerCorrect = Color(0xFF2E7D32);
  static const Color answerWrong = Color(0xFFC62828);
  static const Color answerDimmed = Color(0x14FFFFFF);

  // Timer ring
  static const Color timerGreen = Color(0xFF43A047);
  static const Color timerAmber = Color(0xFFFB8C00);
  static const Color timerRed = Color(0xFFE53935);

  // Text
  static const Color textPrimary = Color(0xFF1A1A1A);
  static const Color textPrimaryDark = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF666666);
  static const Color textSecondaryDark = Color(0xFFB0B0B0);

  // Semantic
  static const Color success = Color(0xFF2E7D32);
  static const Color error = Color(0xFFC62828);
  static const Color warning = Color(0xFFFB8C00);
}

abstract class AppSpacing {
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;
}

abstract class AppRadius {
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 24.0;
}

abstract class AppDurations {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);
  static const Duration celebration = Duration(milliseconds: 1500);
}
