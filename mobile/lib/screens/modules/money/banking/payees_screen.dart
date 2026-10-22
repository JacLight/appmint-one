import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../shared/module_states.dart';

/// Who I can send money to, and bring it in from.
///
/// A payee is unusable until the two small deposits are confirmed, so that
/// state is the loudest thing on each row — an unverified payee that looks
/// ready is a payment that fails at the worst moment.
class PayeesScreen extends StatelessWidget {
  const PayeesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: const Text('Payees',
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: SColors.ink)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: brand.primary,
        foregroundColor: Colors.white,
        onPressed: () => _add(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add payee',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: b.payees.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(SSpace.lg),
              child: ModuleEmpty(
                icon: Icons.people_alt_rounded,
                title: 'No payees',
                body:
                    'Add an account at another bank, confirm the two small '
                    'deposits we send it, and you can pay it or pull from it.',
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.lg, SSpace.lg, SSpace.xxl * 2),
              children: [
                for (final p in b.payees)
                  Padding(
                    padding: const EdgeInsets.only(bottom: SSpace.md),
                    child: _PayeeRow(payee: p),
                  ),
              ],
            ),
    );
  }

  void _add(BuildContext context) {
    final b = context.read<BankingProvider>();
    final name = TextEditingController();
    final routing = TextEditingController();
    final number = TextEditingController();
    var accountType = 'checking';
    var holderType = 'individual';

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: EdgeInsets.only(
            left: SSpace.lg,
            right: SSpace.lg,
            top: SSpace.lg,
            bottom: MediaQuery.of(sheet).viewInsets.bottom + SSpace.lg,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Add a payee',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink,
                      fontFamily: CurrentSetup.brand.displayFont,
                    )),
                const SizedBox(height: SSpace.lg),
                TextField(
                  controller: name,
                  decoration: const InputDecoration(
                      labelText: 'Name on the account'),
                ),
                const SizedBox(height: SSpace.md),
                TextField(
                  controller: routing,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Routing number'),
                ),
                const SizedBox(height: SSpace.md),
                TextField(
                  controller: number,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Account number'),
                ),
                const SizedBox(height: SSpace.md),
                Row(
                  children: [
                    for (final t in const ['checking', 'savings'])
                      Padding(
                        padding: const EdgeInsets.only(right: SSpace.sm),
                        child: ChoiceChip(
                          label: Text(t),
                          selected: accountType == t,
                          onSelected: (_) =>
                              setSheet(() => accountType = t),
                          selectedColor: CurrentSetup.brand.primary,
                          labelStyle: TextStyle(
                            color: accountType == t
                                ? Colors.white
                                : SColors.ink2,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    const Spacer(),
                    for (final t in const ['individual', 'business'])
                      Padding(
                        padding: const EdgeInsets.only(left: SSpace.sm),
                        child: ChoiceChip(
                          label: Text(t),
                          selected: holderType == t,
                          onSelected: (_) => setSheet(() => holderType = t),
                          selectedColor: CurrentSetup.brand.primary,
                          labelStyle: TextStyle(
                            color: holderType == t
                                ? Colors.white
                                : SColors.ink2,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: SSpace.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: CurrentSetup.brand.primary,
                      padding:
                          const EdgeInsets.symmetric(vertical: SSpace.md + 3),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(SRadius.pill)),
                    ),
                    onPressed: () async {
                      final err = await b.addPayee({
                        'holderName': name.text.trim(),
                        'routingNumber': routing.text.trim(),
                        'accountNumber': number.text.trim(),
                        'accountType': accountType,
                        'holderType': holderType,
                      });
                      if (!sheet.mounted) return;
                      Navigator.of(sheet).pop();
                      if (err != null && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            backgroundColor: SColors.danger,
                            content: Text(err)));
                      }
                    },
                    child: const Text('Add',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PayeeRow extends StatelessWidget {
  final Map<String, dynamic> payee;
  const _PayeeRow({required this.payee});

  @override
  Widget build(BuildContext context) {
    final b = context.read<BankingProvider>();
    final id = BankingProvider.idOf(payee);
    final status = '${payee['status'] ?? ''}'.toLowerCase();
    final verified = status == 'verified' || payee['verified'] == true;
    final awaiting = status.contains('micro') || status == 'pending';

    return Container(
      padding: const EdgeInsets.all(SSpace.md),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(color: SColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${payee['holderName'] ?? payee['name'] ?? 'Payee'}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: SColors.ink)),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if ('${payee['bankName'] ?? ''}'.isNotEmpty)
                          '${payee['bankName']}',
                        if ('${payee['accountNumber'] ?? ''}'.isNotEmpty)
                          '${payee['accountNumber']}',
                        if ('${payee['accountType'] ?? ''}'.isNotEmpty)
                          '${payee['accountType']}',
                      ].join(' · '),
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: SSpace.sm + 2, vertical: 4),
                decoration: BoxDecoration(
                  color: verified ? SColors.greenSoft : const Color(0xFFFDF1DC),
                  borderRadius: BorderRadius.circular(SRadius.pill),
                ),
                child: Text(
                  verified ? 'Verified' : 'Not verified',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: verified ? SColors.green2 : const Color(0xFF8A5B16),
                  ),
                ),
              ),
            ],
          ),
          if (!verified) ...[
            const SizedBox(height: SSpace.md),
            Row(
              children: [
                if (!awaiting)
                  TextButton(
                    onPressed: () async {
                      final err = await b.startMicroDeposits(id);
                      if (err != null && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            backgroundColor: SColors.danger,
                            content: Text(err)));
                      }
                    },
                    child: const Text('Send two deposits',
                        style: TextStyle(fontSize: 12.5)),
                  )
                else
                  TextButton(
                    onPressed: () => _confirm(context, id),
                    child: const Text('Confirm the amounts',
                        style: TextStyle(fontSize: 12.5)),
                  ),
                const Spacer(),
                TextButton(
                  onPressed: () => b.removePayee(id),
                  child: const Text('Remove',
                      style:
                          TextStyle(color: SColors.danger, fontSize: 12.5)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _confirm(BuildContext context, String id) {
    final b = context.read<BankingProvider>();
    final first = TextEditingController();
    final second = TextEditingController();

    showDialog<void>(
      context: context,
      builder: (dialog) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('The two deposits'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Find the two small deposits on the other account and type them '
              'here, in cents.',
              style: TextStyle(color: SColors.muted, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: SSpace.lg),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: first,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'First'),
                  ),
                ),
                const SizedBox(width: SSpace.md),
                Expanded(
                  child: TextField(
                    controller: second,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Second'),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialog).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: CurrentSetup.brand.primary),
            onPressed: () async {
              final a = int.tryParse(first.text.trim());
              final c = int.tryParse(second.text.trim());
              if (a == null || c == null) return;
              final err = await b.confirmMicroDeposits(id, [a, c]);
              if (!dialog.mounted) return;
              Navigator.of(dialog).pop();
              if (err != null && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    backgroundColor: SColors.danger, content: Text(err)));
              }
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }
}
