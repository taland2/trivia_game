import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/tokens.dart';

/// Scan a friend's invite QR in person (GDD §10.1). Returns the scanned code to
/// the caller (add_friend_screen), which redeems it. Camera-only; the manual
/// code-entry field on the add-friend screen is the no-camera fallback.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  bool _handled = false;

  // The QR encodes either the bare 8-char code or an invite link ending /i/{code}.
  String? _extractCode(String raw) {
    final v = raw.trim();
    if (RegExp(r'^[A-Za-z0-9]{8}$').hasMatch(v)) return v;
    final m = RegExp(r'/i/([A-Za-z0-9]{8})').firstMatch(v);
    return m?.group(1);
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final b in capture.barcodes) {
      final code = _extractCode(b.rawValue ?? '');
      if (code != null) {
        _handled = true;
        context.pop(code);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.scanQrTitle)),
      body: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          MobileScanner(onDetect: _onDetect),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Text(
              l.scanQrHint,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                backgroundColor: Colors.black54,
                fontSize: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
