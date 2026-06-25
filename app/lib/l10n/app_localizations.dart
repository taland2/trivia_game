import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_he.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('he'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In he, this message translates to:
  /// **'טריוויה'**
  String get appTitle;

  /// No description provided for @tabHome.
  ///
  /// In he, this message translates to:
  /// **'בית'**
  String get tabHome;

  /// No description provided for @tabPlay.
  ///
  /// In he, this message translates to:
  /// **'משחק'**
  String get tabPlay;

  /// No description provided for @tabFriends.
  ///
  /// In he, this message translates to:
  /// **'חברים'**
  String get tabFriends;

  /// No description provided for @tabProfile.
  ///
  /// In he, this message translates to:
  /// **'פרופיל'**
  String get tabProfile;

  /// No description provided for @homeTitle.
  ///
  /// In he, this message translates to:
  /// **'בית'**
  String get homeTitle;

  /// No description provided for @homePendingTurns.
  ///
  /// In he, this message translates to:
  /// **'תורות פתוחים'**
  String get homePendingTurns;

  /// No description provided for @homeYourTurn.
  ///
  /// In he, this message translates to:
  /// **'תורך!'**
  String get homeYourTurn;

  /// No description provided for @homeWaitingForOpponent.
  ///
  /// In he, this message translates to:
  /// **'ממתין ליריב'**
  String get homeWaitingForOpponent;

  /// No description provided for @homeDailyCardTitle.
  ///
  /// In he, this message translates to:
  /// **'אתגר יומי'**
  String get homeDailyCardTitle;

  /// No description provided for @homeDailyCardSoon.
  ///
  /// In he, this message translates to:
  /// **'בקרוב'**
  String get homeDailyCardSoon;

  /// No description provided for @homeWeeklyCardTitle.
  ///
  /// In he, this message translates to:
  /// **'מרוץ שבועי'**
  String get homeWeeklyCardTitle;

  /// No description provided for @homeWeeklyCardSoon.
  ///
  /// In he, this message translates to:
  /// **'בקרוב'**
  String get homeWeeklyCardSoon;

  /// No description provided for @homeEmptyTitle.
  ///
  /// In he, this message translates to:
  /// **'אין עדיין דו-קרבות'**
  String get homeEmptyTitle;

  /// No description provided for @homeEmptyBody.
  ///
  /// In he, this message translates to:
  /// **'הזמן חבר והתחילו לשחק'**
  String get homeEmptyBody;

  /// No description provided for @homeEmptyCta.
  ///
  /// In he, this message translates to:
  /// **'התחל דו-קרב'**
  String get homeEmptyCta;

  /// No description provided for @dailyCardPlay.
  ///
  /// In he, this message translates to:
  /// **'10 שאלות · שחק עכשיו'**
  String get dailyCardPlay;

  /// No description provided for @dailyCardDone.
  ///
  /// In he, this message translates to:
  /// **'שיחקת היום · {score} נק׳'**
  String dailyCardDone(int score);

  /// No description provided for @dailyResultTitle.
  ///
  /// In he, this message translates to:
  /// **'האתגר היומי הושלם!'**
  String get dailyResultTitle;

  /// No description provided for @dailyResultStreak.
  ///
  /// In he, this message translates to:
  /// **'רצף של {count} ימים'**
  String dailyResultStreak(int count);

  /// No description provided for @dailyShareText.
  ///
  /// In he, this message translates to:
  /// **'צברתי {score} נקודות באתגר היומי של טריוויה 🔥 נסו לנצח אותי'**
  String dailyShareText(int score);

  /// No description provided for @playTitle.
  ///
  /// In he, this message translates to:
  /// **'משחק'**
  String get playTitle;

  /// No description provided for @playStartDuel.
  ///
  /// In he, this message translates to:
  /// **'דו-קרב חדש'**
  String get playStartDuel;

  /// No description provided for @playStartDuelSubtitle.
  ///
  /// In he, this message translates to:
  /// **'בחר חבר ומצב קטגוריה'**
  String get playStartDuelSubtitle;

  /// No description provided for @friendPickerTitle.
  ///
  /// In he, this message translates to:
  /// **'בחר יריב'**
  String get friendPickerTitle;

  /// No description provided for @friendPickerEmpty.
  ///
  /// In he, this message translates to:
  /// **'אין חברים זמינים'**
  String get friendPickerEmpty;

  /// No description provided for @categoryModeTitle.
  ///
  /// In he, this message translates to:
  /// **'מצב בחירת קטגוריה'**
  String get categoryModeTitle;

  /// No description provided for @categoryModePick.
  ///
  /// In he, this message translates to:
  /// **'בחירת שחקן'**
  String get categoryModePick;

  /// No description provided for @categoryModePickDesc.
  ///
  /// In he, this message translates to:
  /// **'כל סבב בוחרים מתוך 3 קטגוריות'**
  String get categoryModePickDesc;

  /// No description provided for @categoryModeSpin.
  ///
  /// In he, this message translates to:
  /// **'גלגל'**
  String get categoryModeSpin;

  /// No description provided for @categoryModeSpinDesc.
  ///
  /// In he, this message translates to:
  /// **'גלגל מזל בוחר קטגוריה אקראית'**
  String get categoryModeSpinDesc;

  /// No description provided for @categoryModeAuto.
  ///
  /// In he, this message translates to:
  /// **'אוטומטי'**
  String get categoryModeAuto;

  /// No description provided for @categoryModeAutoDesc.
  ///
  /// In he, this message translates to:
  /// **'המערכת בוחרת מגוון מאוזן'**
  String get categoryModeAutoDesc;

  /// No description provided for @categoryGeneralKnowledge.
  ///
  /// In he, this message translates to:
  /// **'ידע כללי'**
  String get categoryGeneralKnowledge;

  /// No description provided for @categorySports.
  ///
  /// In he, this message translates to:
  /// **'ספורט'**
  String get categorySports;

  /// No description provided for @categoryMoviesTv.
  ///
  /// In he, this message translates to:
  /// **'קולנוע וטלוויזיה'**
  String get categoryMoviesTv;

  /// No description provided for @categoryMusic.
  ///
  /// In he, this message translates to:
  /// **'מוזיקה'**
  String get categoryMusic;

  /// No description provided for @categoryScienceTech.
  ///
  /// In he, this message translates to:
  /// **'מדע וטכנולוגיה'**
  String get categoryScienceTech;

  /// No description provided for @categoryHistory.
  ///
  /// In he, this message translates to:
  /// **'היסטוריה'**
  String get categoryHistory;

  /// No description provided for @categoryGeography.
  ///
  /// In he, this message translates to:
  /// **'גיאוגרפיה'**
  String get categoryGeography;

  /// No description provided for @categoryIsraelLocal.
  ///
  /// In he, this message translates to:
  /// **'ישראל ומקומי'**
  String get categoryIsraelLocal;

  /// No description provided for @roundPickCategoryTitle.
  ///
  /// In he, this message translates to:
  /// **'בחר קטגוריה'**
  String get roundPickCategoryTitle;

  /// No description provided for @roundSpinning.
  ///
  /// In he, this message translates to:
  /// **'מסובב...'**
  String get roundSpinning;

  /// No description provided for @roundLandedOn.
  ///
  /// In he, this message translates to:
  /// **'יצא: {category}'**
  String roundLandedOn(String category);

  /// No description provided for @friendsTitle.
  ///
  /// In he, this message translates to:
  /// **'חברים'**
  String get friendsTitle;

  /// No description provided for @friendsComingSoon.
  ///
  /// In he, this message translates to:
  /// **'הלוח השבועי והחברים יגיעו בקרוב'**
  String get friendsComingSoon;

  /// No description provided for @profileTitle.
  ///
  /// In he, this message translates to:
  /// **'פרופיל'**
  String get profileTitle;

  /// No description provided for @profileGuest.
  ///
  /// In he, this message translates to:
  /// **'אורח'**
  String get profileGuest;

  /// No description provided for @profileSettings.
  ///
  /// In he, this message translates to:
  /// **'הגדרות'**
  String get profileSettings;

  /// No description provided for @profileComingSoon.
  ///
  /// In he, this message translates to:
  /// **'ההגדרות המלאות יגיעו בקרוב'**
  String get profileComingSoon;

  /// No description provided for @questionLabel.
  ///
  /// In he, this message translates to:
  /// **'שאלה {current}/{total}'**
  String questionLabel(int current, int total);

  /// No description provided for @difficultyEasy.
  ///
  /// In he, this message translates to:
  /// **'קל'**
  String get difficultyEasy;

  /// No description provided for @difficultyMedium.
  ///
  /// In he, this message translates to:
  /// **'בינוני'**
  String get difficultyMedium;

  /// No description provided for @difficultyHard.
  ///
  /// In he, this message translates to:
  /// **'קשה'**
  String get difficultyHard;

  /// No description provided for @roundResultTitle.
  ///
  /// In he, this message translates to:
  /// **'סיום סבב'**
  String get roundResultTitle;

  /// No description provided for @roundResultScore.
  ///
  /// In he, this message translates to:
  /// **'נקודות · {correct}/{total} נכון'**
  String roundResultScore(int correct, int total);

  /// No description provided for @roundResultQuestionLine.
  ///
  /// In he, this message translates to:
  /// **'שאלה {number} — {difficulty}'**
  String roundResultQuestionLine(int number, String difficulty);

  /// No description provided for @roundResultBackHome.
  ///
  /// In he, this message translates to:
  /// **'חזרה לבית'**
  String get roundResultBackHome;

  /// No description provided for @commonRetry.
  ///
  /// In he, this message translates to:
  /// **'נסה שוב'**
  String get commonRetry;

  /// No description provided for @commonError.
  ///
  /// In he, this message translates to:
  /// **'משהו השתבש'**
  String get commonError;

  /// No description provided for @commonOffline.
  ///
  /// In he, this message translates to:
  /// **'אין חיבור לאינטרנט'**
  String get commonOffline;

  /// No description provided for @commonLoading.
  ///
  /// In he, this message translates to:
  /// **'טוען...'**
  String get commonLoading;

  /// No description provided for @matchVsOpponent.
  ///
  /// In he, this message translates to:
  /// **'מול {opponent}'**
  String matchVsOpponent(String opponent);

  /// No description provided for @recapTitle.
  ///
  /// In he, this message translates to:
  /// **'סיכום הסבב'**
  String get recapTitle;

  /// No description provided for @recapYouWonRound.
  ///
  /// In he, this message translates to:
  /// **'ניצחת בסבב הזה!'**
  String get recapYouWonRound;

  /// No description provided for @recapOpponentWonRound.
  ///
  /// In he, this message translates to:
  /// **'היריב לקח את הסבב הזה'**
  String get recapOpponentWonRound;

  /// No description provided for @recapYou.
  ///
  /// In he, this message translates to:
  /// **'את/ה'**
  String get recapYou;

  /// No description provided for @recapOpponent.
  ///
  /// In he, this message translates to:
  /// **'יריב'**
  String get recapOpponent;

  /// No description provided for @matchResultWin.
  ///
  /// In he, this message translates to:
  /// **'ניצחת!'**
  String get matchResultWin;

  /// No description provided for @matchResultLoss.
  ///
  /// In he, this message translates to:
  /// **'הפסדת'**
  String get matchResultLoss;

  /// No description provided for @matchResultWeeklyPoints.
  ///
  /// In he, this message translates to:
  /// **'+{points} נקודות שבועיות'**
  String matchResultWeeklyPoints(int points);

  /// No description provided for @matchResultRematch.
  ///
  /// In he, this message translates to:
  /// **'ריאנץ\''**
  String get matchResultRematch;

  /// No description provided for @matchResultShare.
  ///
  /// In he, this message translates to:
  /// **'שיתוף'**
  String get matchResultShare;

  /// No description provided for @matchResultShareCopied.
  ///
  /// In he, this message translates to:
  /// **'התוצאה הועתקה'**
  String get matchResultShareCopied;

  /// No description provided for @matchResultShareText.
  ///
  /// In he, this message translates to:
  /// **'ניצחתי {you}–{them} בטריוויה!'**
  String matchResultShareText(int you, int them);

  /// No description provided for @settingsTitle.
  ///
  /// In he, this message translates to:
  /// **'הגדרות'**
  String get settingsTitle;

  /// No description provided for @settingsLanguage.
  ///
  /// In he, this message translates to:
  /// **'שפה'**
  String get settingsLanguage;

  /// No description provided for @settingsFeedback.
  ///
  /// In he, this message translates to:
  /// **'צליל ומישוש'**
  String get settingsFeedback;

  /// No description provided for @settingsSound.
  ///
  /// In he, this message translates to:
  /// **'אפקטים קוליים'**
  String get settingsSound;

  /// No description provided for @settingsHaptics.
  ///
  /// In he, this message translates to:
  /// **'רטט'**
  String get settingsHaptics;

  /// No description provided for @profileMatchHistory.
  ///
  /// In he, this message translates to:
  /// **'היסטוריית משחקים'**
  String get profileMatchHistory;

  /// No description provided for @profileLevelXp.
  ///
  /// In he, this message translates to:
  /// **'רמה {level} · {xp} נק׳ ניסיון'**
  String profileLevelXp(int level, int xp);

  /// No description provided for @emoteLimitReached.
  ///
  /// In he, this message translates to:
  /// **'ניצלת את כל האימוג׳ים במשחק הזה'**
  String get emoteLimitReached;

  /// No description provided for @emoteLaugh.
  ///
  /// In he, this message translates to:
  /// **'חחח'**
  String get emoteLaugh;

  /// No description provided for @emoteFire.
  ///
  /// In he, this message translates to:
  /// **'אש'**
  String get emoteFire;

  /// No description provided for @emoteRevenge.
  ///
  /// In he, this message translates to:
  /// **'נקמה!'**
  String get emoteRevenge;

  /// No description provided for @emoteLucky.
  ///
  /// In he, this message translates to:
  /// **'מזל'**
  String get emoteLucky;

  /// No description provided for @emoteWow.
  ///
  /// In he, this message translates to:
  /// **'וואו'**
  String get emoteWow;

  /// No description provided for @emoteClap.
  ///
  /// In he, this message translates to:
  /// **'כל הכבוד'**
  String get emoteClap;

  /// No description provided for @emoteGg.
  ///
  /// In he, this message translates to:
  /// **'משחק טוב'**
  String get emoteGg;

  /// No description provided for @emoteThink.
  ///
  /// In he, this message translates to:
  /// **'הממ'**
  String get emoteThink;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'he'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'he':
      return AppLocalizationsHe();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
