import '../l10n/app_localizations.dart';

/// Category-selection mode for a duel (GDD §4.3). Wire values match the
/// `CategoryModeSchema` enum in `@trivia/api-contract` exactly.
enum CategoryMode {
  pick('pick'),
  spin('spin'),
  auto('auto');

  const CategoryMode(this.wire);

  /// The string sent to / received from Cloud Functions.
  final String wire;

  static CategoryMode fromWire(String value) =>
      CategoryMode.values.firstWhere((m) => m.wire == value, orElse: () => CategoryMode.spin);

  String label(AppLocalizations l) => switch (this) {
        CategoryMode.pick => l.categoryModePick,
        CategoryMode.spin => l.categoryModeSpin,
        CategoryMode.auto => l.categoryModeAuto,
      };

  String description(AppLocalizations l) => switch (this) {
        CategoryMode.pick => l.categoryModePickDesc,
        CategoryMode.spin => l.categoryModeSpinDesc,
        CategoryMode.auto => l.categoryModeAutoDesc,
      };
}
