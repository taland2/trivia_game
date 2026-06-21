import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/app_localizations.dart';
import '../theme/tokens.dart';

/// The one reusable async-state renderer (UX spec §3: every screen has
/// empty/loading/error/offline variants). Maps a Riverpod [AsyncValue] onto the
/// four states so screens never hand-roll loading spinners or error UI.
///
/// Established once here and reused everywhere; the offline banner slot is wired
/// now (real connectivity detection arrives in Phase 11).
class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
    this.isEmpty,
    this.emptyBuilder,
    this.loadingBuilder,
    this.isOffline = false,
  });

  /// The async state to render.
  final AsyncValue<T> value;

  /// Builds the loaded UI.
  final Widget Function(T data) data;

  /// Shown in the error state; if null, no retry button is offered.
  final VoidCallback? onRetry;

  /// Optional empty predicate — when true for the loaded value, [emptyBuilder]
  /// renders instead of [data].
  final bool Function(T data)? isEmpty;
  final WidgetBuilder? emptyBuilder;

  /// Optional custom loading widget (defaults to a centered branded spinner).
  final WidgetBuilder? loadingBuilder;

  /// When true, an offline banner is shown above whatever state renders.
  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final body = value.when(
      loading: () =>
          loadingBuilder?.call(context) ??
          const Center(child: CircularProgressIndicator()),
      error: (err, _) => _ErrorView(onRetry: onRetry),
      data: (d) {
        if (isEmpty != null && isEmpty!(d) && emptyBuilder != null) {
          return emptyBuilder!(context);
        }
        return data(d);
      },
    );

    if (!isOffline) return body;
    return Column(
      children: [
        const _OfflineBanner(),
        Expanded(child: body),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({this.onRetry});
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: AppSpacing.md),
            Text(l.commonError, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.lg),
              FilledButton(onPressed: onRetry, child: Text(l.commonRetry)),
            ],
          ],
        ),
      ),
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Material(
      color: AppColors.warning,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            vertical: AppSpacing.sm,
            horizontal: AppSpacing.md,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, color: Colors.white, size: 18),
              const SizedBox(width: AppSpacing.sm),
              Text(
                l.commonOffline,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
