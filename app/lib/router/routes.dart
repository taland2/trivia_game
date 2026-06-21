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

  // Full-screen match route on the root navigator.
  static String match(String matchId) => '/match/$matchId';
  static const matchPattern = '/match/:matchId';

  // Named routes for go() / pushNamed where useful.
  static const nameHome = 'home';
  static const namePlay = 'play';
  static const nameFriends = 'friends';
  static const nameProfile = 'profile';
  static const nameFriendPicker = 'friendPicker';
  static const nameCategoryMode = 'categoryMode';
  static const nameMatch = 'match';
}
