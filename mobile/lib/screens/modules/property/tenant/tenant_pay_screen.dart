import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/tenancy_provider.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';

/// Rent: what is owed, what has been paid, and the one button that settles it.
class TenantPayScreen extends StatelessWidget {
  const TenantPayScreen({super.key});

  static String _sym(String currency) => switch (currency.toUpperCase()) {
        'USD' => '\$',
        'GBP' => '£',
        'EUR' => '€',
        _ => '$currency ',
      };

  @override
  Widget build(BuildContext context) {
    final t = context.watch<TenancyProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final home = t.current;
    final s = home?['paymentSummary'];
    final sum = s is Map ? Map<String, dynamic>.from(s) : const {};
    final currency = '${sum['currency'] ?? home?['currency'] ?? 'USD'}';
    final sym = _sym(currency);

    double? n(dynamic v) => v is num ? v.toDouble() : null;
    final balance = n(sum['balance']);
    final total = n(sum['total']);
    final paid = n(sum['towardBill'] ?? sum['paid']);
    final deposit = sum['deposit'];

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: t.load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
              child: Text(
                'Rent',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                ),
              ),
            ),
            if (t.loading && home == null)
              const ModuleLoading()
            else if (t.partialError('tenancy') != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                    message: t.partialError('tenancy')!, onRetry: t.load),
              )
            else if (home == null)
              const Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.receipt_long_rounded,
                  title: 'No rent to show',
                  body:
                      'Rent, the deposit and every payment appear here once a '
                      'tenancy starts.',
                ),
              )
            else ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(SSpace.xl),
                  decoration: BoxDecoration(
                    color: SColors.card,
                    borderRadius: BorderRadius.circular(SRadius.xl),
                    boxShadow: SShadow.soft,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        balance == null
                            ? 'Balance'
                            : balance <= 0
                                ? 'All paid up'
                                : 'Owed now',
                        style: const TextStyle(
                            color: SColors.muted, fontSize: 12.5),
                      ),
                      const SizedBox(height: SSpace.xs),
                      Text(
                        balance == null
                            ? 'Not shown'
                            : '$sym${balance.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 38,
                          height: 1.05,
                          fontWeight: FontWeight.w800,
                          color: balance != null && balance > 0
                              ? SColors.ink
                              : SColors.green,
                        ),
                      ),
                      if (balance == null)
                        const Padding(
                          padding: EdgeInsets.only(top: SSpace.sm),
                          child: Text(
                            // Honest about why: the figure is the server's,
                            // and inventing one here would be worse than
                            // saying nothing.
                            'The office has not posted a balance for this '
                            'tenancy yet.',
                            style: TextStyle(
                                color: SColors.muted,
                                fontSize: 12.5,
                                height: 1.35),
                          ),
                        ),
                      if (balance != null && balance > 0) ...[
                        const SizedBox(height: SSpace.lg),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: brand.primary,
                              padding: const EdgeInsets.symmetric(
                                  vertical: SSpace.md + 4),
                              shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(SRadius.pill)),
                            ),
                            onPressed: t.paying || kIsWeb
                                ? null
                                : () async {
                                    final email = context
                                        .read<AuthProvider>()
                                        .user
                                        ?.email;
                                    final taken =
                                        await t.payRent(email: email);
                                    if (!context.mounted) return;
                                    if (taken != null) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                        backgroundColor: SColors.green,
                                        content: Text(
                                            'Paid $sym${taken.toStringAsFixed(2)}. Thank you.'),
                                      ));
                                    } else if (t.error != null) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                        backgroundColor: SColors.danger,
                                        content: Text(t.error!),
                                      ));
                                    }
                                  },
                            child: t.paying
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white))
                                : Text(
                                    kIsWeb
                                        ? 'Pay in the app'
                                        : 'Pay $sym${balance.toStringAsFixed(2)}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 15)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              if (total != null || paid != null) ...[
                const SectionHead(title: 'This tenancy'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                  child: Container(
                    padding: const EdgeInsets.all(SSpace.lg),
                    decoration: BoxDecoration(
                      color: SColors.card,
                      borderRadius: BorderRadius.circular(SRadius.md),
                      border: Border.all(color: SColors.line),
                    ),
                    child: Column(
                      children: [
                        if (total != null)
                          _Row(k: 'Charged', v: '$sym${total.toStringAsFixed(2)}'),
                        if (paid != null)
                          _Row(k: 'Paid', v: '$sym${paid.toStringAsFixed(2)}'),
                        if (n(sum['refunded']) != null && n(sum['refunded'])! > 0)
                          _Row(
                              k: 'Refunded',
                              v: '$sym${n(sum['refunded'])!.toStringAsFixed(2)}'),
                        if (deposit is Map) ...[
                          const Divider(
                              height: SSpace.xl, color: SColors.line2),
                          _Row(
                            k: 'Deposit',
                            v: n(deposit['amount']) == null
                                ? '${deposit['status'] ?? '—'}'
                                : '$sym${n(deposit['amount'])!.toStringAsFixed(2)}'
                                    ' · ${deposit['status'] ?? 'held'}',
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
              const SectionHead(title: 'How rent is taken'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Container(
                  padding: const EdgeInsets.all(SSpace.lg),
                  decoration: BoxDecoration(
                    color: brand.accent.withValues(alpha: 0.09),
                    borderRadius: BorderRadius.circular(SRadius.md),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.lock_rounded, size: 17, color: brand.accent),
                      const SizedBox(width: SSpace.md),
                      Expanded(
                        child: Text(
                          'Card and bank payments are handled by the payment '
                          'provider. ${CurrentSetup.brand.name} never sees or '
                          'stores your card number, and every payment is '
                          'receipted against this ${words.lower(LexiconKeys.lease)}.',
                          style: const TextStyle(
                              color: SColors.ink2,
                              fontSize: 12.5,
                              height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String k, v;
  const _Row({required this.k, required this.v});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.sm),
        child: Row(
          children: [
            Expanded(
              child: Text(k,
                  style: const TextStyle(color: SColors.muted, fontSize: 13)),
            ),
            Text(v,
                style: const TextStyle(
                    color: SColors.ink,
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5)),
          ],
        ),
      );
}
