// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Trivia';

  @override
  String get tabHome => 'Home';

  @override
  String get tabPlay => 'Play';

  @override
  String get tabFriends => 'Friends';

  @override
  String get tabProfile => 'Profile';

  @override
  String get homeTitle => 'Home';

  @override
  String get homePendingTurns => 'Your turns';

  @override
  String get homeYourTurn => 'Your turn!';

  @override
  String get homeWaitingForOpponent => 'Waiting for opponent';

  @override
  String get homeDailyCardTitle => 'Daily Challenge';

  @override
  String get homeDailyCardSoon => 'Coming soon';

  @override
  String get homeWeeklyCardTitle => 'Weekly Race';

  @override
  String get homeWeeklyCardSoon => 'Coming soon';

  @override
  String get homeEmptyTitle => 'No duels yet';

  @override
  String get homeEmptyBody => 'Invite a friend and start playing';

  @override
  String get homeEmptyCta => 'Start a duel';

  @override
  String get playTitle => 'Play';

  @override
  String get playStartDuel => 'New duel';

  @override
  String get playStartDuelSubtitle => 'Pick a friend and a category mode';

  @override
  String get friendPickerTitle => 'Pick an opponent';

  @override
  String get friendPickerEmpty => 'No friends available';

  @override
  String get categoryModeTitle => 'Category mode';

  @override
  String get categoryModePick => 'Player picks';

  @override
  String get categoryModePickDesc => 'Each round choose from 3 categories';

  @override
  String get categoryModeSpin => 'Spinner';

  @override
  String get categoryModeSpinDesc => 'A wheel lands on a random category';

  @override
  String get categoryModeAuto => 'Auto';

  @override
  String get categoryModeAutoDesc => 'The system picks a balanced spread';

  @override
  String get categoryGeneralKnowledge => 'General Knowledge';

  @override
  String get categorySports => 'Sports';

  @override
  String get categoryMoviesTv => 'Movies & TV';

  @override
  String get categoryMusic => 'Music';

  @override
  String get categoryScienceTech => 'Science & Tech';

  @override
  String get categoryHistory => 'History';

  @override
  String get categoryGeography => 'Geography';

  @override
  String get categoryIsraelLocal => 'Israel & Local';

  @override
  String get roundPickCategoryTitle => 'Pick a category';

  @override
  String get roundSpinning => 'Spinning...';

  @override
  String roundLandedOn(String category) {
    return 'Landed on $category';
  }

  @override
  String get friendsTitle => 'Friends';

  @override
  String get friendsComingSoon =>
      'Weekly leaderboard and friends are coming soon';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileGuest => 'Guest';

  @override
  String get profileSettings => 'Settings';

  @override
  String get profileComingSoon => 'Full settings are coming soon';

  @override
  String questionLabel(int current, int total) {
    return 'Question $current/$total';
  }

  @override
  String get difficultyEasy => 'Easy';

  @override
  String get difficultyMedium => 'Medium';

  @override
  String get difficultyHard => 'Hard';

  @override
  String get roundResultTitle => 'Round complete';

  @override
  String roundResultScore(int correct, int total) {
    return 'points · $correct/$total correct';
  }

  @override
  String roundResultQuestionLine(int number, String difficulty) {
    return 'Question $number — $difficulty';
  }

  @override
  String get roundResultBackHome => 'Back home';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonError => 'Something went wrong';

  @override
  String get commonOffline => 'No internet connection';

  @override
  String get commonLoading => 'Loading...';

  @override
  String matchVsOpponent(String opponent) {
    return 'vs $opponent';
  }

  @override
  String get recapTitle => 'Round recap';

  @override
  String get recapYouWonRound => 'You won this round!';

  @override
  String get recapOpponentWonRound => 'Your opponent took this round';

  @override
  String get recapYou => 'You';

  @override
  String get recapOpponent => 'Opponent';

  @override
  String get matchResultWin => 'You won!';

  @override
  String get matchResultLoss => 'You lost';

  @override
  String matchResultWeeklyPoints(int points) {
    return '+$points weekly points';
  }

  @override
  String get matchResultRematch => 'Rematch';

  @override
  String get matchResultShare => 'Share';

  @override
  String get matchResultShareCopied => 'Result copied';

  @override
  String matchResultShareText(int you, int them) {
    return 'I scored $you–$them in Trivia!';
  }

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsFeedback => 'Sound & haptics';

  @override
  String get settingsSound => 'Sound effects';

  @override
  String get settingsHaptics => 'Haptics';

  @override
  String get profileMatchHistory => 'Match history';

  @override
  String profileLevelXp(int level, int xp) {
    return 'Level $level · $xp XP';
  }

  @override
  String get emoteLimitReached => 'You\'ve used all your emotes this match';

  @override
  String get emoteLaugh => 'Haha';

  @override
  String get emoteFire => 'On fire';

  @override
  String get emoteRevenge => 'Revenge!';

  @override
  String get emoteLucky => 'Lucky';

  @override
  String get emoteWow => 'Wow';

  @override
  String get emoteClap => 'Nice';

  @override
  String get emoteGg => 'Good game';

  @override
  String get emoteThink => 'Hmm';
}
