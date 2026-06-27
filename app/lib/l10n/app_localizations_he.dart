// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hebrew (`he`).
class AppLocalizationsHe extends AppLocalizations {
  AppLocalizationsHe([String locale = 'he']) : super(locale);

  @override
  String get appTitle => 'טריוויה';

  @override
  String get tabHome => 'בית';

  @override
  String get tabPlay => 'משחק';

  @override
  String get tabFriends => 'חברים';

  @override
  String get tabProfile => 'פרופיל';

  @override
  String get homeTitle => 'בית';

  @override
  String get homePendingTurns => 'תורות פתוחים';

  @override
  String get homeYourTurn => 'תורך!';

  @override
  String get homeWaitingForOpponent => 'ממתין ליריב';

  @override
  String get homeDailyCardTitle => 'אתגר יומי';

  @override
  String get homeDailyCardSoon => 'בקרוב';

  @override
  String get homeWeeklyCardTitle => 'מרוץ שבועי';

  @override
  String get homeWeeklyCardSoon => 'בקרוב';

  @override
  String get homeEmptyTitle => 'אין עדיין דו-קרבות';

  @override
  String get homeEmptyBody => 'הזמן חבר והתחילו לשחק';

  @override
  String get homeEmptyCta => 'התחל דו-קרב';

  @override
  String get dailyCardPlay => '10 שאלות · שחק עכשיו';

  @override
  String dailyCardDone(int score) {
    return 'שיחקת היום · $score נק׳';
  }

  @override
  String get dailyResultTitle => 'האתגר היומי הושלם!';

  @override
  String dailyResultStreak(int count) {
    return 'רצף של $count ימים';
  }

  @override
  String dailyShareText(int score) {
    return 'צברתי $score נקודות באתגר היומי של טריוויה 🔥 נסו לנצח אותי';
  }

  @override
  String get weeklyTitle => 'מרוץ שבועי';

  @override
  String weeklyYourRank(int rank) {
    return 'מקום #$rank';
  }

  @override
  String weeklyPointsLabel(int points) {
    return '$points נק׳';
  }

  @override
  String weeklyLevelLabel(int level) {
    return 'רמה $level';
  }

  @override
  String get weeklyEmptyTitle => 'המרוץ עוד לא התחיל';

  @override
  String get weeklyEmptyBody =>
      'הזמן חברים ושחקו — הניקוד השבועי שלכם יופיע כאן';

  @override
  String get weeklyEmptyCta => 'התחל דו-קרב';

  @override
  String get weeklyPodiumTitle => 'פודיום';

  @override
  String homeWeeklyRank(int rank) {
    return 'מקום #$rank השבוע';
  }

  @override
  String get homeWeeklyJoin => 'התחרו מול החברים השבוע';

  @override
  String get friendsTodayTitle => 'חברים היום';

  @override
  String get friendsTodayEmpty => 'אף חבר עוד לא שיחק היום';

  @override
  String get playTitle => 'משחק';

  @override
  String get playStartDuel => 'דו-קרב חדש';

  @override
  String get playStartDuelSubtitle => 'בחר חבר ומצב קטגוריה';

  @override
  String get friendPickerTitle => 'בחר יריב';

  @override
  String get friendPickerEmpty => 'אין חברים זמינים';

  @override
  String get categoryModeTitle => 'מצב בחירת קטגוריה';

  @override
  String get categoryModePick => 'בחירת שחקן';

  @override
  String get categoryModePickDesc => 'כל סבב בוחרים מתוך 3 קטגוריות';

  @override
  String get categoryModeSpin => 'גלגל';

  @override
  String get categoryModeSpinDesc => 'גלגל מזל בוחר קטגוריה אקראית';

  @override
  String get categoryModeAuto => 'אוטומטי';

  @override
  String get categoryModeAutoDesc => 'המערכת בוחרת מגוון מאוזן';

  @override
  String get categoryGeneralKnowledge => 'ידע כללי';

  @override
  String get categorySports => 'ספורט';

  @override
  String get categoryMoviesTv => 'קולנוע וטלוויזיה';

  @override
  String get categoryMusic => 'מוזיקה';

  @override
  String get categoryScienceTech => 'מדע וטכנולוגיה';

  @override
  String get categoryHistory => 'היסטוריה';

  @override
  String get categoryGeography => 'גיאוגרפיה';

  @override
  String get categoryIsraelLocal => 'ישראל ומקומי';

  @override
  String get roundPickCategoryTitle => 'בחר קטגוריה';

  @override
  String get roundSpinning => 'מסובב...';

  @override
  String roundLandedOn(String category) {
    return 'יצא: $category';
  }

  @override
  String get friendsTitle => 'חברים';

  @override
  String get friendsComingSoon => 'הלוח השבועי והחברים יגיעו בקרוב';

  @override
  String get friendsMyQr => 'ה-QR שלי';

  @override
  String get friendsAddTitle => 'הוספת חבר';

  @override
  String get friendsRequestsTitle => 'בקשות חברות';

  @override
  String get friendsAccept => 'אישור';

  @override
  String get friendsDecline => 'דחייה';

  @override
  String get friendsBlock => 'חסימה';

  @override
  String get friendsUnfriend => 'הסרת חבר';

  @override
  String get friendsUnfriendConfirm => 'להסיר את החבר?';

  @override
  String get friendsBlockConfirm => 'לחסום את המשתמש?';

  @override
  String get friendsEmptyTitle => 'עדיין אין חברים';

  @override
  String get friendsEmptyBody => 'הוסיפו חברים לפי שם משתמש, QR או קוד הזמנה';

  @override
  String get commonCancel => 'ביטול';

  @override
  String get commonConfirm => 'אישור';

  @override
  String get addFriendSearchHint => 'חיפוש לפי שם משתמש';

  @override
  String get addFriendSend => 'שליחת בקשה';

  @override
  String get addFriendSent => 'נשלח';

  @override
  String get inviteCodeTitle => 'קוד הזמנה';

  @override
  String get inviteCodeHint => 'הזינו קוד בן 8 תווים';

  @override
  String get inviteCodeInvalid => 'קוד לא תקין';

  @override
  String get inviteRedeemed => 'התווסף חבר!';

  @override
  String get scanQrTitle => 'סריקת QR';

  @override
  String get scanQrHint => 'כוונו את המצלמה אל ה-QR של החבר';

  @override
  String get myQrShareCode => 'הקוד שלך';

  @override
  String get myQrCopyLink => 'העתקת קישור';

  @override
  String get editProfileTitle => 'עריכת פרופיל';

  @override
  String get editProfileDisplayName => 'שם תצוגה';

  @override
  String get editProfileAvatar => 'אווטאר';

  @override
  String get editProfileSearchable => 'ניתן לחיפוש';

  @override
  String get editProfileSearchableHint =>
      'אפשרו לחברים למצוא אתכם לפי שם משתמש';

  @override
  String get editProfileSave => 'שמירה';

  @override
  String get editProfileSaved => 'נשמר';

  @override
  String get editProfileUsername => 'שם משתמש';

  @override
  String get usernameClaimed => 'שם המשתמש נתפס בהצלחה';

  @override
  String get usernameTaken => 'שם המשתמש כבר תפוס';

  @override
  String get usernameProfane => 'שם המשתמש אינו מורשה';

  @override
  String get usernameInvalid => 'שם משתמש לא תקין (3–20 תווים, a–z 0–9 _)';

  @override
  String get deleteAccount => 'מחיקת חשבון';

  @override
  String get deleteAccountWarning =>
      'פעולה זו תמחק את החשבון ותעניק ניצחון ליריבים במשחקים הפעילים. לא ניתן לבטל.';

  @override
  String get profileTitle => 'פרופיל';

  @override
  String get profileGuest => 'אורח';

  @override
  String get profileSettings => 'הגדרות';

  @override
  String get profileComingSoon => 'ההגדרות המלאות יגיעו בקרוב';

  @override
  String questionLabel(int current, int total) {
    return 'שאלה $current/$total';
  }

  @override
  String get difficultyEasy => 'קל';

  @override
  String get difficultyMedium => 'בינוני';

  @override
  String get difficultyHard => 'קשה';

  @override
  String get roundResultTitle => 'סיום סבב';

  @override
  String roundResultScore(int correct, int total) {
    return 'נקודות · $correct/$total נכון';
  }

  @override
  String roundResultQuestionLine(int number, String difficulty) {
    return 'שאלה $number — $difficulty';
  }

  @override
  String get roundResultBackHome => 'חזרה לבית';

  @override
  String get commonRetry => 'נסה שוב';

  @override
  String get commonError => 'משהו השתבש';

  @override
  String get commonOffline => 'אין חיבור לאינטרנט';

  @override
  String get commonLoading => 'טוען...';

  @override
  String matchVsOpponent(String opponent) {
    return 'מול $opponent';
  }

  @override
  String get recapTitle => 'סיכום הסבב';

  @override
  String get recapYouWonRound => 'ניצחת בסבב הזה!';

  @override
  String get recapOpponentWonRound => 'היריב לקח את הסבב הזה';

  @override
  String get recapYou => 'את/ה';

  @override
  String get recapOpponent => 'יריב';

  @override
  String get matchResultWin => 'ניצחת!';

  @override
  String get matchResultLoss => 'הפסדת';

  @override
  String matchResultWeeklyPoints(int points) {
    return '+$points נקודות שבועיות';
  }

  @override
  String get matchResultRematch => 'ריאנץ\'';

  @override
  String get matchResultShare => 'שיתוף';

  @override
  String get matchResultShareCopied => 'התוצאה הועתקה';

  @override
  String matchResultShareText(int you, int them) {
    return 'ניצחתי $you–$them בטריוויה!';
  }

  @override
  String get settingsTitle => 'הגדרות';

  @override
  String get settingsLanguage => 'שפה';

  @override
  String get settingsFeedback => 'צליל ומישוש';

  @override
  String get settingsSound => 'אפקטים קוליים';

  @override
  String get settingsHaptics => 'רטט';

  @override
  String get profileMatchHistory => 'היסטוריית משחקים';

  @override
  String profileLevelXp(int level, int xp) {
    return 'רמה $level · $xp נק׳ ניסיון';
  }

  @override
  String get emoteLimitReached => 'ניצלת את כל האימוג׳ים במשחק הזה';

  @override
  String get emoteLaugh => 'חחח';

  @override
  String get emoteFire => 'אש';

  @override
  String get emoteRevenge => 'נקמה!';

  @override
  String get emoteLucky => 'מזל';

  @override
  String get emoteWow => 'וואו';

  @override
  String get emoteClap => 'כל הכבוד';

  @override
  String get emoteGg => 'משחק טוב';

  @override
  String get emoteThink => 'הממ';
}
