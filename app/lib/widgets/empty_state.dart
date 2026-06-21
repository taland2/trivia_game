import 'package:flutter/material.dart';
import '../theme/tokens.dart';

/// A centered hero for empty screens (UX spec §3 "system states"): icon, title,
/// optional body, and an optional primary CTA. Reused for zero-friends, no-match,
/// and "a race needs runners" cases.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.body,
    this.ctaLabel,
    this.onCta,
  });

  final IconData icon;
  final String title;
  final String? body;
  final String? ctaLabel;
  final VoidCallback? onCta;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: theme.colorScheme.primary),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            if (body != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                body!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (ctaLabel != null && onCta != null) ...[
              const SizedBox(height: AppSpacing.xl),
              FilledButton(onPressed: onCta, child: Text(ctaLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
