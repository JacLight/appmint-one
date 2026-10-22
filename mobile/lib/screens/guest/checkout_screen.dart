import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/checkout.dart';
import '../../providers/checkout_provider.dart';
import '../../services/payment_service.dart';
import '../../services/stripe_service.dart';
import '../../widgets/stowbo_widgets.dart';
import 'booking_detail_screen.dart';

/// Server-driven checkout. The screen renders exactly what the checkout record
/// on the server says (step, quote, hold) and re-reads after every action, so
/// the same purchase resumes on any device. Pass [items] to start/refresh a
/// cart, or [resume]:true to pick up the server's saved checkout as-is.
class CheckoutScreen extends StatefulWidget {
  final List<Map<String, dynamic>>? items;
  final String title;
  final bool resume;
  const CheckoutScreen({
    super.key,
    this.items,
    this.title = 'Checkout',
    this.resume = false,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  CheckoutProvider get _cp => context.read<CheckoutProvider>();
  Map<String, dynamic>? _booked; // confirm result → success view

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (widget.resume) {
        await _cp.refreshResume();
      } else if (widget.items != null) {
        await _cp.saveCart(widget.items!, step: 'review');
      }
    });
  }

  List<Map<String, dynamic>> get _items =>
      widget.items ??
      (_cp.state?.quote.lines
              .map((l) => {
                    'listing': l.listing,
                    'quantity': l.quantity,
                    'startDate': l.startDate?.toUtc().toIso8601String(),
                    'endDate': l.endDate?.toUtc().toIso8601String(),
                    'addOns': l.addOns,
                  })
              .toList() ??
          const []);

  Future<void> _hold() async {
    await _cp.markStep('review');
    final s = await _cp.hold(_items);
    if (s != null) _cp.markStep('payment');
  }

  /// Pay (if anything is due) then confirm. When `dueNow > 0` the guest pays on
  /// their own phone via the Stripe sheet: create a PaymentIntent for exactly
  /// that amount, present the sheet, and pass the confirmed intent to the server
  /// — which VERIFIES it before creating the booking. A cancel or decline leaves
  /// the hold untouched so they can retry. `dueNow == 0` (free, or a metered
  /// stay paid on the way out) confirms straight through with no card.
  Future<void> _pay() async {
    final s = _cp.state;
    final due = s?.dueNow ?? 0;
    String? intentId;

    if (due > 0) {
      if (kIsWeb) {
        _toast('Paying needs the Stowbo mobile app.');
        return;
      }
      try {
        await StripeService.initialize();
        // NOTE: saved-card (Stripe Customer) path is temporarily disabled. The
        // customer-init step makes the iOS SDK call q.stripe.com
        // (mc_complete_init_customer) which is failing TLS on-device and hangs
        // the sheet so it never presents. Get the plain card sheet working
        // first, then re-enable saved cards (pass the email back here).
        final intent = await paymentService.createPaymentIntent(
          amount: due,
          currency: (s?.quote.currency ?? 'usd').toLowerCase(),
          referenceId: s?.checkoutId,
        );
        final clientSecret =
            (intent['clientSecret'] ?? intent['client_secret'] ?? '')
                .toString();
        final pk = (intent['publishableKey'] ?? '').toString();
        if (pk.isNotEmpty) await StripeService.setPublishableKey(pk);
        if (clientSecret.isEmpty) {
          _toast('Could not start payment — try again.');
          return;
        }
        final ok = await StripeService.presentPaymentSheet(
          clientSecret: clientSecret,
          merchantDisplayName: 'Stowbo',
        );
        if (!ok) return; // sheet dismissed
        // pi_xxx from pi_xxx_secret_yyy
        intentId = clientSecret.contains('_secret')
            ? clientSecret.split('_secret').first
            : clientSecret;
      } catch (e) {
        if (mounted) _toast(e.toString().replaceFirst('Exception: ', ''));
        return; // cancelled or declined — hold stays, they can retry
      }
    }

    final booking = await _cp.confirm(paymentIntentId: intentId);
    if (booking != null && mounted) setState(() => _booked = booking);
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(m), backgroundColor: SColors.ink));

  Future<bool> _confirmLeave() async {
    final cp = _cp;
    if (cp.state?.hasLiveHold != true) return true;
    final leave = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Release your hold?'),
        content: const Text(
            'Your spot is being held while you pay. Leaving releases it — you can start again anytime.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep holding')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Release')),
        ],
      ),
    );
    if (leave == true) await cp.abandon();
    return leave ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final cp = context.watch<CheckoutProvider>();
    final state = cp.state;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmLeave() && mounted) Navigator.pop(context);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: _booked != null
            ? _Success(booking: _booked!)
            : cp.busy && state == null
                ? const Center(
                    child: CircularProgressIndicator(color: SColors.clay))
                : state == null
                    ? _empty(cp)
                    : _body(cp, state),
      ),
    );
  }

  Widget _empty(CheckoutProvider cp) => EmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'Nothing to check out',
        subtitle: cp.error ?? 'Your cart is empty.',
      );

  Widget _body(CheckoutProvider cp, CheckoutState s) {
    final q = s.quote;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(SSpace.xl),
            children: [
              _StepStrip(step: s.step, held: s.hasLiveHold),
              const SizedBox(height: SSpace.lg),
              if (s.changed && s.previousTotal != null)
                _notice(
                    'Price updated since you last looked — was ${money(s.previousTotal!)}, now ${money(q.total)}.',
                    SColors.amber),
              if (s.holdExpired)
                _notice(
                    'Your earlier hold expired — nothing was charged. Tap “Hold my spot” to continue.',
                    SColors.amber),
              if (s.quote.discountRejected != null)
                _notice(
                    'Code ${s.quote.discountRejected!.code ?? ''} not applied — ${s.quote.discountRejected!.message}',
                    SColors.amber),
              if (cp.conflict != null) _notice(cp.conflict!, SColors.danger),
              if (cp.error != null) _notice(cp.error!, SColors.danger),
              if (s.hasLiveHold && s.holdExpiresAt != null)
                _HoldTimer(
                    expiresAt: s.holdExpiresAt!,
                    onExpired: () => _cp.refreshResume()),
              const SectionLabel('Your cart'),
              ...q.lines.map(_line),
              const SizedBox(height: SSpace.lg),
              const SectionLabel('Price'),
              _priceBreakdown(q),
              const SizedBox(height: SSpace.xxl),
            ],
          ),
        ),
        _bottomBar(cp, s),
      ],
    );
  }

  Widget _line(QuoteLine l) {
    final when = l.startDate == null
        ? ''
        : '${_fmt(l.startDate!)}${l.endDate != null ? ' → ${_fmt(l.endDate!)}' : ''}';
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(l.title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                ),
                Text(money(l.total),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ],
            ),
            const SizedBox(height: 3),
            Text(
                '${l.quantity} item${l.quantity > 1 ? 's' : ''}${when.isEmpty ? '' : ' · $when'}',
                style: const TextStyle(color: SColors.muted, fontSize: 13)),
            // Server-computed rate breakdown, band by band. Rendered verbatim —
            // the app never re-derives a price from a rate and a duration.
            if (l.rateLines.isNotEmpty) ...[
              const SizedBox(height: SSpace.sm),
              ...l.rateLines.map((r) => Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                            child: Text(r.label,
                                style: const TextStyle(
                                    color: SColors.ink2, fontSize: 12.5))),
                        Text(money(r.amount),
                            style: const TextStyle(
                                color: SColors.ink2, fontSize: 12.5)),
                      ],
                    ),
                  )),
            ],
            if (l.addOnTotal > 0)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Add-ons',
                        style: TextStyle(color: SColors.ink2, fontSize: 12.5)),
                    Text(money(l.addOnTotal),
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 12.5)),
                  ],
                ),
              ),
            if (!l.sufficient)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                    'Not enough availability (${l.available} free) — adjust before booking.',
                    style: const TextStyle(
                        color: SColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _priceBreakdown(Quote q) => SCard(
        child: Column(
          children: [
            _pRow('Subtotal', q.subtotal),
            // Each applied discount as its own labelled negative line.
            ...q.discounts.map((d) => _pRow(d.name, -d.amount, discount: true)),
            if (q.fees.isNotEmpty)
              ...q.fees.where((f) => f.amount != 0).map((f) => _pRow(f.label, f.amount))
            else ...[
              if (q.serviceFee > 0) _pRow('Service fee', q.serviceFee),
              if (q.protectionFee > 0) _pRow('Protection', q.protectionFee),
            ],
            // Per-jurisdiction tax lines when present, else a single Tax row.
            if (q.taxLines.length > 1)
              ...q.taxLines.map((t) => _pRow(
                  'Tax${t.jurisdiction != null ? ' · ${t.jurisdiction}' : ''}',
                  t.amount))
            else if (q.tax > 0)
              _pRow('Tax', q.tax),
            const Divider(height: SSpace.xl),
            _pRow('Total', q.total, bold: true),
          ],
        ),
      );

  Widget _pRow(String l, double v,
          {bool bold = false, bool discount = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(l,
                style: TextStyle(
                    color: discount
                        ? SColors.green
                        : bold
                            ? SColors.ink
                            : SColors.muted,
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                    fontSize: bold ? 16 : 14)),
            Text(v < 0 ? '−${money(-v)}' : money(v),
                style: TextStyle(
                    color: discount ? SColors.green : SColors.ink,
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                    fontSize: bold ? 16 : 14)),
          ],
        ),
      );

  Widget _bottomBar(CheckoutProvider cp, CheckoutState s) {
    final held = s.hasLiveHold;
    final bookable = s.quote.bookable;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            SSpace.xl, SSpace.sm, SSpace.xl, SSpace.md),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: cp.busy || !bookable
                ? null
                : held
                    ? _pay
                    : _hold,
            style: ElevatedButton.styleFrom(
                backgroundColor: held ? SColors.green : SColors.clay),
            child: cp.busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.4))
                : Text(!bookable
                    ? 'Not available'
                    : held
                        ? (s.dueNow > 0
                            ? 'Pay ${money(s.dueNow)} · confirm'
                            : 'Confirm booking')
                        : 'Hold my spot · ${money(s.quote.total)}'),
          ),
        ),
      ),
    );
  }

  Widget _notice(String text, Color color) => Container(
        margin: const EdgeInsets.only(bottom: SSpace.md),
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            Icon(Icons.info_outline_rounded, size: 18, color: color),
            const SizedBox(width: SSpace.sm),
            Expanded(
                child: Text(text,
                    style: TextStyle(
                        color: SColors.ink2,
                        fontSize: 13,
                        fontWeight: FontWeight.w600))),
          ],
        ),
      );

  String _fmt(DateTime d) =>
      '${d.month}/${d.day} ${TimeOfDay.fromDateTime(d).format(context)}';
}

/// The step indicator, driven by the server's `step` / hold status.
class _StepStrip extends StatelessWidget {
  final String step;
  final bool held;
  const _StepStrip({required this.step, required this.held});

  @override
  Widget build(BuildContext context) {
    // Server steps collapse into the two the guest actually sees.
    final atPay = held || step == 'payment';
    Widget dot(String label, bool done, bool active) => Expanded(
          child: Column(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: active || done ? SColors.clay : SColors.paper2,
                  shape: BoxShape.circle,
                ),
                child: Icon(done ? Icons.check_rounded : Icons.circle,
                    size: done ? 16 : 8, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: active || done ? SColors.ink : SColors.muted)),
            ],
          ),
        );
    return Row(
      children: [
        dot('Review', atPay, !atPay),
        Container(width: 24, height: 2, color: SColors.line),
        dot('Pay', false, atPay),
      ],
    );
  }
}

/// Live countdown for the capacity hold.
class _HoldTimer extends StatefulWidget {
  final DateTime expiresAt;
  final VoidCallback? onExpired;
  const _HoldTimer({required this.expiresAt, this.onExpired});
  @override
  State<_HoldTimer> createState() => _HoldTimerState();
}

class _HoldTimerState extends State<_HoldTimer> {
  late Duration _left;
  bool _firedExpiry = false;

  @override
  void initState() {
    super.initState();
    _tick();
  }

  void _tick() {
    if (!mounted) return;
    setState(() => _left = widget.expiresAt.difference(DateTime.now()));
    if (_left.inSeconds > 0) {
      Future.delayed(const Duration(seconds: 1), _tick);
    } else if (!_firedExpiry) {
      // Hold lapsed — re-read the server so the UI drops back to "hold again".
      _firedExpiry = true;
      widget.onExpired?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final secs = _left.inSeconds.clamp(0, 59 * 60);
    final m = (secs ~/ 60).toString();
    final s = (secs % 60).toString().padLeft(2, '0');
    final expired = _left.inSeconds <= 0;
    return Container(
      margin: const EdgeInsets.only(bottom: SSpace.md),
      padding: const EdgeInsets.symmetric(
          horizontal: SSpace.md, vertical: SSpace.sm),
      decoration: BoxDecoration(
        color: SColors.greenSoft,
        borderRadius: BorderRadius.circular(SRadius.pill),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(expired ? Icons.timer_off_rounded : Icons.timer_rounded,
              size: 16, color: SColors.green),
          const SizedBox(width: 6),
          Text(
              expired
                  ? 'Hold expired'
                  : 'Spot held — $m:$s left to pay',
              style: const TextStyle(
                  color: SColors.green2, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _Success extends StatelessWidget {
  final Map<String, dynamic> booking;
  const _Success({required this.booking});

  @override
  Widget build(BuildContext context) {
    final data = (booking['data'] is Map)
        ? Map<String, dynamic>.from(booking['data'])
        : booking;
    final code = (data['dropoffCode'] ?? data['pickupCode'] ?? '').toString();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SSpace.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                  color: SColors.greenSoft, shape: BoxShape.circle),
              child: const Icon(Icons.check_rounded,
                  color: SColors.green, size: 40),
            ),
            const SizedBox(height: SSpace.lg),
            Text('You\'re booked',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: SSpace.sm),
            const Text('Show this code to the host at drop-off.',
                textAlign: TextAlign.center,
                style: TextStyle(color: SColors.muted)),
            if (code.isNotEmpty) ...[
              const SizedBox(height: SSpace.lg),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: SSpace.xl, vertical: SSpace.md),
                decoration: BoxDecoration(
                  color: SColors.paper2,
                  borderRadius: BorderRadius.circular(SRadius.md),
                ),
                child: Text(code,
                    style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 6)),
              ),
            ],
            const SizedBox(height: SSpace.xl),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  final id = (booking['sk'] ?? data['sk'] ?? '').toString();
                  if (id.isEmpty) {
                    Navigator.pop(context, true);
                    return;
                  }
                  // Replace checkout with the booking detail so Back lands home.
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                        builder: (_) => BookingDetailScreen(bookingId: id)),
                  );
                },
                child: const Text('View booking'),
              ),
            ),
            const SizedBox(height: SSpace.sm),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}
