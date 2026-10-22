import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import 'host_payout_methods_screen.dart';
import 'host_shell.dart';

/// The host's earnings wallet: balance, what's available to pay out now, held
/// funds, and payout history — plus Request payout. Booking earnings land here
/// (platform take-rate already deducted); in-person payments you collect settle
/// through your gateway account.
class HostWalletScreen extends StatefulWidget {
  final bool embedded;
  const HostWalletScreen({super.key, this.embedded = false});

  @override
  State<HostWalletScreen> createState() => _HostWalletScreenState();
}

class _HostWalletScreenState extends State<HostWalletScreen> {
  final StowboApi _api = StowboApi();
  bool _loading = true;
  bool _requesting = false;
  String? _error;
  Map<String, dynamic> _wallet = {};
  List<Map<String, dynamic>> _payouts = [];

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
      final w = await _api.hostWallet();
      final p = await _api.hostPayouts();
      if (!mounted) return;
      setState(() {
        _wallet = w;
        _payouts = p;
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

  double get _available => double.tryParse('${_wallet['available'] ?? 0}') ?? 0;
  double get _minPayout => double.tryParse('${_wallet['minPayout'] ?? 0}') ?? 0;

  Future<void> _requestPayout() async {
    final res = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) =>
          _PayoutRequestSheet(available: _available, minPayout: _minPayout),
    );
    if (res == null) return;
    final amount = (res['amount'] as double?) ?? 0;
    final notes = (res['notes'] as String?)?.trim();
    final methodId = (res['methodId'] as String?)?.trim();
    setState(() {
      _requesting = true;
      _error = null;
    });
    try {
      // amount 0 (from the sheet's "pay out everything") → omit → whole balance.
      final payout = await _api.requestHostPayout(
          amount: amount > 0 ? amount : null,
          methodId: (methodId != null && methodId.isNotEmpty) ? methodId : null,
          notes: (notes != null && notes.isNotEmpty) ? notes : null);
      if (!mounted) return;
      // Surface what was actually created (amount + status), not a bare "✓".
      final paidAmt = double.tryParse('${payout['amount'] ?? ''}') ??
          (amount > 0 ? amount : _available);
      final status = (payout['status'] ?? 'requested').toString();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              'Payout \$${paidAmt.toStringAsFixed(2)} $status'),
          backgroundColor: SColors.green));
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = RefreshIndicator(
      color: SColors.clay,
      onRefresh: _load,
      child: _content(),
    );
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: SafeArea(child: body),
    );
  }

  Widget _content() {
    if (_loading && _wallet.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: SColors.clay));
    }
    if (_error != null && _wallet.isEmpty) {
      return ListView(children: [
        const SizedBox(height: 120),
        const Icon(Icons.wifi_off_rounded, size: 44, color: SColors.faint),
        const SizedBox(height: SSpace.md),
        Center(
            child: Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: SColors.muted))),
        const SizedBox(height: SSpace.lg),
        Center(child: OutlinedButton(onPressed: _load, child: const Text('Retry'))),
      ]);
    }

    final currency = (_wallet['currency'] ?? 'USD').toString();
    // Earned = CONFIRMED transactions you collected (net of refunds).
    final earned = double.tryParse('${_wallet['earned'] ?? _wallet['balance'] ?? 0}') ?? 0;
    final refunded = double.tryParse('${_wallet['refunded'] ?? 0}') ?? 0;
    // Money on unconfirmed payment links — earned only once they're paid.
    final pending = double.tryParse('${_wallet['pending'] ?? 0}') ?? 0;
    final pendingPayout = double.tryParse('${_wallet['pendingPayout'] ?? 0}') ?? 0;
    final expectedBookings =
        double.tryParse('${_wallet['expectedFromBookings'] ?? 0}') ?? 0;
    final pendingBookings = (_wallet['pendingBookings'] as num?)?.toInt() ?? 0;
    final paidOut = double.tryParse('${_wallet['paidOut'] ?? 0}') ?? 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(SSpace.lg, SSpace.lg, SSpace.lg, 96),
      children: [
        // Available balance — the hero.
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SSpace.xl),
          decoration: BoxDecoration(
              color: SColors.green,
              borderRadius: BorderRadius.circular(SRadius.xl)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Available to pay out',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 13)),
              const SizedBox(height: SSpace.xs),
              Text('\$${_available.toStringAsFixed(2)}',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: SSpace.xs),
              Text('$currency · earned \$${earned.toStringAsFixed(2)}',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 12)),
              const SizedBox(height: SSpace.lg),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed:
                      (_requesting || _available <= 0) ? null : _requestPayout,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: SColors.green,
                      minimumSize: const Size.fromHeight(50)),
                  icon: _requesting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: SColors.green))
                      : const Icon(Icons.account_balance_rounded),
                  label: Text(
                      _available <= 0 ? 'Nothing to pay out' : 'Request payout',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SSpace.md),

        if (_error != null) ...[
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
          const SizedBox(height: SSpace.md),
        ],

        // Where the number comes from — the exact math, and taps to the rows
        // that make it up. `earned` is already net of refunds, so gross
        // collected = earned + refunded.
        Container(
          padding: const EdgeInsets.all(SSpace.md),
          decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(color: SColors.line)),
          child: Column(
            children: [
              _line('Collected (paid)', earned + refunded,
                  sign: '+', color: SColors.green, onTap: _toTransactions),
              if (refunded > 0)
                _line('Refunded', refunded, sign: '−', color: SColors.danger),
              if (paidOut > 0)
                _line('Paid out', paidOut, sign: '−', color: SColors.muted),
              if (pendingPayout > 0)
                _line('Payout requested', pendingPayout,
                    sign: '−', color: SColors.clay),
              const Divider(color: SColors.line, height: SSpace.lg),
              _line('Available to pay out', _available,
                  sign: '=', color: SColors.ink, strong: true),
            ],
          ),
        ),
        const SizedBox(height: SSpace.md),
        if (pending > 0)
          Material(
            color: SColors.amber.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(SRadius.md),
            child: InkWell(
              onTap: _toTransactions,
              borderRadius: BorderRadius.circular(SRadius.md),
              child: Padding(
                padding: const EdgeInsets.all(SSpace.md),
                child: Row(children: [
                  const Icon(Icons.schedule_rounded,
                      size: 18, color: SColors.amber),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    child: Text(
                        'On unpaid links (pending) — not earned until paid',
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 12.5)),
                  ),
                  Text('\$${pending.toStringAsFixed(2)}',
                      style: const TextStyle(
                          color: SColors.amber,
                          fontWeight: FontWeight.w800,
                          fontSize: 14)),
                  const Icon(Icons.chevron_right_rounded,
                      color: SColors.faint),
                ]),
              ),
            ),
          ),
        // Money still coming from unpaid bookings (the pipeline) — booked but not
        // yet collected. Taps through to Bookings.
        if (expectedBookings > 0) ...[
          const SizedBox(height: SSpace.sm),
          Material(
            color: SColors.claySoft,
            borderRadius: BorderRadius.circular(SRadius.md),
            child: InkWell(
              onTap: () => hostTabIndex.value = 1, // → Bookings
              borderRadius: BorderRadius.circular(SRadius.md),
              child: Padding(
                padding: const EdgeInsets.all(SSpace.md),
                child: Row(children: [
                  const Icon(Icons.event_note_rounded,
                      size: 18, color: SColors.clay),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    child: Text(
                        'Expected from bookings — $pendingBookings unpaid '
                        '${pendingBookings == 1 ? 'booking' : 'bookings'} to collect',
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 12.5)),
                  ),
                  Text('\$${expectedBookings.toStringAsFixed(2)}',
                      style: const TextStyle(
                          color: SColors.clay,
                          fontWeight: FontWeight.w800,
                          fontSize: 14)),
                  const Icon(Icons.chevron_right_rounded,
                      color: SColors.faint),
                ]),
              ),
            ),
          ),
        ],
        const SizedBox(height: SSpace.lg),

        const Text('Payout history',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
        const SizedBox(height: SSpace.sm),
        if (_payouts.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: SSpace.lg),
            child: Text('No payouts yet.',
                style: TextStyle(color: SColors.muted, fontSize: 13)),
          )
        else
          ..._payouts.map(_payoutRow),
      ],
    );
  }

  // Jump to the Transactions tab (this screen is embedded in the Money hub's
  // TabController) so the host sees the actual rows behind a number.
  void _toTransactions() => DefaultTabController.maybeOf(context)?.animateTo(1);

  Widget _line(String label, double amount,
      {required String sign,
      required Color color,
      VoidCallback? onTap,
      bool strong = false}) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Expanded(
          child: Text(label,
              style: TextStyle(
                  color: strong ? SColors.ink : SColors.ink2,
                  fontWeight: strong ? FontWeight.w800 : FontWeight.w500,
                  fontSize: strong ? 15 : 13)),
        ),
        Text('$sign\$${amount.toStringAsFixed(2)}',
            style: TextStyle(
                color: color,
                fontWeight: strong ? FontWeight.w800 : FontWeight.w700,
                fontSize: strong ? 16 : 14)),
        if (onTap != null)
          const Padding(
            padding: EdgeInsets.only(left: 4),
            child: Icon(Icons.chevron_right_rounded,
                size: 18, color: SColors.faint),
          ),
      ]),
    );
    if (onTap == null) return row;
    return InkWell(onTap: onTap, child: row);
  }

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /// ISO → "Sep 1, 3:45 PM" in local time. Falls back to the raw value.
  String _fmtWhen(String iso) {
    if (iso.isEmpty) return '';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return iso;
    final h12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final mm = d.minute.toString().padLeft(2, '0');
    final ampm = d.hour >= 12 ? 'PM' : 'AM';
    return '${_months[d.month - 1]} ${d.day}, $h12:$mm $ampm';
  }

  Widget _payoutRow(Map<String, dynamic> p) {
    final amount = double.tryParse('${p['amount']}') ?? 0;
    final status = (p['status'] ?? '').toString();
    // "Sep 1, 3:45 PM", not a raw ISO timestamp.
    final at = _fmtWhen((p['at'] ?? '').toString());
    final method = (p['method'] ?? '').toString();
    final dest = p['destination'] is Map ? Map<String, dynamic>.from(p['destination']) : const {};
    final destination = [dest['label'], dest['detail']]
        .where((v) => v != null && v.toString().isNotEmpty)
        .map((v) => v.toString())
        .join(' · ');
    final reason = (p['failureReason'] ?? '').toString();
    Color c;
    switch (status) {
      case 'completed':
      case 'paid':
        c = SColors.green;
        break;
      case 'failed':
      case 'cancelled':
        c = SColors.danger;
        break;
      default:
        c = SColors.amber;
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Container(
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
            color: SColors.card,
            borderRadius: BorderRadius.circular(SRadius.md),
            border: Border.all(color: SColors.line)),
        child: Row(children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('\$${amount.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, color: SColors.ink)),
                // Name the account it went to, not just the rail — "bank" alone
                // is useless to a host with more than one destination.
                if (at.isNotEmpty || method.isNotEmpty || destination.isNotEmpty)
                  Text(
                      [at, destination.isNotEmpty ? destination : method]
                          .where((s) => s.isNotEmpty)
                          .join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: SColors.muted, fontSize: 12)),
                if (reason.isNotEmpty)
                  Text(reason,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: SColors.danger, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
                color: c.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(SRadius.pill)),
            child: Text(
                status.isEmpty
                    ? '—'
                    : status[0].toUpperCase() + status.substring(1),
                style: TextStyle(
                    color: c, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ]),
      ),
    );
  }
}

/// Ask how much to pay out — defaults to everything available.
class _PayoutRequestSheet extends StatefulWidget {
  final double available;
  final double minPayout;
  const _PayoutRequestSheet({required this.available, this.minPayout = 0});
  @override
  State<_PayoutRequestSheet> createState() => _PayoutRequestSheetState();
}

class _PayoutRequestSheetState extends State<_PayoutRequestSheet> {
  final _amount = TextEditingController();
  final _notes = TextEditingController();
  final _api = StowboApi();
  List<Map<String, dynamic>> _methods = [];
  String? _methodId;
  bool _loadingMethods = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMethods();
  }

  /// A payout with nowhere to go is refused by the server, so the sheet says so
  /// up front and offers the fix instead of letting them submit into an error.
  Future<void> _loadMethods() async {
    try {
      final rows = await _api.payoutMethods();
      if (!mounted) return;
      setState(() {
        _methods = rows.where((m) => m['status'] != 'disabled').toList();
        _methodId = (_methods.firstWhere((m) => m['isDefault'] == true,
                orElse: () => _methods.isNotEmpty ? _methods.first : <String, dynamic>{})['id'])
            ?.toString();
        _loadingMethods = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMethods = false);
    }
  }

  String _methodLabel(Map<String, dynamic> m) {
    final type = (m['type'] ?? '').toString();
    final label = (m['label'] ?? '').toString();
    final tail = type == 'bank'
        ? '····${(m['bank'] is Map ? m['bank']['accountNumberLast4'] : null) ?? '····'}'
        : ((m['paypal'] is Map ? m['paypal']['email'] : null) ?? 'PayPal').toString();
    return label.isNotEmpty ? '$label · $tail' : tail;
  }

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _submit() {
    final full = _amount.text.trim().isEmpty;
    final amt = full ? 0.0 : (double.tryParse(_amount.text.trim()) ?? -1);
    if (!full && (amt <= 0 || amt > widget.available)) {
      setState(() => _error =
          'Enter an amount between 0 and ${widget.available.toStringAsFixed(2)}.');
      return;
    }
    // Enforce the minimum HERE so the host sees it, instead of a raw server 400.
    // (A "pay out everything" request skips it — the server takes the balance.)
    if (!full && widget.minPayout > 0 && amt < widget.minPayout) {
      setState(() => _error =
          'Minimum payout is \$${widget.minPayout.toStringAsFixed(2)}.');
      return;
    }
    if (!_loadingMethods && _methods.isEmpty) {
      setState(() => _error = 'Add a payout destination first.');
      return;
    }
    Navigator.pop(context, {
      'amount': amt, // 0 => the whole available balance
      'notes': _notes.text.trim(),
      'methodId': _methodId ?? '',
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
            color: SColors.paper,
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
        padding: const EdgeInsets.all(SSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Request payout',
                style: Theme.of(context).textTheme.displayLarge),
            const SizedBox(height: SSpace.xs),
            Text(
                'Available: \$${widget.available.toStringAsFixed(2)}'
                '${widget.minPayout > 0 ? '  ·  min \$${widget.minPayout.toStringAsFixed(2)}' : ''}',
                style: const TextStyle(color: SColors.muted, fontSize: 13)),
            const SizedBox(height: SSpace.lg),
            if (_loadingMethods)
              const Padding(
                padding: EdgeInsets.only(bottom: SSpace.sm),
                child: LinearProgressIndicator(minHeight: 2, color: SColors.clay),
              )
            else if (_methods.isEmpty) ...[
              Container(
                padding: const EdgeInsets.all(SSpace.md),
                decoration: BoxDecoration(
                  color: SColors.clay.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(SRadius.md),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('No payout destination yet',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  const Text(
                      'Add a bank account or PayPal before requesting — otherwise there is nowhere to send it.',
                      style: TextStyle(color: SColors.muted, fontSize: 12.5)),
                  const SizedBox(height: SSpace.xs),
                  TextButton(
                    onPressed: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const HostPayoutMethodsScreen()));
                      if (mounted) {
                        setState(() => _loadingMethods = true);
                        _loadMethods();
                      }
                    },
                    child: const Text('Add a destination'),
                  ),
                ]),
              ),
              const SizedBox(height: SSpace.sm),
            ] else ...[
              DropdownButtonFormField<String>(
                initialValue: _methodId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Pay to'),
                items: [
                  for (final m in _methods)
                    DropdownMenuItem(
                      value: (m['id'] ?? '').toString(),
                      child: Text(_methodLabel(m), overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _methodId = v),
              ),
              const SizedBox(height: SSpace.sm),
            ],
            TextField(
              controller: _amount,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => setState(() => _error = null),
              decoration: InputDecoration(
                  prefixText: '\$ ',
                  labelText: 'Amount',
                  hintText: 'Everything (${widget.available.toStringAsFixed(2)})'),
            ),
            const SizedBox(height: SSpace.sm),
            TextField(
              controller: _notes,
              decoration: const InputDecoration(
                  labelText: 'Note (optional)',
                  hintText: 'e.g. which account, urgency'),
            ),
            if (_error != null) ...[
              const SizedBox(height: SSpace.sm),
              Text(_error!,
                  style: const TextStyle(color: SColors.danger, fontSize: 13)),
            ],
            const SizedBox(height: SSpace.lg),
            ElevatedButton(
              onPressed: _submit,
              style: ElevatedButton.styleFrom(
                  backgroundColor: SColors.clay,
                  minimumSize: const Size.fromHeight(52)),
              child: Text(
                  _amount.text.trim().isEmpty
                      ? 'Pay out \$${widget.available.toStringAsFixed(2)}'
                      : 'Request payout',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
