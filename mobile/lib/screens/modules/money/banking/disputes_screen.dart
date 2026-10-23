import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import 'banking_widgets.dart';

/// Customer view of the existing bank dispute workflow. Decisions and clocks
/// come from the server; withdrawing uses its existing customer action.
class DisputesScreen extends StatefulWidget {
  const DisputesScreen({super.key});
  @override
  State<DisputesScreen> createState() => _DisputesScreenState();
}

class _DisputesScreenState extends State<DisputesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<BankingProvider>().loadDisputes();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bank = context.watch<BankingProvider>();
    final error = bank.sectionError('disputes');
    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(title: const Text('My disputes')),
      body: RefreshIndicator(
        onRefresh: bank.loadDisputes,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(SSpace.lg),
          children: [
            if (error != null)
              ModuleError(message: error, onRetry: bank.loadDisputes)
            else if (bank.disputes.isEmpty)
              const ModuleEmpty(
                icon: Icons.gavel_outlined,
                title: 'No disputes',
                body:
                    'Claims you file from a transaction appear here with their status and the bank’s response.',
              ),
            for (final claim in bank.disputes)
              Card(
                child: ExpansionTile(
                  title: Text(
                    'Dispute ${claim['number'] ?? BankingProvider.idOf(claim)}',
                  ),
                  subtitle: Text(
                    '${claim['status'] ?? ''} · ${Money.format(claim['amount'])}',
                  ),
                  childrenPadding: const EdgeInsets.all(SSpace.md),
                  children: [
                    FactRow(
                      label: 'Reason',
                      value: '${claim['reason'] ?? ''}'.replaceAll('_', ' '),
                    ),
                    if ('${claim['description'] ?? ''}'.isNotEmpty)
                      Text('${claim['description']}'),
                    if (claim['decideBy'] != null)
                      FactRow(
                        label: 'Decision due',
                        value: '${claim['decideBy']}',
                      ),
                    if (claim['resolveBy'] != null)
                      FactRow(
                        label: 'Resolution due',
                        value: '${claim['resolveBy']}',
                      ),
                    if ('${claim['resolution'] ?? ''}'.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          vertical: SSpace.md,
                        ),
                        child: Text('${claim['resolution']}'),
                      ),
                    if (claim['notices'] is List)
                      for (final notice
                          in (claim['notices'] as List).whereType<Map>())
                        FactRow(
                          label: '${notice['kind'] ?? 'Notice'}'.replaceAll(
                            '_',
                            ' ',
                          ),
                          value:
                              '${notice['sentAt'] ?? ''} · ${notice['channel'] ?? ''}',
                        ),
                    if (!['won', 'lost', 'withdrawn'].contains(claim['status']))
                      TextButton(
                        onPressed: bank.busy
                            ? null
                            : () => _withdraw(context, bank, claim),
                        child: const Text('Withdraw this dispute'),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _withdraw(
    BuildContext context,
    BankingProvider bank,
    Map<String, dynamic> claim,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Withdraw this dispute?'),
        content: const Text(
          'The bank will close this claim. Any provisional credit may be taken back.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('Keep claim'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final error = await bank.withdrawDispute(BankingProvider.idOf(claim));
    if (error != null && context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: SColors.danger),
      );
  }
}
