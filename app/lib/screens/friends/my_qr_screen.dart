import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../l10n/app_localizations.dart';
import '../../services/social_service.dart';
import '../../theme/tokens.dart';
import '../../widgets/async_value_view.dart';

/// Show my invite code as a QR a friend can scan in person (GDD §10.1). The QR
/// encodes the 8-char code; scanning it (qr_scan_screen) redeems → instant
/// friendship + auto-duel. The shareable deep link is shown for copy; the install
/// path that turns the link into a deferred deep link lands in Phase 8b.
final _myInviteCodeProvider = FutureProvider.autoDispose<({String code, String link})>(
  (ref) => ref.read(socialApiProvider).issueInviteCode(),
);

class MyQrScreen extends ConsumerWidget {
  const MyQrScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final invite = ref.watch(_myInviteCodeProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.friendsMyQr)),
      body: AsyncValueView<({String code, String link})>(
        value: invite,
        onRetry: () => ref.invalidate(_myInviteCodeProvider),
        data: (inv) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  child: QrImageView(data: inv.code, size: 220),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(l.myQrShareCode, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                SelectableText(
                  inv.code,
                  style: const TextStyle(
                    fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 4),
                ),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton.icon(
                  icon: const Icon(Icons.copy),
                  label: Text(l.myQrCopyLink),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: inv.link));
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(SnackBar(content: Text(l.matchResultShareCopied)));
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
