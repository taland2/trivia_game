import '../l10n/app_localizations.dart';

/// The 8 launch categories (GDD §3.4). Structural, not a ⚖️ balance value — the
/// ids mirror `CategorySchema` in `@trivia/api-contract`. Colors live in
/// `theme/category_colors.dart`; localized labels resolve here via [labelFor].
abstract class Categories {
  static const List<String> ids = [
    'general_knowledge',
    'sports',
    'movies_tv',
    'music',
    'science_tech',
    'history',
    'geography',
    'israel_local',
  ];

  /// Localized display name for a category id (falls back to the raw id).
  static String labelFor(AppLocalizations l, String id) => switch (id) {
        'general_knowledge' => l.categoryGeneralKnowledge,
        'sports' => l.categorySports,
        'movies_tv' => l.categoryMoviesTv,
        'music' => l.categoryMusic,
        'science_tech' => l.categoryScienceTech,
        'history' => l.categoryHistory,
        'geography' => l.categoryGeography,
        'israel_local' => l.categoryIsraelLocal,
        _ => id,
      };
}
