import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../../../services/banking_dispute_reasons.dart';
import '../../shared/module_states.dart';
import 'disputes_screen.dart';

/// One transaction, and the two things a person can do about it: stop it if
/// it has not gone, or dispute it if it has.
class TransactionDetailScreen extends StatefulWidget {
  final Map<String, dynamic> txn;
  const TransactionDetailScreen({super.key, required this.txn});

  @override
  State<TransactionDetailScreen> createState() =>
      _TransactionDetailScreenState();
}

class _TransactionDetailScreenState extends State<TransactionDetailScreen> {
  late Map<String, dynamic> _t = widget.txn;
  String? _error;
  String? _note;

  String get _id => '${_t['sk'] ?? _t['id'] ?? ''}';

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final amount = _t['amount'];
    final currency = '${_t['currency'] ?? 'USD'}';
    final status = '${_t['status'] ?? ''}'.toLowerCase();
    final incoming = '${_t['direction'] ?? ''}'.toLowerCase() == 'in';
    final actions = _t['actions'];
    final hasClaim = b.disputes.any(
      (claim) =>
          '${claim['transaction']}' == _id &&
          !['lost', 'withdrawn'].contains(claim['status']),
    );
    final canDispute =
        !hasClaim && actions is Map && actions['dispute'] == true;
    final stoppable = actions is Map && actions['cancel'] == true;
    final network = _t['network'];

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'Transaction',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: SColors.ink,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          SSpace.lg,
          SSpace.lg,
          SSpace.lg,
          SSpace.xxl,
        ),
        children: [
          Center(
            child: Column(
              children: [
                Text(
                  '${incoming ? '+' : '−'}${Money.format(amount, currency: currency)}',
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                    color: incoming ? SColors.green : SColors.ink,
                    fontFamily: brand.displayFont,
                  ),
                ),
                const SizedBox(height: SSpace.xs),
                Text(
                  '${_t['description'] ?? _t['kind'] ?? ''}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: SColors.muted, fontSize: 14),
                ),
                const SizedBox(height: SSpace.md),
                _StatusPill(status: status),
              ],
            ),
          ),
          const SizedBox(height: SSpace.xl),
          Container(
            padding: const EdgeInsets.all(SSpace.lg),
            decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(color: SColors.line),
            ),
            child: Column(
              children: [
                if ('${_t['kind'] ?? ''}'.isNotEmpty)
                  _Fact(k: 'Type', v: '${_t['kind']}'.replaceAll('_', ' ')),
                if ('${_t['rail'] ?? ''}'.isNotEmpty)
                  _Fact(k: 'Sent by', v: '${_t['rail']}'.toUpperCase()),
                if ('${_t['memo'] ?? ''}'.trim().isNotEmpty)
                  _Fact(k: 'Memo', v: '${_t['memo']}'),
                if ('${_t['reference'] ?? ''}'.trim().isNotEmpty)
                  _Fact(k: 'Reference', v: '${_t['reference']}'),
                if ('${_t['postedAt'] ?? ''}'.isNotEmpty)
                  _Fact(k: 'Posted', v: _when('${_t['postedAt']}')),
                if ('${_t['createdate'] ?? ''}'.isNotEmpty)
                  _Fact(k: 'Started', v: _when('${_t['createdate']}')),
                if (network is Map && network['traceNumber'] != null)
                  _Fact(k: 'Trace', v: '${network['traceNumber']}'),
                if (network is Map && network['returnCode'] != null)
                  _Fact(
                    k: 'Return code',
                    v: '${network['returnCode']}',
                    danger: true,
                  ),
              ],
            ),
          ),
          if (_note != null) ...[
            const SizedBox(height: SSpace.lg),
            Container(
              padding: const EdgeInsets.all(SSpace.md),
              decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.md),
              ),
              child: Text(
                _note!,
                style: const TextStyle(
                  color: SColors.green2,
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: SSpace.lg),
            ModuleError(message: _error!),
          ],
          const SizedBox(height: SSpace.xl),
          if (hasClaim)
            TextButton.icon(
              onPressed: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const DisputesScreen())),
              icon: const Icon(Icons.gavel_outlined),
              label: const Text('Track this dispute'),
            ),
          if (stoppable)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: SColors.danger,
                  side: BorderSide(
                    color: SColors.danger.withValues(alpha: 0.5),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: SSpace.md + 2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill),
                  ),
                ),
                onPressed: b.busy
                    ? null
                    : () async {
                        final err = await b.cancelTransaction(_id);
                        if (!mounted) return;
                        setState(() {
                          _error = err;
                          if (err == null) {
                            _t = {
                              ..._t,
                              'status': 'cancelled',
                              'actions': {'dispute': false, 'cancel': false},
                            };
                            _note = 'Stopped. It will not go out.';
                          }
                        });
                      },
                icon: const Icon(Icons.block_rounded, size: 18),
                label: const Text(
                  'Stop this payment',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            )
          else if (canDispute)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: SColors.ink2,
                  side: const BorderSide(color: SColors.line),
                  padding: const EdgeInsets.symmetric(vertical: SSpace.md + 2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill),
                  ),
                ),
                onPressed: () => _dispute(context),
                icon: const Icon(Icons.gavel_rounded, size: 18),
                label: const Text(
                  "Something's wrong with this",
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
    );
  }

  static String _when(String raw) {
    final d = DateTime.tryParse(raw)?.toLocal();
    if (d == null) return raw;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '${d.day} ${months[d.month - 1]} ${d.year}, $h:$m';
  }

  /// Disputing is a formal act with a clock on the bank's side, so it asks
  /// for a reason and a description rather than filing a shrug.
  void _dispute(BuildContext context) {
    final b = context.read<BankingProvider>();
    final description = TextEditingController();
    var reason = 'unauthorized';

    const reasons = bankingDisputeReasons;

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
                const Text(
                  'What is wrong?',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                ),
                const SizedBox(height: SSpace.md),
                for (final entry in reasons.entries)
                  GestureDetector(
                    onTap: () => setSheet(() => reason = entry.key),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: SSpace.sm),
                      padding: const EdgeInsets.all(SSpace.md),
                      decoration: BoxDecoration(
                        color: reason == entry.key
                            ? CurrentSetup.brand.primary.withValues(alpha: 0.07)
                            : SColors.paper,
                        borderRadius: BorderRadius.circular(SRadius.md),
                        border: Border.all(
                          color: reason == entry.key
                              ? CurrentSetup.brand.primary
                              : SColors.line,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            reason == entry.key
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_unchecked_rounded,
                            size: 19,
                            color: reason == entry.key
                                ? CurrentSetup.brand.primary
                                : SColors.faint,
                          ),
                          const SizedBox(width: SSpace.md),
                          Expanded(
                            child: Text(
                              entry.value,
                              style: const TextStyle(fontSize: 13.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: SSpace.sm),
                TextField(
                  controller: description,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'What happened',
                    helperText: 'The bank needs this to take it up',
                  ),
                ),
                const SizedBox(height: SSpace.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: CurrentSetup.brand.primary,
                      padding: const EdgeInsets.symmetric(
                        vertical: SSpace.md + 3,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                    ),
                    onPressed: () async {
                      final err = await b.fileDispute(
                        transaction: _id,
                        reason: reason,
                        description: description.text.trim(),
                      );
                      if (!sheet.mounted) return;
                      Navigator.of(sheet).pop();
                      if (!mounted) return;
                      setState(() {
                        _error = err;
                        if (err == null) {
                          _note =
                              'Dispute filed. The bank will come back to '
                              'you about it.';
                        }
                      });
                    },
                    child: const Text(
                      'File it',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
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

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final (Color fg, Color bg, String label) = switch (status) {
      'posted' => (SColors.green2, SColors.greenSoft, 'Settled'),
      'pending' => (Color(0xFF8A5B16), Color(0xFFFDF1DC), 'Pending'),
      'returned' => (SColors.danger, Color(0xFFFBE9E7), 'Returned'),
      'failed' => (SColors.danger, Color(0xFFFBE9E7), 'Failed'),
      'cancelled' => (SColors.muted, SColors.paper2, 'Cancelled'),
      'reversed' => (SColors.muted, SColors.paper2, 'Reversed'),
      _ => (SColors.ink2, SColors.paper2, status),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SSpace.md,
        vertical: SSpace.xs + 2,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(SRadius.pill),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  final String k, v;
  final bool danger;
  const _Fact({required this.k, required this.v, this.danger = false});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: SSpace.sm),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 104,
          child: Text(
            k,
            style: const TextStyle(color: SColors.muted, fontSize: 12.5),
          ),
        ),
        Expanded(
          child: Text(
            v,
            style: TextStyle(
              color: danger ? SColors.danger : SColors.ink,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ],
    ),
  );
}
