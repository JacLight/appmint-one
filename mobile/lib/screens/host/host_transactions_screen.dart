import '../../services/payment_ledger.dart';
import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import 'take_payment_sheet.dart';
import 'booking_dashboard_screen.dart';

/// "3d" / "5h" / "just now" — how long ago, so a pending card SAYS how stale it
/// is (the whole reason to look at a pending payment is to chase it).
String _ago(String? iso) {
  final d = DateTime.tryParse(iso ?? '')?.toLocal();
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  return '${diff.inDays}d';
}

/// "Aug 31, 2:30 PM" from an ISO string — a card needs a real date, not a raw
/// timestamp.
String _fmtWhen(String? iso) {
  final d = DateTime.tryParse(iso ?? '')?.toLocal();
  if (d == null) return '';
  const mo = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final ap = d.hour < 12 ? 'AM' : 'PM';
  final m = d.minute.toString().padLeft(2, '0');
  return '${mo[d.month]} ${d.day}, $h:$m $ap';
}

/// The host's money view: everything they've collected and everything still
/// pending. A pending link/QR request is tappable — it reopens straight into
/// its waiting/QR panel so a host who walked away can come back to it.
class HostTransactionsScreen extends StatefulWidget {
  /// When embedded in the Money hub's tab, drop the Scaffold/AppBar/FAB — the
  /// hub already provides them — and render just the refreshable list.
  final bool embedded;
  const HostTransactionsScreen({super.key, this.embedded = false});

  @override
  State<HostTransactionsScreen> createState() => _HostTransactionsScreenState();
}

const _catLabels = <String, String>{
  'booking': 'Booking payment',
  'balance': 'Balance due',
  'addon': 'Add-on / extra',
  'tip': 'Tip',
  'retrieval': 'Retrieval / valet',
  'deposit': 'Deposit',
  'damage': 'Damage / incident',
  'late': 'Late / overstay',
  'cleaning': 'Cleaning',
  'lost': 'Lost item / key',
  'upgrade': 'Upgrade',
  'walkin': 'Walk-in / drop-off',
  'adhoc': 'Ad-hoc',
  'other': 'Other',
  'charge': 'Payment',
};

class _HostTransactionsScreenState extends State<HostTransactionsScreen> {
  final StowboApi _api = StowboApi();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _api.hostTransactions();
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  // NET collected — a refund row is money OUT, so it subtracts. Summing every
  // settled row made a $2 refund push "Collected" UP by $2.
  double get _collected => collectedPaymentTotal(_rows);

  double get _pending => _rows
      .where((r) => r['pending'] == true)
      .fold(0.0, (s, r) => s + (double.tryParse('${r['amount']}') ?? 0));

  Future<void> _openRow(Map<String, dynamic> r) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TransactionDetailSheet(row: r),
    );
    if (changed == true && mounted) _load();
  }

  Future<void> _newPayment() async {
    final ok = await TakePaymentSheet.show(context);
    if (ok == true && mounted) _load();
  }

  /// Chase a pending payment right from the card — reopen its link/QR so the
  /// customer can pay. No need to dig into the detail sheet first.
  Future<void> _reopen(Map<String, dynamic> r) async {
    final url = (r['url'] ?? '').toString();
    final id = (r['request'] ?? '').toString();
    final amount = double.tryParse('${r['amount']}') ?? 0;
    if (url.isEmpty || id.isEmpty) {
      _openRow(r); // no link to reopen — fall back to the detail
      return;
    }
    final paid = await TakePaymentSheet.resume(context,
        requestId: id, url: url, amount: amount);
    if (paid == true && mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final list = RefreshIndicator(
      color: SColors.clay,
      onRefresh: _load,
      child: _body(),
    );
    if (widget.embedded) return list;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transactions'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'tx_take_payment',
        onPressed: _newPayment,
        backgroundColor: SColors.clay,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Take payment',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(child: list),
    );
  }

  Widget _body() {
    if (_loading && _rows.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: SColors.clay));
    }
    if (_error != null && _rows.isEmpty) {
      return ListView(children: [
        const SizedBox(height: 120),
        Icon(Icons.wifi_off_rounded, size: 44, color: SColors.faint),
        const SizedBox(height: SSpace.md),
        Center(
            child: Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: SColors.muted))),
        const SizedBox(height: SSpace.lg),
        Center(
          child: OutlinedButton(onPressed: _load, child: const Text('Retry')),
        ),
      ]);
    }
    if (_rows.isEmpty) {
      return ListView(children: const [
        SizedBox(height: 120),
        Icon(Icons.receipt_long_rounded, size: 48, color: SColors.faint),
        SizedBox(height: SSpace.md),
        Center(
            child: Text('No payments yet',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: SColors.ink))),
        SizedBox(height: SSpace.xs),
        Center(
            child: Text('Payments you take and links you send show up here.',
                textAlign: TextAlign.center,
                style: TextStyle(color: SColors.muted, fontSize: 13))),
      ]);
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(SSpace.lg, SSpace.md, SSpace.lg, 96),
      children: [
        _summary(),
        const SizedBox(height: SSpace.md),
        ..._rows.map(_row),
      ],
    );
  }

  Widget _summary() {
    return Row(children: [
      Expanded(child: _stat('Collected', _collected, SColors.green)),
      const SizedBox(width: SSpace.md),
      Expanded(child: _stat('Pending', _pending, SColors.amber)),
    ]);
  }

  Widget _stat(String label, double value, Color color) {
    return Container(
      padding: const EdgeInsets.all(SSpace.md),
      decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(color: SColors.muted, fontSize: 12)),
          const SizedBox(height: SSpace.xs),
          Text('\$${value.toStringAsFixed(2)}',
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> r) {
    final pending = r['pending'] == true;
    final collected = isCollectedPayment(r);
    final amount = double.tryParse('${r['amount']}') ?? 0;
    final cat = (r['category'] ?? 'other').toString();
    final label = _catLabels[cat] ?? cat;
    final channel = (r['channel'] ?? '').toString();
    final customer = (r['customer'] ?? '').toString();
    final bookingRef = (r['bookingRef'] ?? '').toString();
    final when = _fmtWhen(r['at']?.toString());
    // WHO it's for leads (a payment is about a person), then the booking, date,
    // and how it was taken.
    final sub = [
      if (customer.isNotEmpty) customer,
      if (bookingRef.isNotEmpty) '#$bookingRef',
      if (when.isNotEmpty) when,
      if (channel.isNotEmpty) _channelLabel(channel),
    ].join(' · ');

    final isRefund = (r['kind'] ?? '').toString() == 'refund';
    final age = _ago(r['at']?.toString());

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Material(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(SRadius.md),
          onTap: () => _openRow(r),
          child: Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(SRadius.md),
                // Pending rows get an amber edge — they're the ones that need
                // chasing, so they should catch the eye.
                border: Border.all(
                    color: pending ? SColors.amber : SColors.line,
                    width: pending ? 1.3 : 1)),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                          color: isRefund
                              ? SColors.danger.withValues(alpha: 0.12)
                              : pending
                                  ? SColors.amber.withValues(alpha: 0.14)
                                  : collected ? SColors.greenSoft : SColors.line,
                          shape: BoxShape.circle),
                      child: Icon(
                          isRefund
                              ? Icons.undo_rounded
                              : pending
                                  ? Icons.schedule_rounded
                                  : collected ? Icons.check_rounded : Icons.block_rounded,
                          color: isRefund
                              ? SColors.danger
                              : pending
                                  ? SColors.amber
                                  : collected ? SColors.green : SColors.muted,
                          size: 20),
                    ),
                    const SizedBox(width: SSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(isRefund ? 'Refund · $label' : label,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: SColors.ink)),
                          if (sub.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(sub,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: SColors.muted, fontSize: 12)),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: SSpace.sm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                            '${isRefund ? '−' : ''}\$${amount.toStringAsFixed(2)}',
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: isRefund ? SColors.danger : SColors.ink)),
                        const SizedBox(height: 2),
                        _statusPill(pending, isRefund,
                            r['status']?.toString() ?? '', age),
                      ],
                    ),
                  ],
                ),
                // Pending → a one-tap chase strip right on the card.
                if (pending && (r['url'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: SSpace.sm),
                  const Divider(height: 1, color: SColors.line),
                  const SizedBox(height: SSpace.xs),
                  InkWell(
                    onTap: () => _reopen(r),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                              (r['channel'] ?? '') == 'qr'
                                  ? Icons.qr_code_rounded
                                  : Icons.ios_share_rounded,
                              size: 15,
                              color: SColors.clay),
                          const SizedBox(width: 6),
                          Text(
                              age.isEmpty
                                  ? 'Reopen to chase payment'
                                  : 'Waiting $age — reopen to chase',
                              style: const TextStyle(
                                  color: SColors.clay,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12.5)),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statusPill(bool pending, bool isRefund, String status, String age) {
    final label = isRefund
        ? 'Refunded'
        : pending
            ? (age.isEmpty ? 'Waiting' : 'Waiting $age')
            : (status == 'paid' ? 'Paid' : status == 'cancelled' ? 'Cancelled' : status);
    final color = isRefund
        ? SColors.danger
        : pending
            ? SColors.amber
            : const ['paid', 'succeeded', 'refunded'].contains(status) ? SColors.green : SColors.muted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(SRadius.pill)),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }

  String _channelLabel(String c) {
    switch (c) {
      case 'card_reader':
        return 'Card reader';
      case 'tap_to_pay':
        return 'Tap to Pay';
      case 'link':
        return 'Link';
      case 'qr':
        return 'QR';
      default:
        return c;
    }
  }
}

/// One transaction, in full — with the actions that apply to it:
///  • pending request → reopen its link/QR, or cancel (void) it
///  • paid charge      → refund (full or partial)
///  • refund row       → shown as money out, linked to the original
class _TransactionDetailSheet extends StatefulWidget {
  final Map<String, dynamic> row;
  const _TransactionDetailSheet({required this.row});
  @override
  State<_TransactionDetailSheet> createState() =>
      _TransactionDetailSheetState();
}

class _TransactionDetailSheetState extends State<_TransactionDetailSheet> {
  final StowboApi _api = StowboApi();
  final _refundAmount = TextEditingController();
  final _refundReason = TextEditingController();
  bool _refunding = false; // the refund form is open
  bool _busy = false;
  String? _error;

  Map<String, dynamic> get r => widget.row;
  bool get _pending => r['pending'] == true;
  bool get _isRefund => (r['kind'] ?? '').toString() == 'refund';
  double get _amount => double.tryParse('${r['amount']}') ?? 0;
  double get _remaining =>
      double.tryParse('${r['remaining'] ?? r['amount']}') ?? _amount;
  double get _refunded => double.tryParse('${r['refunded'] ?? 0}') ?? 0;

  @override
  void dispose() {
    _refundAmount.dispose();
    _refundReason.dispose();
    super.dispose();
  }

  Future<void> _resume() async {
    final url = (r['url'] ?? '').toString();
    final id = (r['request'] ?? '').toString();
    if (url.isEmpty || id.isEmpty) return;
    final paid = await TakePaymentSheet.resume(context,
        requestId: id, url: url, amount: _amount);
    if (!mounted) return;
    Navigator.pop(context, paid == true);
  }

  Future<void> _cancel() async {
    final id = (r['request'] ?? '').toString();
    if (id.isEmpty) return;
    final yes = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancel this request?'),
        content: const Text(
            'The payment link and QR will stop working. This can’t be undone — '
            'you’d need to create a new request.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Keep it')),
          TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Cancel request',
                  style: TextStyle(color: SColors.danger))),
        ],
      ),
    );
    if (yes != true) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _api.cancelPaymentRequest(id);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _doRefund() async {
    final ref = (r['ref'] ?? '').toString();
    if (ref.isEmpty) {
      setState(() => _error = 'This transaction has no gateway reference to refund.');
      return;
    }
    final full = _refundAmount.text.trim().isEmpty;
    final amt = full ? _remaining : (double.tryParse(_refundAmount.text.trim()) ?? -1);
    if (!full && (amt <= 0 || amt > _remaining)) {
      setState(() => _error =
          'Enter an amount between 0 and ${_remaining.toStringAsFixed(2)}.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _api.refundTransaction(ref,
          amount: full ? null : amt,
          reason: _refundReason.text.trim());
      if (!mounted) return;
      // Messenger captured before pop — otherwise it fires on a defunct context.
      final messenger = ScaffoldMessenger.of(context);
      Navigator.pop(context, true);
      messenger.showSnackBar(SnackBar(
          content: Text('Refunded \$${amt.toStringAsFixed(2)} ✓'),
          backgroundColor: SColors.green));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = (r['currency'] ?? 'USD').toString();
    final cat = (r['category'] ?? 'other').toString();
    final label = _catLabels[cat] ?? cat;
    final status = (r['status'] ?? '').toString();
    final ref = (r['ref'] ?? '').toString();
    final refundOf = (r['refundOf'] ?? '').toString();
    final canRefund = isCollectedPayment(r) && !_isRefund && _remaining > 0;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
            color: SColors.paper,
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
        padding: const EdgeInsets.all(SSpace.xl),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: SSpace.md),
                  decoration: BoxDecoration(
                      color: SColors.line,
                      borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Row(children: [
                Expanded(
                  child: Text(_isRefund ? 'Refund' : label,
                      style: Theme.of(context).textTheme.displayLarge),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context, false),
                  icon: const Icon(Icons.close_rounded, color: SColors.muted),
                ),
              ]),
              const SizedBox(height: SSpace.xs),
              Text('${_isRefund ? '−' : ''}\$${_amount.toStringAsFixed(2)} $currency',
                  style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      color: _isRefund ? SColors.danger : SColors.ink)),
              const SizedBox(height: SSpace.sm),
              _statusChip(status),
              const SizedBox(height: SSpace.lg),

              _detail('Customer', (r['customer'] ?? '').toString()),
              _detail('Reference', (r['reference'] ?? '').toString()),
              _detail('Description', (r['description'] ?? '').toString()),
              _detail('Channel', _channel((r['channel'] ?? '').toString())),
              _bookingRow(),
              _detail('When', _fmtWhen((r['at'] ?? '').toString())),
              _detail('Gateway ref', ref),
              if (refundOf.isNotEmpty) _detail('Refund of', refundOf),
              if (_refunded > 0 && !_isRefund)
                _detail('Refunded so far',
                    '\$${_refunded.toStringAsFixed(2)} of \$${_amount.toStringAsFixed(2)}'),

              if (_error != null) ...[
                const SizedBox(height: SSpace.md),
                Container(
                  padding: const EdgeInsets.all(SSpace.md),
                  decoration: BoxDecoration(
                      color: SColors.danger.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(SRadius.md)),
                  child: Row(children: [
                    const Icon(Icons.error_outline_rounded,
                        color: SColors.danger, size: 18),
                    const SizedBox(width: SSpace.sm),
                    Expanded(
                        child: Text(_error!,
                            style: const TextStyle(
                                color: SColors.danger, fontSize: 13))),
                  ]),
                ),
              ],

              const SizedBox(height: SSpace.lg),
              ..._actions(canRefund),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _actions(bool canRefund) {
    if (_pending) {
      return [
        ElevatedButton.icon(
          onPressed: _busy ? null : _resume,
          style: ElevatedButton.styleFrom(
              backgroundColor: SColors.clay,
              minimumSize: const Size.fromHeight(50)),
          icon: const Icon(Icons.qr_code_rounded, color: Colors.white),
          label: const Text('Reopen link / QR',
              style: TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: SSpace.sm),
        OutlinedButton.icon(
          onPressed: _busy ? null : _cancel,
          icon: const Icon(Icons.block_rounded, size: 18, color: SColors.danger),
          label: const Text('Cancel request',
              style: TextStyle(color: SColors.danger)),
          style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              side: const BorderSide(color: SColors.danger)),
        ),
      ];
    }
    if (_refunding) {
      return [
        TextField(
          controller: _refundAmount,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          // Rebuild so the button below follows what's typed.
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
              labelText: 'Refund amount',
              hintText: 'Full (${_remaining.toStringAsFixed(2)})',
              prefixText: '\$ '),
        ),
        const SizedBox(height: SSpace.sm),
        TextField(
          controller: _refundReason,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Reason (optional)'),
        ),
        const SizedBox(height: SSpace.md),
        ElevatedButton(
          onPressed: _busy ? null : _doRefund,
          style: ElevatedButton.styleFrom(
              backgroundColor: SColors.danger,
              minimumSize: const Size.fromHeight(50)),
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Text(
                  'Refund \$${(double.tryParse(_refundAmount.text.trim()) ?? _remaining).toStringAsFixed(2)}',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: SSpace.xs),
        TextButton(
          onPressed: _busy ? null : () => setState(() => _refunding = false),
          child: const Text('Back', style: TextStyle(color: SColors.muted)),
        ),
      ];
    }
    if (canRefund) {
      return [
        OutlinedButton.icon(
          onPressed: () => setState(() {
            _refunding = true;
            _error = null;
          }),
          icon: const Icon(Icons.undo_rounded, size: 18),
          label: Text(_refunded > 0 ? 'Refund the rest' : 'Refund'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
      ];
    }
    return [];
  }

  /// The booking, as a TAPPABLE #reference (not a raw id) that opens the
  /// booking's dashboard — a payment should point at what it's for.
  Widget _bookingRow() {
    final id = (r['booking'] ?? '').toString();
    if (id.isEmpty) return const SizedBox.shrink();
    final ref = (r['bookingRef'] ?? '').toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(
              width: 120,
              child: Text('Booking',
                  style: TextStyle(color: SColors.muted, fontSize: 13))),
          Expanded(
            child: InkWell(
              onTap: () {
                Navigator.pop(context, false);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => BookingDashboardScreen(bookingId: id)),
                );
              },
              child: Row(children: [
                Text(ref.isNotEmpty ? '#$ref' : id,
                    style: const TextStyle(
                        color: SColors.clay,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 4),
                const Icon(Icons.open_in_new_rounded,
                    size: 14, color: SColors.clay),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detail(String label, String value) {
    if (value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 120,
              child: Text(label,
                  style: const TextStyle(color: SColors.muted, fontSize: 13))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(
                      color: SColors.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    Color c;
    switch (status) {
      case 'paid':
        c = SColors.green;
        break;
      case 'pending':
        c = SColors.amber;
        break;
      case 'refunded':
        c = SColors.danger;
        break;
      case 'cancelled':
        c = SColors.muted;
        break;
      default:
        c = SColors.muted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
          color: c.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(SRadius.pill)),
      child: Text(status.isEmpty ? '—' : status[0].toUpperCase() + status.substring(1),
          style:
              TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }

  String _channel(String c) {
    switch (c) {
      case 'card_reader':
        return 'Card reader';
      case 'tap_to_pay':
        return 'Tap to Pay';
      case 'link':
        return 'Payment link';
      case 'qr':
        return 'QR code';
      default:
        return c;
    }
  }
}
