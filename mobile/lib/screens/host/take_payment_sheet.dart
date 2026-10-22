import 'dart:async';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../services/stripe_terminal_service.dart';
import 'card_reader_screen.dart';

/// Host takes an in-person card payment via Tap to Pay (or a paired M2).
/// Generic — a booking balance, a tip, an add-on, or an ad-hoc walk-up.
///
/// Open from a booking (pass [bookingId] + [listingId] + optional [presetAmount])
/// or standalone for a walk-up (no booking → the host types a reference).
class TakePaymentSheet extends StatefulWidget {
  final String? bookingId;
  final String? listingId; // used to resolve a Stripe Terminal location
  final double? presetAmount;
  final String? presetCategory; // booking | tip | addon | adhoc | other
  // Resume a pending request straight into its waiting/QR panel.
  final String? resumeRequestId;
  final String? resumeUrl;
  final double? resumeAmount;
  const TakePaymentSheet({
    super.key,
    this.bookingId,
    this.listingId,
    this.presetAmount,
    this.presetCategory,
    this.resumeRequestId,
    this.resumeUrl,
    this.resumeAmount,
  });

  static Future<bool?> show(
    BuildContext context, {
    String? bookingId,
    String? listingId,
    double? presetAmount,
    String? presetCategory,
  }) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => TakePaymentSheet(
          bookingId: bookingId,
          listingId: listingId,
          presetAmount: presetAmount,
          presetCategory: presetCategory,
        ),
      );

  /// Re-open a pending payment request in its QR / waiting panel.
  static Future<bool?> resume(
    BuildContext context, {
    required String requestId,
    required String url,
    required double amount,
  }) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => TakePaymentSheet(
          resumeRequestId: requestId,
          resumeUrl: url,
          resumeAmount: amount,
        ),
      );

  @override
  State<TakePaymentSheet> createState() => _TakePaymentSheetState();
}

/// Payment categories the host must pick from so every payment is classified.
/// Ordered by how often a host reaches for them.
/// Search the host's bookings/items to link a payment to one. Returns the picked
/// row ({ booking, listing, reference, ... }) via Navigator.pop.
class _BookingSearchSheet extends StatefulWidget {
  const _BookingSearchSheet();
  @override
  State<_BookingSearchSheet> createState() => _BookingSearchSheetState();
}

class _BookingSearchSheetState extends State<_BookingSearchSheet> {
  final StowboApi _api = StowboApi();
  final _q = TextEditingController();
  Timer? _debounce;
  bool _searching = false;
  List<Map<String, dynamic>> _results = [];

  // Active bookings shown by default so the host can just PICK one — no need to
  // know a plate/code. Loaded from today's board (in custody + arriving +
  // leaving + overdue), deduped by booking.
  bool _loadingActive = true;
  List<Map<String, dynamic>> _active = [];

  @override
  void initState() {
    super.initState();
    _loadActive();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  Future<void> _loadActive() async {
    try {
      // Real bookings (carry the human `reference`, listing title, total) — not
      // the today feed, whose rows only have the raw sk. Show the ones a host
      // would collect on: anything not completed/settled/cancelled.
      final all = await _api.hostBookings();
      final active = all
          .where((b) => !const ['completed', 'settled', 'cancelled']
              .contains((b['status'] ?? '').toString()))
          .toList();
      if (!mounted) return;
      setState(() {
        _active = active;
        _loadingActive = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingActive = false);
    }
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _run(v.trim()));
  }

  Future<void> _run(String q) async {
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final res = await _api.hostResolve(q);
      if (!mounted) return;
      final rows = (res['results'] is List) ? res['results'] as List : const [];
      setState(() {
        _results = rows
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .where((e) => (e['booking'] ?? '').toString().isNotEmpty)
            .toList();
        _searching = false;
      });
    } catch (_) {
      if (mounted) setState(() => _searching = false);
    }
  }

  /// "Aug 31", "Aug 31 → Sep 2", or "Aug 31 · open".
  String _stayLabel(String? start, String? end) {
    final s = DateTime.tryParse(start ?? '')?.toLocal();
    if (s == null) return '';
    const mo = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final sLbl = '${mo[s.month]} ${s.day}';
    final e = DateTime.tryParse(end ?? '')?.toLocal();
    if (end == null || end.isEmpty || e == null) return '$sLbl · open';
    final eLbl = '${mo[e.month]} ${e.day}';
    return sLbl == eLbl ? sLbl : '$sLbl → $eLbl';
  }

  @override
  Widget build(BuildContext context) {
    final hasQuery = _q.text.trim().isNotEmpty;
    final rows = hasQuery ? _results : _active;
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
            Text('Pick a booking',
                style: Theme.of(context).textTheme.displayLarge),
            const SizedBox(height: SSpace.md),
            TextField(
              controller: _q,
              onChanged: _onChanged,
              decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: 'Search plate, name, phone, code, bay…'),
            ),
            const SizedBox(height: SSpace.sm),
            Text(hasQuery ? 'Results' : 'Active bookings',
                style: const TextStyle(
                    color: SColors.faint,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6)),
            const SizedBox(height: SSpace.xs),
            if (_searching || (!hasQuery && _loadingActive))
              const Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: Center(
                    child: CircularProgressIndicator(color: SColors.clay)),
              )
            else if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: SSpace.lg),
                child: Text(
                    hasQuery
                        ? 'Nothing matches.'
                        : 'No active bookings — search above, or take an ad-hoc payment.',
                    style: const TextStyle(color: SColors.muted)),
              )
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 340),
                child: ListView(
                  shrinkWrap: true,
                  children: rows.map((r) {
                    final ref = (r['reference'] ??
                            r['bookingName'] ??
                            r['booking'])
                        .toString();
                    final title =
                        (r['listingTitle'] ?? r['listing'] ?? '').toString();
                    final who = (r['customer'] ?? '').toString();
                    final overstaying = r['overstaying'] == true;
                    final currency = (r['currency'] ?? 'USD').toString();
                    final balance = double.tryParse('${r['balance']}') ?? 0;
                    final total = double.tryParse('${r['total']}') ?? 0;
                    final when =
                        _stayLabel(r['start']?.toString(), r['end']?.toString());
                    return ListTile(
                      leading: Icon(Icons.receipt_long_rounded,
                          color: overstaying ? SColors.danger : SColors.green),
                      title: Text('#$ref',
                          style:
                              const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                          [title, who, if (when.isNotEmpty) when]
                              .where((s) => s.isNotEmpty)
                              .join(' · '),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: balance > 0
                          ? Text('Due\n$currency ${balance.toStringAsFixed(2)}',
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                  color: SColors.clay,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12.5))
                          : (total > 0
                              ? Text('$currency ${total.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                      color: SColors.muted, fontSize: 12.5))
                              : null),
                      onTap: () => Navigator.pop(context, r),
                    );
                  }).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Tap to Pay on iPhone needs Apple's `proximity-reader.payment.acceptance`
/// entitlement, not granted for com.stowbo.stowbo yet. Until it is, the Stripe
/// Terminal SDK aborts (SIGABRT) the moment we use the phone as a reader — so the
/// button stays hidden and hosts collect via Send link / QR. Flip to true AFTER
/// Apple approves the entitlement and it's re-added to Runner.entitlements.
const bool kTapToPayEnabled = false;

const _categories = <String, String>{
  'booking': 'Booking payment',
  'balance': 'Balance due',
  'addon': 'Add-on / extra',
  'tip': 'Tip',
  'retrieval': 'Retrieval / valet fee',
  'deposit': 'Deposit',
  'damage': 'Damage / incident',
  'late': 'Late / overstay fee',
  'cleaning': 'Cleaning fee',
  'lost': 'Lost item / key',
  'upgrade': 'Upgrade',
  'walkin': 'Walk-in / drop-off',
  'adhoc': 'Ad-hoc',
  'other': 'Other',
};

class _TakePaymentSheetState extends State<TakePaymentSheet> {
  final StowboApi _api = StowboApi();
  late final TextEditingController _amount;
  final _reference = TextEditingController();
  final _description = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  String? _category; // null until the host explicitly picks — enforced on charge

  // Booking this payment is linked to (from the opener, or picked in the sheet).
  String? _pickedBookingId;
  String? _pickedListingId;
  String? _pickedBookingLabel;
  String? _pickedBookingContact; // the booking customer's email/phone (who gets the receipt)
  double? _bookingBalance; // what the linked booking owes — for under/over warning
  String? _bookingPayState; // live money state of the linked booking (paid/partial/…)

  // The linked booking owes nothing right now (fully paid). Guards against a stale
  // preset re-charging an already-settled booking.
  bool get _bookingSettled => _bookingPayState == 'paid';
  double get _amt => double.tryParse(_amount.text.trim()) ?? 0;

  bool _busy = false;
  String? _status;
  String? _error;

  // Receipt / summary state — shown AFTER a successful charge instead of a toast.
  // The host can print the ticket, email or text the receipt, then close.
  bool _done = false;
  String? _receiptRef; // gateway ref of the collected payment (for send/print)
  double _receiptAmount = 0;
  String? _receiptCategory;
  String? _receiptMsg; // inline confirmation ("Emailed ✓")
  bool _receiptBusy = false;

  // Waiting-for-payment state (only for the Send-link / Show-QR path — Tap to
  // Pay confirms on-device and never enters this).
  String? _waitId; // payment-request id being watched
  String? _waitUrl; // set for the QR path — rendered so the customer can scan
  String? _waitSentTo; // set for the send path — who the link went to
  double _waitAmount = 0;
  bool _paid = false;
  Timer? _poll;

  bool get _hasBooking => (_pickedBookingId ?? '').isNotEmpty;

  // An external M2/BBPOS reader is paired to this phone → we can take the card
  // on the reader right here (Tap to Pay is a separate, currently-gated path).
  bool get _hasReader => stripeTerminalService.isConnected;

  /// Explain partial amounts and differences from the current booking balance.
  /// Balance overpayments are blocked before requesting or collecting payment.
  Widget _balanceWarning() {
    final bal = _bookingBalance;
    if (!const ['balance', 'booking'].contains(_category) || bal == null || bal <= 0) return const SizedBox.shrink();
    final amt = double.tryParse(_amount.text.trim()) ?? 0;
    if (amt <= 0 || (amt - bal).abs() < 0.01) return const SizedBox.shrink();
    final under = amt < bal;
    final diff = (amt - bal).abs();
    final color = under ? SColors.danger : SColors.amber;
    return Padding(
      padding: const EdgeInsets.only(top: SSpace.sm),
      child: Container(
        padding: const EdgeInsets.all(SSpace.sm),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(SRadius.md)),
        child: Row(children: [
          Icon(under ? Icons.trending_down_rounded : Icons.trending_up_rounded,
              size: 16, color: color),
          const SizedBox(width: SSpace.sm),
          Expanded(
            child: Text(
                '${under ? 'Underpaying' : 'Overpaying'} by \$${diff.toStringAsFixed(2)} — this booking owes \$${bal.toStringAsFixed(2)}',
                style: TextStyle(color: color, fontSize: 12.5)),
          ),
          TextButton(
            onPressed: () =>
                setState(() => _amount.text = bal.toStringAsFixed(2)),
            style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.sm),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            child: const Text('Use balance'),
          ),
        ]),
      ),
    );
  }

  /// Shown when the linked booking already owes $0 — the honest counterpart to
  /// the balance warning, so the host isn't nudged into charging a paid booking.
  Widget _paidBanner() {
    return Padding(
      padding: const EdgeInsets.only(top: SSpace.sm),
      child: Container(
        padding: const EdgeInsets.all(SSpace.sm),
        decoration: BoxDecoration(
            color: SColors.green.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(SRadius.md)),
        child: Row(children: const [
          Icon(Icons.check_circle_rounded, size: 16, color: SColors.green),
          SizedBox(width: SSpace.sm),
          Expanded(
            child: Text('This booking is fully paid — nothing is due.',
                style: TextStyle(color: SColors.green, fontSize: 12.5)),
          ),
        ]),
      ),
    );
  }

  Widget _payPrimary(IconData icon, String label, VoidCallback onTap) =>
      ElevatedButton.icon(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
            backgroundColor: SColors.clay,
            minimumSize: const Size.fromHeight(54)),
        icon: Icon(icon, color: Colors.white),
        label: Text(label,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700)),
      );

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(
        text: widget.presetAmount != null && widget.presetAmount! > 0
            ? widget.presetAmount!.toStringAsFixed(2)
            : '');
    // Prefill only when the opener is certain (a booking → 'booking'). For an
    // ad-hoc take-payment we force the host to choose so nothing is miscategorized.
    _category = widget.presetCategory;
    _pickedBookingId = widget.bookingId;
    _pickedListingId = widget.listingId;
    // Opened from a booking → the preset amount IS what that booking owes; keep
    // it so we can warn on under/overpayment against it.
    if ((widget.bookingId ?? '').isNotEmpty &&
        widget.presetAmount != null &&
        widget.presetAmount! > 0) {
      _bookingBalance = widget.presetAmount;
    }

    // Opened from a booking → fetch its REAL amount due (incl. running meter),
    // which the stored total/balance misses for a metered/open stay. This is why
    // linking a parking booking used to preset $0.
    if ((widget.bookingId ?? '').isNotEmpty) {
      _loadBookingDue(widget.bookingId!);
    }

    // Resume mode — re-open straight into the waiting/QR panel and watch it.
    if ((widget.resumeRequestId ?? '').isNotEmpty) {
      _waitId = widget.resumeRequestId;
      _waitUrl = widget.resumeUrl;
      _waitAmount = widget.resumeAmount ?? 0;
      _startPolling(widget.resumeRequestId!);
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    for (final c in [_amount, _reference, _description, _email, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Pull the booking's real amount due from the server (billed balance + any
  /// running meter) and preset the amount to it. Only overrides an empty/preset
  /// amount — never stomps a figure the host is actively typing.
  Future<void> _loadBookingDue(String bookingId) async {
    final amountBeforeLookup = _amount.text;
    try {
      final res = await _api.bookingDue(bookingId);
      if (!mounted || res.isEmpty || _pickedBookingId != bookingId) return;
      final due = double.tryParse('${res['due'] ?? ''}') ?? 0;
      final paid = double.tryParse('${res['paid'] ?? ''}') ?? 0;
      final state = (res['payState'] ?? '').toString();
      // Settled = the server says paid, or nothing is left owing after real money
      // has come in. Either way the booking owes $0 right now.
      final settled = state == 'paid' || (paid > 0 && due <= 0.01);
      final amountUnchanged = _amount.text == amountBeforeLookup;
      setState(() {
        _bookingPayState = state.isNotEmpty ? state : (settled ? 'paid' : null);
        _bookingBalance = due;
        if (settled) {
          // Nothing due — NEVER leave a stale preset that could re-charge an
          // already-paid booking. Clear it unless the host has typed their own
          // figure (an intentional extra like a tip), which we leave untouched.
          if (amountUnchanged) _amount.text = '';
        } else if (due > 0 && amountUnchanged) {
          // Replace a stale search/preset amount with the current balance,
          // preserving edits made while the lookup was in flight.
          _amount.text = due.toStringAsFixed(2);
        }
      });
    } catch (_) {/* leave the preset as-is; the host can still type */}
  }

  Future<void> _charge() async {
    if (_busy) return;
    if (!_validCommon()) return;
    final amt = double.parse(_amount.text.trim());
    setState(() {
      _busy = true;
      _error = null;
      _status = 'Preparing reader…';
    });
    try {
      final svc = stripeTerminalService;
      await svc.restoreConnection();
      if (!mounted) return;

      // Make sure Tap to Pay is live (skip if an M2 is already connected).
      if (!svc.isConnected) {
        // A Stripe Terminal location is required. Resolve it from the listing.
        if ((_pickedListingId ?? '').isNotEmpty) {
          setState(() => _status = 'Setting up location…');
          await svc.ensureLocationForListing(_pickedListingId!);
        }
        setState(() => _status = 'Enabling Tap to Pay…');
        final ok = await svc.enableTapToPay(merchantDisplayName: 'Stowbo');
        if (!ok) {
          throw Exception(
              'Tap to Pay isn’t available on this device. Use iPhone XS+ on iOS 16.4+ or an NFC Android 11+, or pair an M2 reader.');
        }
      }

      // The method that will actually run: a paired external reader (M2/BBPOS)
      // takes the card ON THE READER; Tap to Pay reads it on the phone. Label
      // and RECORD each correctly — a reader charge must not read "Tap to Pay".
      final tapToPay = svc.isTapToPay;
      setState(() => _status = tapToPay
          ? 'Ask the customer to tap their card…'
          : 'Tap or insert the card on the reader…');
      final piId = await svc.takePayment(
        amount: amt,
        currency: 'usd',
        bookingId: _pickedBookingId,
        category: _category,
        email: _email.text.trim().isEmpty ? null : _email.text.trim(),
        description: _description.text.trim().isEmpty
            ? _categories[_category!]
            : _description.text.trim(),
      );

      setState(() => _status = 'Recording payment…');
      final res = await _api.takePayment({
        'paymentIntentId': piId,
        'amount': amt,
        'currency': 'usd',
        'category': _category!,
        // The real capture method — not always tap_to_pay.
        'channel': tapToPay ? 'tap_to_pay' : 'card_reader',
        if (_hasBooking) 'bookingId': _pickedBookingId,
        if (_reference.text.trim().isNotEmpty)
          'reference': _reference.text.trim(),
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      });
      if (res['ok'] != true && res['alreadyRecorded'] != true) {
        throw Exception('Payment collected but recording failed — check Stripe.');
      }

      if (!mounted) return;
      // The natural next step after money changes hands is a RECEIPT — print the
      // ticket, email/text it — not a toast that vanishes. Land there.
      // Show the amount that ACTUALLY captured (from Stripe), not what was typed.
      final captured = double.tryParse('${res['amount'] ?? ''}');
      setState(() {
        _busy = false;
        _status = null;
        _done = true;
        _receiptRef = (res['paymentRef'] ?? piId).toString();
        _receiptAmount = (captured != null && captured > 0) ? captured : amt;
        _receiptCategory = _category;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _status = null;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  bool _validCommon() {
    final amt = double.tryParse(_amount.text.trim()) ?? 0;
    if (amt <= 0) {
      setState(() => _error = 'Enter an amount greater than 0.');
      return false;
    }
    if (_category == null || _category!.isEmpty) {
      setState(() => _error = 'Pick a payment category so it’s recorded correctly.');
      return false;
    }
    if (_hasBooking &&
        const ['balance', 'booking'].contains(_category) &&
        _bookingBalance != null &&
        (amt * 100).round() > (_bookingBalance! * 100).round()) {
      setState(() => _error = _bookingBalance! <= 0
          ? 'This booking is fully paid. Choose a category such as Tip or Add-on for an extra charge.'
          : 'The remaining balance is \$${_bookingBalance!.toStringAsFixed(2)}. Reduce the amount or choose an extra-charge category.');
      return false;
    }
    return true;
  }

  Map<String, dynamic> _requestBody(double amt, bool send) => {
        'amount': amt,
        'currency': 'usd',
        'category': _category!,
        if (_hasBooking) 'bookingId': _pickedBookingId,
        if (_reference.text.trim().isNotEmpty) 'reference': _reference.text.trim(),
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        'send': send,
      };

  /// Self-serve fallbacks when the customer isn't tapping a card here:
  /// [send] true → text/email the pay link; false → show a QR to scan.
  Future<void> _requestLink({required bool send}) async {
    if (!_validCommon()) return;
    // A linked booking already carries the customer's email/phone — the server
    // resolves it, so don't force the host to re-type a contact we have.
    if (send &&
        !_hasBooking &&
        _email.text.trim().isEmpty &&
        _phone.text.trim().isEmpty) {
      setState(() => _error = 'Add a receipt email or phone to send the link to.');
      return;
    }
    final amt = double.parse(_amount.text.trim());
    setState(() {
      _busy = true;
      _error = null;
      _status = send ? 'Sending link…' : 'Creating link…';
    });
    try {
      final res = await _api
          .createPaymentRequest(_requestBody(amt, send))
          .timeout(const Duration(seconds: 15),
              onTimeout: () => throw Exception(
                  'The server took too long. Check your connection and try again.'));
      final url = (res['url'] ?? '').toString();
      final requestId = (res['paymentRequestId'] ?? '').toString();
      if (url.isEmpty || requestId.isEmpty) {
        throw Exception('No payment link was returned.');
      }
      if (!mounted) return;
      // Trust the SERVER on whether it actually delivered, and to whom — don't
      // claim "sent to the booking customer" when nothing went out.
      final serverSent = res['sent'] == true;
      final sentList = (res['sentTo'] is List)
          ? (res['sentTo'] as List)
              .map((e) => e.toString())
              .where((s) => s.isNotEmpty)
              .toList()
          : <String>[];
      // Enter the waiting state and watch for the customer to pay.
      setState(() {
        _busy = false;
        _status = null;
        _waitId = requestId;
        _waitAmount = amt;
        if (send && !serverSent) {
          // Asked to send but there was no contact to send to — fall back to the
          // QR so the host still has a way to collect, and say so.
          _waitUrl = url;
          _waitSentTo = null;
          _error = 'No contact on file to send to — show this QR to scan.';
        } else {
          _waitUrl = send ? null : url; // QR path renders the code
          _waitSentTo = send
              ? (sentList.isNotEmpty ? sentList.join(', ') : 'the customer')
              : null;
        }
      });
      _startPolling(requestId);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _status = null;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  /// Poll the request's status until the customer completes it. (A socket
  /// `payment-completed` push also fires server-side; polling is the reliable
  /// fallback and keeps this self-contained.)
  void _startPolling(String requestId) {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 3), (t) async {
      if (!mounted) {
        t.cancel();
        return;
      }
      try {
        final s = await _api.paymentRequestStatus(requestId);
        if (s['paid'] == true || s['status'] == 'paid') {
          t.cancel();
          if (!mounted) return;
          // Land on the receipt screen (print / email / text), same as an
          // in-person charge — the customer's already been charged on the web.
          setState(() {
            _paid = true;
            _done = true;
            _receiptRef = (s['ref'] ?? '').toString().isEmpty
                ? null
                : s['ref'].toString();
            _receiptAmount = _waitAmount;
            _receiptCategory = (s['category'] ?? _category)?.toString();
          });
        }
      } catch (_) {/* transient — keep polling */}
    });
  }

  /// The "linked booking" row — shows the picked booking, or a button to pick one.
  Widget _bookingField() {
    if (_hasBooking) {
      return Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.sm),
        decoration: BoxDecoration(
            color: SColors.greenSoft,
            borderRadius: BorderRadius.circular(SRadius.md)),
        child: Row(children: [
          const Icon(Icons.link_rounded, color: SColors.green, size: 18),
          const SizedBox(width: SSpace.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Booking · ${_pickedBookingLabel ?? _pickedBookingId}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                if ((_pickedBookingContact ?? '').isNotEmpty)
                  Text(_pickedBookingContact!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 12)),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 18),
            onPressed: _busy
                ? null
                : () => setState(() {
                      _pickedBookingId = null;
                      _pickedListingId = null;
                      _pickedBookingLabel = null;
                      _pickedBookingContact = null;
                      _bookingBalance = null;
                    }),
          ),
        ]),
      );
    }
    return OutlinedButton.icon(
      onPressed: _busy ? null : _pickBooking,
      icon: const Icon(Icons.link_rounded, size: 18),
      label: const Text('Link to a booking (optional)'),
      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
    );
  }

  /// Open reader pairing, then refresh so the Charge button appears if a reader
  /// got paired.
  Future<void> _openReaderPairing() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CardReaderScreen()),
    );
    if (mounted) setState(() {});
  }

  Future<void> _pickBooking() async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _BookingSearchSheet(),
    );
    if (picked != null) {
      // What the booking actually OWES — the outstanding balance, not the gross
      // total (a partly-paid booking would otherwise overcharge). Falls back to
      // total for older rows that don't carry a balance.
      final owed = double.tryParse('${picked['balance'] ?? ''}') ??
          double.tryParse('${picked['total'] ?? ''}');
      setState(() {
        _pickedBookingId = (picked['booking'] ?? '').toString();
        _pickedListingId = (picked['listing'] ?? '').toString();
        _pickedBookingLabel =
            (picked['reference'] ?? picked['booking'] ?? '').toString();
        _pickedBookingContact = (picked['customer'] ?? '').toString();
        _category ??= 'balance';
        // Paying for a booking → preset the amount to what that booking owes,
        // not whatever was typed. The host confirms/charges this.
        _bookingBalance = owed;
        if (owed != null && owed > 0) _amount.text = owed.toStringAsFixed(2);
      });
      // Then refine with the SERVER's real due (includes running meter) — the
      // list's stored balance reads $0 for a metered/open stay.
      final id = (picked['booking'] ?? '').toString();
      if (id.isNotEmpty) _loadBookingDue(id);
    }
  }

  /// Leave the sheet. Three cases, so the host is never trapped:
  ///  • Waiting on the customer (link/QR) and not yet paid → closing KEEPS the
  ///    request open; it stays pending and reappears under Transactions to reopen.
  ///  • Mid-charge (Tap to Pay) → confirm first: a tapped card may already be
  ///    processing, so we warn rather than silently drop it.
  ///  • Otherwise → just close (nothing was started).
  Future<void> _close() async {
    // On the receipt screen the money already landed — closing means "done".
    if (_done) {
      Navigator.pop(context, true);
      return;
    }
    if (_waitId != null && !_paid) {
      Navigator.pop(context, false); // request stays open — find it in Transactions
      return;
    }
    if (_busy) {
      final stop = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Stop taking payment?'),
          content: const Text(
              'If the customer already tapped their card, the charge may still go '
              'through. Check Transactions to be sure.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(c, false),
                child: const Text('Keep going')),
            TextButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('Stop',
                    style: TextStyle(color: SColors.danger))),
          ],
        ),
      );
      if (stop != true) return;
    }
    if (mounted) Navigator.pop(context, _paid);
  }

  /// Sheet header — a grab handle plus a close (X) that ALWAYS works, so there is
  /// a way out from every state (form, busy, or waiting). Never disabled.
  Widget _header(String title) {
    return Column(
      mainAxisSize: MainAxisSize.min,
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
        Row(
          children: [
            Expanded(
              child: Text(title,
                  style: Theme.of(context).textTheme.displayLarge),
            ),
            IconButton(
              tooltip: 'Close',
              onPressed: _close,
              icon: const Icon(Icons.close_rounded, color: SColors.muted),
            ),
          ],
        ),
      ],
    );
  }

  /// The receipt / summary shown the instant money lands — NOT a toast. Print the
  /// ticket, email or text it to the customer, then Done. Print uses the printing
  /// plugin (needs a rebuild to load); email/text hit the server (hot-reloadable).
  Widget _receiptView() {
    final catLabel = _receiptCategory != null
        ? (_categories[_receiptCategory] ?? _receiptCategory!)
        : 'Payment';
    // Sending a receipt needs the gateway ref to find the transaction. An
    // in-person charge always has it; a link/QR pay only after the status poll
    // returns it (older pays without one already got a web receipt).
    final canSend = _receiptRef != null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _header('Payment received'),
        const SizedBox(height: SSpace.md),
        Container(
          width: 88,
          height: 88,
          decoration: const BoxDecoration(
              color: SColors.greenSoft, shape: BoxShape.circle),
          child:
              const Icon(Icons.check_rounded, color: SColors.green, size: 50),
        ),
        const SizedBox(height: SSpace.md),
        Text('\$${_receiptAmount.toStringAsFixed(2)}',
            style: const TextStyle(
                fontSize: 34, fontWeight: FontWeight.w800, color: SColors.ink)),
        const SizedBox(height: 2),
        Text(catLabel,
            style: const TextStyle(color: SColors.muted, fontSize: 13)),
        if (_pickedBookingLabel != null) ...[
          const SizedBox(height: 2),
          Text('Booking · $_pickedBookingLabel',
              style: const TextStyle(color: SColors.faint, fontSize: 12)),
        ],
        const SizedBox(height: SSpace.lg),
        if (_receiptMsg != null) ...[
          Container(
            padding: const EdgeInsets.all(SSpace.sm),
            decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.check_circle_rounded,
                  color: SColors.green, size: 16),
              const SizedBox(width: SSpace.xs),
              Flexible(
                  child: Text(_receiptMsg!,
                      style: const TextStyle(
                          color: SColors.green, fontSize: 12.5))),
            ]),
          ),
          const SizedBox(height: SSpace.md),
        ],
        // Print — the most physical, so it leads.
        _payPrimary(Icons.print_rounded, 'Print ticket',
            _receiptBusy ? () {} : _printReceipt),
        const SizedBox(height: SSpace.sm),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: (!canSend || _receiptBusy)
                  ? null
                  : () => _sendReceipt(byEmail: true),
              icon: const Icon(Icons.email_outlined, size: 18),
              label: const Text('Email receipt'),
              style:
                  OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
          ),
          const SizedBox(width: SSpace.sm),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: (!canSend || _receiptBusy)
                  ? null
                  : () => _sendReceipt(byEmail: false),
              icon: const Icon(Icons.sms_outlined, size: 18),
              label: const Text('Text receipt'),
              style:
                  OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
          ),
        ]),
        const SizedBox(height: SSpace.md),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Done',
              style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  /// Email or text the receipt. Uses a typed email/phone if present, else the
  /// linked booking's customer (resolved server-side). Prompts for a contact when
  /// there's neither.
  Future<void> _sendReceipt({required bool byEmail}) async {
    final ref = _receiptRef;
    if (ref == null) return; // need the txn ref to locate the payment
    final email = _email.text.trim();
    final phone = _phone.text.trim();
    if (byEmail && email.isEmpty && !_hasBooking) {
      return _promptContact(byEmail: true);
    }
    if (!byEmail && phone.isEmpty && !_hasBooking) {
      return _promptContact(byEmail: false);
    }
    setState(() {
      _receiptBusy = true;
      _receiptMsg = null;
    });
    try {
      await _api.sendReceipt(ref,
          email: byEmail ? (email.isEmpty ? null : email) : null,
          phone: byEmail ? null : (phone.isEmpty ? null : phone),
          bookingId: _hasBooking ? _pickedBookingId : null);
      if (!mounted) return;
      setState(() {
        _receiptBusy = false;
        // With no explicit address the server picks the customer's contact
        // (email if they have one, else SMS) — so don't claim "Emailed".
        _receiptMsg = byEmail && email.isNotEmpty
            ? 'Emailed to $email ✓'
            : !byEmail && phone.isNotEmpty
                ? 'Texted to $phone ✓'
                : 'Receipt sent to the booking customer ✓';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _receiptBusy = false;
        _receiptMsg =
            'Couldn’t send: ${e.toString().replaceFirst('Exception: ', '')}';
      });
    }
  }

  /// Ask for an email/phone when the receipt has no destination, then send.
  Future<void> _promptContact({required bool byEmail}) async {
    final c = TextEditingController(text: byEmail ? _email.text : _phone.text);
    final val = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(byEmail ? 'Email receipt to' : 'Text receipt to'),
        content: TextField(
          controller: c,
          autofocus: true,
          keyboardType:
              byEmail ? TextInputType.emailAddress : TextInputType.phone,
          decoration: InputDecoration(
              hintText: byEmail ? 'name@email.com' : 'Phone number'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim()),
              child: const Text('Send')),
        ],
      ),
    );
    if (val == null || val.isEmpty) return;
    if (byEmail) {
      _email.text = val;
    } else {
      _phone.text = val;
    }
    await _sendReceipt(byEmail: byEmail);
  }

  /// Render a compact 80mm receipt and hand it to AirPrint / the system printer.
  /// The printing plugin is native — if the running build predates it, we say so
  /// rather than crash, and the host can email/text instead.
  Future<void> _printReceipt() async {
    setState(() {
      _receiptBusy = true;
      _receiptMsg = null;
    });
    try {
      final catLabel = _receiptCategory != null
          ? (_categories[_receiptCategory] ?? _receiptCategory!)
          : 'Payment';
      final now = DateTime.now();
      final doc = pw.Document();
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.roll80,
          build: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Center(
                  child: pw.Text('STOWBO',
                      style: pw.TextStyle(
                          fontSize: 18, fontWeight: pw.FontWeight.bold))),
              pw.SizedBox(height: 3),
              pw.Center(
                  child: pw.Text('Payment receipt',
                      style: const pw.TextStyle(fontSize: 10))),
              pw.Divider(),
              _pwRow('Amount', '\$${_receiptAmount.toStringAsFixed(2)}'),
              _pwRow('For', catLabel),
              if (_pickedBookingLabel != null)
                _pwRow('Booking', _pickedBookingLabel!),
              if (_reference.text.trim().isNotEmpty)
                _pwRow('Ref', _reference.text.trim()),
              if (_receiptRef != null) _pwRow('Txn', _receiptRef!),
              _pwRow('Date', now.toLocal().toString().split('.').first),
              pw.Divider(),
              pw.Center(
                  child: pw.Text('Thank you',
                      style: const pw.TextStyle(fontSize: 10))),
            ],
          ),
        ),
      );
      await Printing.layoutPdf(onLayout: (_) => doc.save());
      if (mounted) setState(() => _receiptBusy = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _receiptBusy = false;
        _receiptMsg =
            'Printing needs an app restart to load — email or text the receipt for now.';
      });
    }
  }

  pw.Widget _pwRow(String k, String v) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 2),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(k, style: const pw.TextStyle(fontSize: 10)),
            pw.Text(v,
                style:
                    pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
          ],
        ),
      );

  Widget _waitingPanel() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _header(_paid ? 'Paid ✓' : 'Waiting for payment'),
        const SizedBox(height: SSpace.xs),
        Text('\$${_waitAmount.toStringAsFixed(2)}',
            style: const TextStyle(
                fontSize: 22, fontWeight: FontWeight.w700, color: SColors.ink)),
        const SizedBox(height: SSpace.lg),
        if (_paid) ...[
          Container(
            width: 96,
            height: 96,
            decoration: const BoxDecoration(
                color: SColors.greenSoft, shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded,
                color: SColors.green, size: 56),
          ),
          const SizedBox(height: SSpace.md),
          const Text('Payment received. Closing…',
              style: TextStyle(color: SColors.muted, fontSize: 13)),
        ] else ...[
          if (_waitUrl != null) ...[
            Container(
              padding: const EdgeInsets.all(SSpace.md),
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: QrImageView(
                  data: _waitUrl!, size: 220, backgroundColor: Colors.white),
            ),
            const SizedBox(height: SSpace.md),
            const Text('Ask the customer to scan to pay.',
                textAlign: TextAlign.center,
                style: TextStyle(color: SColors.muted, fontSize: 13)),
          ] else ...[
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                  color: SColors.claySoft, shape: BoxShape.circle),
              child: const Icon(Icons.send_rounded,
                  color: SColors.clay, size: 34),
            ),
            const SizedBox(height: SSpace.md),
            Text('Link sent to $_waitSentTo',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: SSpace.lg),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: SColors.clay)),
              SizedBox(width: SSpace.sm),
              Text('Waiting for the customer to pay…',
                  style: TextStyle(color: SColors.muted, fontSize: 13)),
            ],
          ),
        ],
        const SizedBox(height: SSpace.lg),
        if (_paid)
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Done', style: TextStyle(color: SColors.muted)),
          )
        else ...[
          // Leaving does NOT drop the request — it stays open so the customer can
          // still pay from their link/QR, and the host reopens it from Transactions.
          OutlinedButton.icon(
            onPressed: () => Navigator.pop(context, false),
            icon: const Icon(Icons.schedule_rounded, size: 18),
            label: const Text('Keep waiting in the background'),
            style:
                OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          ),
          const SizedBox(height: SSpace.xs),
          const Text('It stays open — reopen it any time from Transactions.',
              textAlign: TextAlign.center,
              style: TextStyle(color: SColors.faint, fontSize: 11)),
        ],
      ],
    );
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
        child: SingleChildScrollView(
          child: _done
              ? _receiptView()
              : _waitId != null
              ? _waitingPanel()
              : Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _header('Take payment'),
              const SizedBox(height: SSpace.xs),
              Text(
                  _hasBooking
                      ? 'Tap the customer’s card to collect on this booking.'
                      : 'Collect a card payment — no app needed for the customer.',
                  style: const TextStyle(color: SColors.muted, fontSize: 13)),
              const SizedBox(height: SSpace.lg),

              TextField(
                controller: _amount,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(
                    fontSize: 30, fontWeight: FontWeight.w700),
                decoration: const InputDecoration(
                    prefixText: '\$ ',
                    prefixStyle: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w700,
                        color: SColors.ink),
                    hintText: '0.00',
                    border: InputBorder.none),
              ),
              const Divider(color: SColors.line),
              _balanceWarning(),
              if (_bookingSettled) _paidBanner(),
              const SizedBox(height: SSpace.sm),

              DropdownButtonFormField<String>(
                initialValue: _category,
                isExpanded: true,
                decoration: const InputDecoration(
                    labelText: 'Payment category *',
                    hintText: 'Select a category'),
                hint: const Text('Select a category',
                    style: TextStyle(color: SColors.faint)),
                items: _categories.entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged:
                    _busy ? null : (v) => setState(() => _category = v),
              ),
              const SizedBox(height: SSpace.md),

              // Link to a booking (or show / change the linked one).
              _bookingField(),
              const SizedBox(height: SSpace.md),

              if (!_hasBooking) ...[
                TextField(
                  controller: _reference,
                  decoration: const InputDecoration(
                      labelText: 'Reference (optional)',
                      hintText: 'Plate, name, ticket #'),
                ),
                const SizedBox(height: SSpace.md),
              ],

              // Receipt destinations — full width, one per row (roomier). When a
              // booking is linked, its customer already gets the receipt, so
              // these are only for sending to a DIFFERENT address.
              if (_hasBooking) ...[
                Row(children: const [
                  Icon(Icons.check_circle_outline_rounded,
                      size: 15, color: SColors.green),
                  SizedBox(width: SSpace.xs),
                  Expanded(
                    child: Text(
                        'The booking customer gets the receipt automatically.',
                        style: TextStyle(color: SColors.muted, fontSize: 12)),
                  ),
                ]),
                const SizedBox(height: SSpace.sm),
              ],
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                    labelText: _hasBooking
                        ? 'Also email a copy to (optional)'
                        : 'Receipt email (optional)'),
              ),
              const SizedBox(height: SSpace.md),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                    labelText: _hasBooking
                        ? 'Also text a copy to (optional)'
                        : 'Receipt SMS (optional)'),
              ),
              const SizedBox(height: SSpace.md),

              // Description last.
              TextField(
                controller: _description,
                textCapitalization: TextCapitalization.sentences,
                minLines: 1,
                maxLines: 3,
                decoration:
                    const InputDecoration(labelText: 'Description (optional)'),
              ),

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

              if (_busy) ...[
                // One clear working state — not status buried in a button label.
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: SSpace.md),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: SColors.clay)),
                      const SizedBox(width: SSpace.sm),
                      Flexible(
                        child: Text(_status ?? 'Working…',
                            style: const TextStyle(color: SColors.muted)),
                      ),
                    ],
                  ),
                ),
              ] else if (_bookingSettled && _amt <= 0) ...[
                // Booking owes nothing — don't invite a re-charge. To collect an
                // extra (tip, damage), the host types an amount and the normal
                // actions come back.
                OutlinedButton.icon(
                  onPressed: _close,
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52)),
                  icon: const Icon(Icons.check_rounded, size: 18),
                  label: const Text('Done — nothing due'),
                ),
                const SizedBox(height: SSpace.xs),
                const Center(
                  child: Text('Choose an extra-charge category, then enter the amount.',
                      style: TextStyle(color: SColors.faint, fontSize: 11)),
                ),
              ] else ...[
                // Ordered by directness. 1) IN PERSON — charge on the reader
                // (or set one up), always the first option.
                if (_hasReader)
                  _payPrimary(
                      Icons.contactless_rounded, 'Charge on card reader', _charge)
                else if (kTapToPayEnabled)
                  _payPrimary(
                      Icons.contactless_rounded, 'Charge via Tap to Pay', _charge)
                else
                  OutlinedButton.icon(
                    onPressed: _openReaderPairing,
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                        side: const BorderSide(color: SColors.clay)),
                    icon: const Icon(Icons.contactless_rounded,
                        size: 18, color: SColors.clay),
                    label: const Text('Pair a card reader to charge here',
                        style: TextStyle(
                            color: SColors.clay, fontWeight: FontWeight.w700)),
                  ),

                const SizedBox(height: SSpace.md),
                Row(children: [
                  const Expanded(child: Divider(color: SColors.line)),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: SSpace.sm),
                    child: Text('or have them pay',
                        style: TextStyle(color: SColors.faint, fontSize: 11)),
                  ),
                  const Expanded(child: Divider(color: SColors.line)),
                ]),
                const SizedBox(height: SSpace.md),

                // 2) SEND A LINK   3) SHOW A QR — the customer pays themselves.
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _requestLink(send: true),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(50)),
                      icon: const Icon(Icons.ios_share_rounded, size: 18),
                      label: const Text('Send link'),
                    ),
                  ),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _requestLink(send: false),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(50)),
                      icon: const Icon(Icons.qr_code_rounded, size: 18),
                      label: const Text('Show QR'),
                    ),
                  ),
                ]),
              ],
              const SizedBox(height: SSpace.sm),
              const Center(
                child: Text('Powered by Stripe · card never leaves the customer',
                    style: TextStyle(color: SColors.faint, fontSize: 11)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
