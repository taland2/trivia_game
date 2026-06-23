import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/emotes.dart';
import '../l10n/app_localizations.dart';
import '../screens/match/match_controller.dart';
import '../services/haptics_service.dart';
import '../state/emote_providers.dart';
import '../theme/tokens.dart';

/// Emote banter for the recap / match-result screens (GDD §10.2). Shows the
/// emotes already exchanged (live stream) and a strip of the 8 predefined emotes
/// to send. Sending is an integrity write through `v1_sendEmote` (server validates
/// the set + the per-match cap); the strip disables once the server reports no
/// sends remaining, so the cap value itself is never hardcoded on the client.
class EmoteStrip extends ConsumerStatefulWidget {
  const EmoteStrip({super.key, required this.matchId, required this.meUid});

  final String matchId;
  final String? meUid;

  @override
  ConsumerState<EmoteStrip> createState() => _EmoteStripState();
}

class _EmoteStripState extends ConsumerState<EmoteStrip> {
  int? _remaining; // null = unknown until the first send response
  bool _sending = false;

  Future<void> _send(String key) async {
    if (_sending || _remaining == 0) return;
    setState(() => _sending = true);
    try {
      final remaining = await ref
          .read(matchApiProvider)
          .sendEmote(matchId: widget.matchId, emote: key);
      HapticsService().lightTap();
      if (mounted) setState(() => _remaining = remaining);
    } on FirebaseFunctionsException catch (e) {
      // resource-exhausted => the per-match cap is reached; lock the strip.
      if (mounted && e.code == 'resource-exhausted') {
        setState(() => _remaining = 0);
        _toast(AppLocalizations.of(context).emoteLimitReached);
      }
    } catch (_) {
      // Best-effort banter — a transient failure is silently swallowed.
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final received = ref.watch(matchEmotesProvider(widget.matchId));
    final disabled = _remaining == 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        received.maybeWhen(
          data: (list) => _Received(emotes: list, meUid: widget.meUid),
          orElse: () => const SizedBox.shrink(),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final key in EmoteCatalog.keys)
              Semantics(
                button: true,
                enabled: !disabled,
                label: EmoteCatalog.labelFor(AppLocalizations.of(context), key),
                child: Tooltip(
                  message: EmoteCatalog.labelFor(AppLocalizations.of(context), key),
                  child: InkWell(
                    onTap: disabled ? null : () => _send(key),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    child: Opacity(
                      opacity: disabled ? 0.4 : 1.0,
                      child: Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        child: Text(
                          EmoteCatalog.emojiFor(key),
                          style: const TextStyle(fontSize: 26),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// The emotes exchanged so far — mine trail to one side, the opponent's to the
/// other, so the banter reads as a little conversation.
class _Received extends StatelessWidget {
  const _Received({required this.emotes, required this.meUid});

  final List<ReceivedEmote> emotes;
  final String? meUid;

  @override
  Widget build(BuildContext context) {
    if (emotes.isEmpty) return const SizedBox.shrink();
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: AppSpacing.xs,
      children: [
        for (final e in emotes)
          Opacity(
            opacity: e.senderUid == meUid ? 1.0 : 0.85,
            child: Text(
              EmoteCatalog.emojiFor(e.emote),
              style: const TextStyle(fontSize: 22),
            ),
          ),
      ],
    );
  }
}
