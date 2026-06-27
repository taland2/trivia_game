/// Route paths + names (no magic strings at call sites). The four tab branches
/// live in the stateful shell; `/match/:matchId` is a top-level route rendered
/// full-screen ABOVE the tab bar (UX spec §2: no tab bar during a match).
abstract class Routes {
  static const home = '/';
  static const play = '/play';
  static const friends = '/friends';
  static const profile = '/profile';

  // Play-flow sub-routes (push within the Play tab; tab bar stays).
  static const friendPicker = 'pick'; // -> /play/pick
  static const categoryMode = 'mode'; // -> /play/mode

  // Profile sub-routes (push within the Profile tab; tab bar stays).
  static const settings = 'settings'; // -> /profile/settings
  static const editProfile = 'edit'; // -> /profile/edit

  // Friends sub-routes (push within the Friends tab; tab bar stays).
  static const friendsAdd = 'add'; // -> /friends/add
  static const friendsScan = 'scan'; // -> /friends/scan
  static const friendsMyQr = 'myqr'; // -> /friends/myqr
  static const friendsAddPath = '/friends/add';
  static const friendsScanPath = '/friends/scan';
  static const friendsMyQrPath = '/friends/myqr';

  // Full-screen match route on the root navigator.
  static String match(String matchId) => '/match/$matchId';
  static const matchPattern = '/match/:matchId';

  // Full-screen daily-challenge play flow on the root navigator (no tab bar).
  static const daily = '/daily';

  // Full-screen weekly leaderboard on the root navigator (reached from Home card).
  static const weekly = '/weekly';

  // Named routes for go() / pushNamed where useful.
  static const nameHome = 'home';
  static const namePlay = 'play';
  static const nameFriends = 'friends';
  static const nameProfile = 'profile';
  static const nameFriendPicker = 'friendPicker';
  static const nameCategoryMode = 'categoryMode';
  static const nameSettings = 'settings';
  static const nameMatch = 'match';
  static const nameDaily = 'daily';
  static const nameWeekly = 'weekly';
  static const nameEditProfile = 'editProfile';
  static const nameFriendsAdd = 'friendsAdd';
  static const nameFriendsScan = 'friendsScan';
  static const nameFriendsMyQr = 'friendsMyQr';
}
