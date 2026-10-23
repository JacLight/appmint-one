import 'package:provider/provider.dart';
import '../../../../providers/auth_provider.dart';
import 'package:flutter/material.dart';
import '../../../../services/banking_api.dart';

class BankAutopayPanel extends StatefulWidget {
  const BankAutopayPanel({
    super.key,
    required this.loanId,
    required this.accounts,
  });
  final String loanId;
  final List<Map<String, dynamic>> accounts;
  @override
  State<BankAutopayPanel> createState() => _BankAutopayPanelState();
}

class _BankAutopayPanelState extends State<BankAutopayPanel> {
  Map<String, dynamic>? status;
  String? account, error;
  bool busy = false;
  final maximum = TextEditingController(), starts = TextEditingController();
  final generation = bankingApi.verificationGeneration;
  bool get sameSession => generation == bankingApi.verificationGeneration;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  @override
  void dispose() {
    maximum.dispose();
    starts.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    try {
      final result = await bankingApi.loanAutopay(widget.loanId);
      if (mounted && sameSession)
        setState(() {
          status = result;
          error = null;
        });
    } catch (e) {
      if (mounted)
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> act(Future<dynamic> Function() fn) async {
    if (!sameSession) {
      setState(() => error = 'Your session changed. Reopen this loan.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await fn();
      if (sameSession) await refresh();
    } catch (e) {
      if (mounted)
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<AuthProvider?>();
    if (!sameSession)
      return const Text('Your session changed. Reopen this loan.');
    final state = status?['status']?.toString() ?? 'off';
    final available = status?['available'] == true;
    final instruction = status?['instructionId'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Automatic loan payments',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red)),
            if (status == null)
              TextButton(
                onPressed: busy ? null : refresh,
                child: const Text('Load automatic payment status'),
              ),
            if (status != null) ...[
              Text('Status: ${state.replaceAll('_', ' ')}'),
              if (!available)
                const Text(
                  'The bank has not enabled signed automatic payments for this loan. Make each payment yourself.',
                ),
              if (status!['reason'] != null) Text(status!['reason'].toString()),
              if (status!['attempt'] is Map)
                Text(
                  'Latest attempt: ${(status!['attempt'] as Map)['status']}. Only a posted payment counts as paid.',
                ),
              if (available && ['off', 'revoked'].contains(state)) ...[
                const Text(
                  'Request a bank agreement for scheduled payments from your own account. This request does not activate payments. Sign through the bank’s existing agreement flow, then check its status here.',
                ),
                DropdownButtonFormField<String>(
                  initialValue: account,
                  decoration: const InputDecoration(
                    labelText: 'Pay from your account',
                  ),
                  items: [
                    for (final a in widget.accounts.where(
                      (a) =>
                          a['status'] == 'open' &&
                          [
                            'checking',
                            'savings',
                            'money_market',
                          ].contains(a['kind']),
                    ))
                      DropdownMenuItem(
                        value: a['sk'].toString(),
                        child: Text(
                          a['nickname']?.toString() ?? a['kind'].toString(),
                        ),
                      ),
                  ],
                  onChanged: busy
                      ? null
                      : (value) => setState(() => account = value),
                ),
                TextField(
                  controller: starts,
                  decoration: const InputDecoration(
                    labelText: 'First eligible payment date (YYYY-MM-DD)',
                  ),
                ),
                TextField(
                  controller: maximum,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Maximum per automatic payment (USD)',
                  ),
                ),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => act(() async {
                          final amount = Money.parse(maximum.text);
                          if (account == null || amount == null || amount <= 0)
                            throw StateError(
                              'Choose your account and a positive maximum.',
                            );
                          return bankingApi.requestLoanAutopay(
                            widget.loanId,
                            account: account!,
                            startsOn: starts.text.trim(),
                            maximum: amount,
                            previousInstructionId: instruction?.toString(),
                          );
                        }),
                  child: const Text('Request signing agreement'),
                ),
              ],
              if (instruction is String &&
                  [
                    'awaiting_agreement',
                    'consented',
                    'awaiting_review',
                  ].contains(state)) ...[
                const Text(
                  'Complete the bank’s signing email or form. Checking here verifies actual completion; it does not sign the agreement.',
                ),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => act(
                          () => bankingApi.confirmLoanAutopay(
                            widget.loanId,
                            instruction,
                          ),
                        ),
                  child: const Text('Check signed agreement'),
                ),
              ],
              if (instruction is String &&
                  !['off', 'revoked', 'completed'].contains(state))
                TextButton(
                  onPressed: busy
                      ? null
                      : () async {
                          final yes = await showDialog<bool>(
                            context: context,
                            builder: (context) => AlertDialog(
                              title: const Text(
                                'Revoke future automatic payments?',
                              ),
                              content: const Text(
                                'This does not reverse a payment already started. Check the latest attempt separately.',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () =>
                                      Navigator.pop(context, false),
                                  child: const Text('Keep instruction'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Revoke future payments'),
                                ),
                              ],
                            ),
                          );
                          if (yes == true)
                            await act(
                              () => bankingApi.revokeLoanAutopay(
                                widget.loanId,
                                instruction,
                              ),
                            );
                        },
                  child: const Text('Revoke future payments'),
                ),
              TextButton(
                onPressed: busy ? null : refresh,
                child: const Text('Refresh status'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
