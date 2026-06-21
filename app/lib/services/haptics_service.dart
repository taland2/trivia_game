import 'package:flutter/services.dart';

/// Centralized, toggle-able haptics (UX spec §5). All in-app haptic feedback
/// routes through this singleton so a single settings toggle can disable it; it
/// also respects OS-level haptic settings implicitly (the platform no-ops when
/// the user has haptics off). The Settings screen (Phase 6b) flips [enabled].
class HapticsService {
  static final HapticsService _instance = HapticsService._internal();
  factory HapticsService() => _instance;
  HapticsService._internal();

  bool enabled = true;

  /// Light tap on answer lock.
  void lightTap() {
    if (enabled) HapticFeedback.lightImpact();
  }

  /// Success impact on a correct reveal.
  void success() {
    if (enabled) HapticFeedback.mediumImpact();
  }

  /// Error impact on a wrong reveal.
  void error() {
    if (enabled) HapticFeedback.heavyImpact();
  }

  /// Heavy impact on a match win / strong moment.
  void heavy() {
    if (enabled) HapticFeedback.heavyImpact();
  }
}
