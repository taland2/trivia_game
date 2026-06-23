import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'firebase_providers.dart';

/// One emote read from `matches/{matchId}/emotes/*` (participant-readable; written
/// only by `v1_sendEmote`). The client renders these as banter on the recap /
/// match-result screens.
class ReceivedEmote {
  const ReceivedEmote({required this.senderUid, required this.emote});
  final String senderUid;
  final String emote;
}

/// Live stream of a match's emotes, oldest first. Keyed by matchId. Returns empty
/// while signed out / offline (rules deny non-participants, so a non-member simply
/// never sees data).
final matchEmotesProvider =
    StreamProvider.family<List<ReceivedEmote>, String>((ref, matchId) {
  final db = ref.watch(firestoreProvider);
  return db
      .collection('matches/$matchId/emotes')
      .orderBy('sentAt')
      .snapshots()
      .map((snap) => snap.docs.map((d) {
            final data = d.data();
            return ReceivedEmote(
              senderUid: (data['senderUid'] as String?) ?? '',
              emote: (data['emote'] as String?) ?? '',
            );
          }).toList());
});
