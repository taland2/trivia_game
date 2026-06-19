import 'package:flutter/material.dart';

abstract class CategoryColors {
  static const Map<String, Color> colors = {
    'general_knowledge': Color(0xFF1A73E8),
    'sports': Color(0xFFEA4335),
    'movies_tv': Color(0xFF9C27B0),
    'music': Color(0xFFE91E63),
    'science_tech': Color(0xFF00BCD4),
    'history': Color(0xFF8B4513),
    'geography': Color(0xFF4CAF50),
    'israel_local': Color(0xFF0099CC),
  };

  static Color getColor(String? category) {
    if (category == null || !colors.containsKey(category)) {
      return colors['general_knowledge'] ?? const Color(0xFF1A73E8);
    }
    return colors[category]!;
  }
}
