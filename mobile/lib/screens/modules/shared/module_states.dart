import 'package:flutter/material.dart';

import '../../../config/stowbo_theme.dart';

/// The three states every module screen has to render, in one place so they
/// look identical across modules.
///
/// A blueprint is read as much as it is run: a client extending this app
/// should find loading, empty and failure already decided, not reinvented per
/// screen.

class ModuleLoading extends StatelessWidget {
  const ModuleLoading({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(top: SSpace.xxl),
        child: Center(
          child: CircularProgressIndicator(
              color: SColors.clay, strokeWidth: 2.5),
        ),
      );
}

/// A failure the person can act on. The server's own message is shown rather
/// than a generic apology — it is usually the only thing that says what to do.
class ModuleError extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ModuleError({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: const Color(0xFFFBEBEB),
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.danger, width: 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline_rounded,
                    size: 18, color: SColors.danger),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: Text(message,
                      style: const TextStyle(
                          color: SColors.danger, height: 1.35)),
                ),
              ],
            ),
            if (onRetry != null) ...[
              const SizedBox(height: SSpace.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: onRetry,
                  style: TextButton.styleFrom(
                      foregroundColor: SColors.danger,
                      padding: EdgeInsets.zero),
                  child: const Text('Try again'),
                ),
              ),
            ],
          ],
        ),
      );
}

class ModuleEmpty extends StatelessWidget {
  final IconData icon;
  final String title, body;
  const ModuleEmpty({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: SSpace.xxl),
        child: Column(
          children: [
            Icon(icon, size: 34, color: SColors.faint),
            const SizedBox(height: SSpace.md),
            Text(title,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center),
            const SizedBox(height: SSpace.xs),
            Text(body,
                textAlign: TextAlign.center,
                style: const TextStyle(color: SColors.muted, height: 1.4)),
          ],
        ),
      );
}
