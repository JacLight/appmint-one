import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/driver_provider.dart';

/// What this driver has been paid.
class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});
  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => context.read<DriverProvider>().loadPayouts());
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final total = driver.paidTotal;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => driver.loadPayouts(),
          child: ListView(
            padding: const EdgeInsets.all(SSpace.xl),
            children: [
              Text('Earnings',
                  style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.xl),
              if (total != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(SSpace.xl),
                  decoration: BoxDecoration(
                    color: SColors.card,
                    borderRadius: BorderRadius.circular(SRadius.xl),
                    border: Border.all(color: SColors.line),
                    boxShadow: SShadow.soft,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Paid out',
                          style: TextStyle(color: SColors.muted, fontSize: 13)),
                      const SizedBox(height: SSpace.xs),
                      Text(total.toStringAsFixed(2),
                          style: const TextStyle(
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              height: 1.1,
                              color: SColors.ink)),
                    ],
                  ),
                ),
              const SizedBox(height: SSpace.xl),
              if (driver.loadingPayouts)
                const Center(
                    child: Padding(
                  padding: EdgeInsets.only(top: SSpace.lg),
                  child: CircularProgressIndicator(
                      color: SColors.clay, strokeWidth: 2.5),
                ))
              else if (driver.payoutsError != null)
                Text(driver.payoutsError!,
                    style: const TextStyle(color: SColors.danger, height: 1.4))
              else if (driver.payouts.isEmpty)
                const Text(
                  'No payouts yet. Completed work appears here once it has '
                  'been paid out.',
                  style: TextStyle(color: SColors.muted, height: 1.4),
                )
              else ...[
                Text('Payouts',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: SSpace.md),
                ...driver.payouts.map((p) => _PayoutRow(payout: p)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PayoutRow extends StatelessWidget {
  final Map<String, dynamic> payout;
  const _PayoutRow({required this.payout});

  @override
  Widget build(BuildContext context) {
    final amount = payout['amount'] ?? payout['total'] ?? payout['net'];
    final status = '${payout['status'] ?? ''}';
    final when = payout['paidAt'] ?? payout['createdate'] ?? payout['date'];

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (status.isNotEmpty)
                    Text(status,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, color: SColors.ink)),
                  if (when != null) ...[
                    const SizedBox(height: 2),
                    Text('$when'.split('T').first,
                        style: const TextStyle(
                            color: SColors.faint, fontSize: 12)),
                  ],
                ],
              ),
            ),
            if (amount != null)
              Text(
                  (amount is num
                      ? amount.toStringAsFixed(2)
                      : '$amount'),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: SColors.ink)),
          ],
        ),
      ),
    );
  }
}
