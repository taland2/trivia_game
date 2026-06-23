import '../l10n/app_localizations.dart';

/// The predefined emote set (GDD §10.2). Keys MUST match the server's allowed set
/// (`functions/src/config/balance.ts` `emotes.set`); the server validates against
/// that list. Each key maps to a universal emoji plus a per-language label, so the
/// client never sends or stores free text (guardrail / doc 04 §7).
abstract class EmoteCatalog {
  /// Display order in the strip. Same membership as the server set.
  static const keys = <String>[
    'laugh',
    'fire',
    'revenge',
    'lucky',
    'wow',
    'clap',
    'gg',
    'think',
  ];

  static const _emoji = <String, String>{
    'laugh': '😂',
    'fire': '🔥',
    'revenge': '😈',
    'lucky': '🍀',
    'wow': '😮',
    'clap': '👏',
    'gg': '🤝',
    'think': '🤔',
  };

  static String emojiFor(String key) => _emoji[key] ?? '❓';

  /// Localized label (tooltip / screen-reader). Unknown keys fall back to the key.
  static String labelFor(AppLocalizations l, String key) => switch (key) {
        'laugh' => l.emoteLaugh,
        'fire' => l.emoteFire,
        'revenge' => l.emoteRevenge,
        'lucky' => l.emoteLucky,
        'wow' => l.emoteWow,
        'clap' => l.emoteClap,
        'gg' => l.emoteGg,
        'think' => l.emoteThink,
        _ => key,
      };
}
