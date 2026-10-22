import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_stripe/flutter_stripe.dart' as stripe;
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../models/pos_order_model.dart';
import '../../providers/pos_provider.dart';
import '../../providers/contacts_provider.dart';
import '../../models/contact_model.dart';
import '../../providers/pos_device_settings.dart';
import '../../services/payment_service.dart';
import '../../services/pos_service.dart';
import '../../services/pending_pos_payment.dart';
import '../../services/http_client.dart';
import '../../utils/pos_tender_amounts.dart';
import '../../utils/terminal_display.dart';
import '../../services/printer_service.dart';
import '../../services/stripe_terminal_service.dart';
import '../settings/business_location_settings_screen.dart';

/// One row in the tender list — a single payment toward the order's total.
/// Mirrors the React `Tender` type in business-made POS.tsx:80-99.
class Tender {
  final String id;
  String method; // 'cash' | 'card' | 'terminal' | 'bank' | 'other'
  num amount;
  num? tendered; // for cash — how much the customer handed over
  String? gateway;
  String? ref;
  bool charged;
  bool processing;
  String? error;
  String? transactionId;
  num principal = 0;
  num tipAmount = 0;
  bool attemptStarted = false;

  Tender({
    required this.id,
    required this.method,
    required this.amount,
    this.tendered,
    this.gateway,
    this.ref,
    this.charged = false,
    this.processing = false,
    this.error,
    this.transactionId,
  });

  num get change {
    if (method != 'cash' || tendered == null) return 0;
    final c = tendered! - amount;
    return c > 0 ? c : 0;
  }

  /// "terminal" covers BOTH a paired Bluetooth reader (M2, BBPOS, WisePad)
  /// AND Tap to Pay on this device — both go through the same Stripe
  /// Terminal SDK code path. The label below reflects whichever method
  /// is actually paired so the operator isn't confused about which they're
  /// using at the moment they take the payment.
  static String labelForMethod(String m) {
    switch (m) {
      case 'cash':
        return 'Cash';
      case 'card':
        return 'Card (online)';
      case 'taptopay':
        return 'Tap to Pay';
      case 'm2':
        return 'M2 reader';
      case 'terminal':
        // Legacy — older saved tabs may still carry this. Treat as in-person.
        return 'Card (in-person)';
      case 'bank':
        return 'Bank transfer';
      case 'other':
        return 'Other';
      default:
        return m;
    }
  }

  static IconData iconForMethod(String m) {
    switch (m) {
      case 'cash':
        return Icons.payments_outlined;
      case 'card':
        return Icons.credit_card;
      case 'taptopay':
      case 'terminal':
        return Icons.contactless;
      case 'm2':
        return Icons.credit_card_outlined;
      case 'bank':
        return Icons.account_balance;
      default:
        return Icons.attach_money;
    }
  }
}

/// Full-screen checkout — the polished settle flow.
///
/// Layout:
///   Top:    Order summary (items count + subtotal/tax/total)
///   Middle: Tip picker (0 / 15 / 18 / 20 / custom %)
///   Below:  Tender list — each row has its own Charge button + state.
///           "Split" toggle adds more rows. Each tender can be a different
///           method; one card can include the tip.
///   Bottom: Receipt-delivery row (Print / Email / SMS / None) + Done.
///
/// All tender rows execute independently when their Charge button is hit.
/// Once the sum of charged amounts ≥ total, the screen marks the tab paid
/// and offers receipt delivery.
class CheckoutScreen extends StatefulWidget {
  final PosOrder order;
  const CheckoutScreen({super.key, required this.order});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  late List<Tender> _tenders;
  final _paymentOrg = appengineHttpClient.orgId;
  bool _settingsReady = false;
  num _tip = 0;
  num _tipPercent = 0;
  String _receiptMode = 'print'; // 'print' | 'email' | 'sms' | 'none'
  bool _sendingReceipt = false;
  String? _receiptStatus;
  final _receiptContact = TextEditingController();

  /// Whether the receipt delivery section is visible — flips true once at
  /// least the total is covered by charged tenders.
  bool get _fullyPaid {
    final paid = _tenders.fold<num>(
      0,
      (s, t) => s + (t.charged ? t.amount : 0),
    );
    return paid >= (_grandTotal);
  }

  num get _baseDue =>
      (widget.order.total - widget.order.amountPaid).clamp(0, double.infinity);
  num get _grandTotal => _baseDue + _tip;
  bool get _paymentLocked =>
      _tenders.any((t) => t.processing || t.attemptStarted || t.charged);
  num get _due {
    final paid = _tenders.fold<num>(
      0,
      (s, t) => s + (t.charged ? t.amount : 0),
    );
    final d = _grandTotal - paid;
    return d > 0 ? d : 0;
  }

  @override
  void initState() {
    super.initState();
    _tenders = [
      Tender(
        id: 'tender-${DateTime.now().microsecondsSinceEpoch}',
        method: 'cash',
        amount: _baseDue,
      ),
    ];
    _receiptContact.text = widget.order.email ?? widget.order.phone ?? '';
    // Offer printing first only on a register with a receipt printer paired;
    // otherwise start on email for a known guest, or no receipt.
    if (!printerService.isConnected) {
      _receiptMode = _receiptContact.text.contains('@') ? 'email' : 'none';
      printerService.hasSavedDefault().then((saved) {
        if (saved && mounted && _receiptMode != 'print') setState(() => _receiptMode = 'print');
      });
    }
    _loadDeviceSettings();
  }

  String _defaultMethod() {
    final methods = context.read<PosDeviceSettings>().enabledMethods.where(
      (m) =>
          m != 'taptopay' || stripeTerminalService.tapToPaySupported != false,
    );
    return methods.isEmpty ? '' : methods.first;
  }

  Future<void> _loadDeviceSettings() async {
    await context.read<PosDeviceSettings>().ready;
    final pending = await PendingPosPayment.load(
      widget.order.sk,
      orgId: _paymentOrg,
    );
    if (!mounted) return;
    setState(() {
      _tenders.first.method = _defaultMethod();
      if (pending != null) {
        _tip = pending['totalTip'] as num;
        final tender = Tender(
          id: pending['id'] as String,
          method: pending['method'] as String,
          amount: pending['amount'] as num,
          ref: pending['ref'] as String?,
        );
        tender.principal = pending['principal'] as num;
        tender.tipAmount = pending['tip'] as num;
        tender.attemptStarted = true;
        tender.error = 'An unfinished payment is saved. Resume it to check Stripe and finish recording it without creating a new charge.';
        _tenders = [tender];
      }
      _settingsReady = true;
    });
  }

  @override
  void dispose() {
    _receiptContact.dispose();
    super.dispose();
  }

  void _setTipPercent(num pct) {
    if (_paymentLocked) return;
    setState(() {
      _tipPercent = pct;
      _tip = (widget.order.total * pct / 100).toDouble();
      _redistributeAmounts();
    });
  }

  void _setCustomTip(num amount) {
    if (_paymentLocked) return;
    setState(() {
      _tip = amount;
      _tipPercent = 0;
      _redistributeAmounts();
    });
  }

  /// When tip changes, rebalance the FIRST uncharged tender to absorb
  /// the delta. Already-charged tenders are locked.
  void _redistributeAmounts() {
    final paid = _tenders.fold<num>(
      0,
      (s, t) => s + (t.charged ? t.amount : 0),
    );
    final remaining = _grandTotal - paid;
    final firstOpenIdx = _tenders.indexWhere((t) => !t.charged);
    if (firstOpenIdx >= 0) {
      // Distribute remaining evenly across uncharged tenders.
      final openCount = _tenders.where((t) => !t.charged).length;
      final perRow = openCount > 0 ? remaining / openCount : 0;
      for (var i = 0; i < _tenders.length; i++) {
        if (!_tenders[i].charged) {
          _tenders[i].amount = perRow > 0 ? perRow : 0;
        }
      }
    }
  }

  /// A split bill: when one open tender's amount is typed, the last other open
  /// tender takes what is left, so the tenders always add up to what is due.
  void _absorbRemainder(int edited) {
    final open = [
      for (var i = 0; i < _tenders.length; i++)
        if (!_tenders[i].charged && !_tenders[i].attemptStarted) i,
    ];
    final others = open.where((i) => i != edited).toList();
    if (others.isEmpty) return;
    final taker = others.last;
    final covered = _tenders.asMap().entries
        .where((e) => e.key != taker && (e.value.charged || open.contains(e.key)))
        .fold<num>(0, (s, e) => s + e.value.amount);
    final left = ((_grandTotal - covered) * 100).roundToDouble() / 100;
    _tenders[taker].amount = left > 0 ? left : 0;
  }

  void _addTender() {
    if (_tenders.any((t) => t.processing || (t.attemptStarted && !t.charged)))
      return;
    final id = 'tender-${DateTime.now().microsecondsSinceEpoch}';
    setState(() {
      _tenders.add(Tender(id: id, method: _defaultMethod(), amount: _due));
      _redistributeAmounts();
    });
  }

  void _removeTender(int i) {
    if (_tenders[i].charged || _tenders[i].attemptStarted) return;
    setState(() {
      _tenders.removeAt(i);
      _redistributeAmounts();
    });
  }

  Future<void> _chargeTender(int i) async {
    final t = _tenders[i];
    if (t.charged || _tenders.any((t) => t.processing)) return;
    if (t.amount <= 0) return;
    if (!context.read<PosDeviceSettings>().allows(t.method)) {
      setState(
        () => t.error = 'This payment method is disabled on this device.',
      );
      return;
    }

    // Capture provider before async gaps — context.read is unsafe later.
    final pos = context.read<PosProvider>();

    setState(() {
      t.processing = true;
      t.error = null;
    });
    // Hoisted so the catch block can include the Stripe ref in the
    // error message — operator needs to know if money moved.
    String? gatewayRef = t.method == 'card' ? t.ref : null;
    String gatewayName = t.method;
    try {
      if (!t.attemptStarted) {
        final amounts = posTenderAmounts(
          gross: t.amount,
          principalDue:
              _baseDue -
              _tenders
                  .where((x) => x.charged)
                  .fold<num>(0, (sum, x) => sum + x.principal),
          tipDue:
              _tip -
              _tenders
                  .where((x) => x.charged)
                  .fold<num>(0, (sum, x) => sum + x.tipAmount),
        );
        t.principal = amounts.principal;
        t.tipAmount = amounts.tip;
        await posService.preflightPayment(
          orderId: widget.order.sk,
          amount: t.principal,
          tip: t.tipAmount,
          currency: widget.order.currency,
          businessLocationId: widget.order.businessLocationId,
        );
        if (t.method == 'cash' &&
            t.tendered != null &&
            t.tendered! < t.amount) {
          throw StateError('Cash tendered is less than the payment and tip.');
        }
        t.attemptStarted = true;
        await _savePending(t);
      }
      if (!mounted || appengineHttpClient.orgId != _paymentOrg) {
        throw StateError(
          'Session changed. Resume this payment in the original organization.',
        );
      }
      if (t.method == 'card') {
        final piId = await _runStripeOnline(t);
        if (piId == null) {
          setState(() => t.processing = false);
          return;
        }
        gatewayRef = piId;
        gatewayName = 'stripe';
      } else if (t.method == 'taptopay' || t.method == 'm2') {
        final wantTapToPay = t.method == 'taptopay';
        if (wantTapToPay) {
          // Tap to Pay is built-in to the device — no "pair" step, just
          // an SDK init. Do it transparently here the first time the
          // operator picks the chip. Surfaces errors only when something
          // is genuinely wrong (no Stripe Location, device unsupported).
          if (!stripeTerminalService.isBoundToBusinessLocation(
            widget.order.businessLocationId,
          )) {
            await stripeTerminalService.ensureLocationForBusinessLocation(
              widget.order.businessLocationId,
            );
          }
          if (!stripeTerminalService.isConnected ||
              stripeTerminalService.connectionKind != 'tapToPay') {
            await stripeTerminalService.enableTapToPay(
              merchantDisplayName: 'Appmint',
            );
          }
        } else {
          // M2 / BLE is real external hardware. If nothing's paired, the
          // operator needs to pair it once in Devices — we don't try to
          // auto-pair during a sale.
          if (t.ref == null &&
              (!stripeTerminalService.isConnected ||
                  stripeTerminalService.connectionKind != 'bluetooth')) {
            setState(() {
              t.processing = false;
              t.error = 'No M2 reader paired. Pair one in Devices first.';
            });
            return;
          }
        }
        final piId = await stripeTerminalService.takePayment(
          amount: t.amount,
          tip: t.tipAmount,
          attemptId: t.id,
          existingIntentId: t.ref,
          onIntentCreated: (ref) async {
            t.ref = ref;
            await _savePending(t);
          },
          businessLocationId: widget.order.businessLocationId,
          currency: widget.order.currency.isNotEmpty
              ? widget.order.currency
              : 'USD',
          orderId: widget.order.sk,
          email: widget.order.email,
        );
        gatewayRef = piId;
        gatewayName = 'stripe';
      }

      // Settle this tender against the tab on the backend. Throws on
      // failure — critical, since Stripe / Terminal have already moved
      // money at this point. We catch below and tell the operator the
      // payment ref so they can reconcile if the order-side record
      // didn't land.
      t.ref = gatewayRef ?? t.ref;
      t.gateway = gatewayName;
      await _savePending(t);
      if (appengineHttpClient.orgId != _paymentOrg) {
        throw StateError(
          'Session changed. Payment is saved for recovery in the original organization.',
        );
      }
      await pos.settleActive(
        orderId: widget.order.sk,
        amount: t.principal,
        tip: t.tipAmount,
        tendered: t.tendered,
        method: gatewayName,
        gateway: gatewayRef != null ? 'stripe' : null,
        ref: gatewayRef ?? t.ref,
      );
      await PendingPosPayment.clear(widget.order.sk, orgId: _paymentOrg);
      if (!mounted) return;
      setState(() {
        t.processing = false;
        t.charged = true;
        t.gateway = gatewayName;
        t.ref = gatewayRef ?? t.ref;
      });

      // Cash → kick drawer immediately (no need to wait for receipt).
      if (t.method == 'cash') {
        printerService.openDrawer().catchError((e) {
          if (kDebugMode) debugPrint('Drawer kick skipped: $e');
        });
      }
    } catch (e) {
      if (!mounted) return;
      // If Stripe already confirmed before the order-side settle errored
      // we have a real charge with no order record — surface the PI ref
      // loud and clear so the operator can reconcile.
      final base = terminalErrorMessage(e);
      final ref = gatewayRef ?? '';
      final msg = ref.isNotEmpty
          ? 'Card payment received. Recording is unfinished: $base. Resume this payment to record it; do not charge again.'
          : base;
      setState(() {
        t.processing = false;
        t.error = msg;
      });
    }
  }

  Future<void> _savePending(Tender t) =>
      PendingPosPayment.save(widget.order.sk, {
        'id': t.id,
        'method': t.method,
        'amount': t.amount,
        'principal': t.principal,
        'tip': t.tipAmount,
        'totalTip':
            _tip -
            _tenders
                .where((other) => other.charged)
                .fold<num>(0, (sum, other) => sum + other.tipAmount),
        'ref': t.ref,
      }, orgId: _paymentOrg);

  Future<String?> _runStripeOnline(Tender tender) async {
    final amount = tender.amount;
    final currency = widget.order.currency.isNotEmpty
        ? widget.order.currency
        : 'USD';
    final email = (widget.order.email ?? '').isNotEmpty
        ? widget.order.email
        : null;

    final gw = await paymentService.findGateway(
      provider: 'StripeProvider',
      amount: amount,
      currency: currency,
    );
    if (gw == null) {
      throw Exception(
        'Stripe is not configured. Add a StripeProvider integration.',
      );
    }
    final pk = (gw.publishableKey ?? '').trim();
    if (pk.isEmpty) throw Exception('Stripe gateway missing publishableKey.');
    stripe.Stripe.publishableKey = pk;
    await stripe.Stripe.instance.applySettings();

    final response = await appengineHttpClient.post(
      tender.ref != null
          ? '/storefront/stripe/terminal/payment-status'
          : '/storefront/stripe/pos/intent',
      body: {
        'amount': amount,
        'tip': tender.tipAmount,
        'currency': currency,
        'orderId': widget.order.sk,
        'businessLocationId': widget.order.businessLocationId,
        'attemptId': tender.id,
        if (tender.ref != null) 'paymentIntentId': tender.ref,
        if (email != null) 'email': email,
      },
    );
    if (response is! Map || response['id'] is! String)
      throw StateError('Payment reference missing.');
    tender.ref = response['id'] as String;
    await _savePending(tender);
    if (response['status'] == 'succeeded') return tender.ref;
    if ([
      'processing',
      'requires_capture',
      'canceled',
    ].contains(response['status'])) {
      throw StateError(
        'Payment is ${response['status']}. Check this payment before starting another charge.',
      );
    }
    final clientSecret = response['client_secret'] as String?;
    if (clientSecret == null) throw StateError('Cannot resume this payment.');
    await stripe.Stripe.instance.initPaymentSheet(
      paymentSheetParameters: stripe.SetupPaymentSheetParameters(
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Appmint',
        style: ThemeMode.light,
      ),
    );
    try {
      await stripe.Stripe.instance.presentPaymentSheet();
    } on stripe.StripeException catch (e) {
      if (e.error.code == stripe.FailureCode.Canceled) return null;
      throw Exception(
        e.error.localizedMessage ?? e.error.message ?? 'Card declined',
      );
    }
    return tender.ref;
  }

  Future<bool> _deliverReceipt() async {
    final order = widget.order;
    switch (_receiptMode) {
      case 'print':
        final messenger = ScaffoldMessenger.of(context);
        try {
          // Server resolves the template (org setting → factory default),
          // interpolates against the order, returns primitive print lines.
          // We just translate to ESC/POS and ship to the BLE printer.
          final payload = await posService.getReceiptPayload(
            order.sk,
            copy: 'customer',
          );
          if (payload == null) {
            throw Exception('Server returned no receipt payload.');
          }
          await printerService.printServerPayload(payload);
          if (!mounted) return true;
          messenger.showSnackBar(
            const SnackBar(content: Text('Receipt sent to printer')),
          );
        } catch (e) {
          if (!mounted) return false;
          messenger.showSnackBar(
            SnackBar(
              content: Text('Print failed: $e'),
              backgroundColor: HaHoColors.error,
            ),
          );
          return false;
        }
        break;
      case 'email':
      case 'sms':
        final messenger = ScaffoldMessenger.of(context);
        final contact = _receiptContact.text.trim();
        if (contact.isEmpty) {
          messenger.showSnackBar(
            SnackBar(
              content: Text(
                _receiptMode == 'email'
                    ? 'Enter an email address first.'
                    : 'Enter a phone number first.',
              ),
              backgroundColor: HaHoColors.warning,
            ),
          );
          return false;
        }
        try {
          final result = await posService.sendReceipt(
            order.sk,
            mode: _receiptMode,
            to: contact,
          );
          if (!mounted) return false;
          final sent = result['sent'];
          if (sent is num && sent > 0) {
            messenger.showSnackBar(
              SnackBar(
                content: Text('Receipt sent via $_receiptMode to $contact'),
                backgroundColor: HaHoColors.success,
              ),
            );
          } else {
            messenger.showSnackBar(
              SnackBar(
                content: Text(
                  'Server accepted the request but didn\'t dispatch — check $_receiptMode template / integration in admin.',
                ),
                backgroundColor: HaHoColors.warning,
              ),
            );
            return false;
          }
        } catch (e) {
          if (!mounted) return false;
          messenger.showSnackBar(
            SnackBar(
              content: Text(
                'Send failed: ${e.toString().replaceFirst('Exception: ', '')}',
              ),
              backgroundColor: HaHoColors.error,
            ),
          );
          return false;
        }
        break;
      case 'none':
        break;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        backgroundColor: HaHoColors.background,
        elevation: 0,
        title: const Text('Checkout'),
        actions: [
          if (_fullyPaid)
            TextButton.icon(
              icon: const Icon(Icons.check),
              label: const Text('Close'),
              style: TextButton.styleFrom(foregroundColor: HaHoColors.success),
              onPressed: _sendingReceipt
                  ? null
                  : () => Navigator.pop(context, true),
            ),
        ],
      ),
      body: !_settingsReady
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(HaHoSpacing.lg),
              children: [
                _OrderSummaryCard(
                  order: order,
                  tip: _tip,
                  grandTotal: widget.order.amountPaid + _grandTotal,
                  due: _due,
                ),
                const SizedBox(height: HaHoSpacing.md),
                if (!_paymentLocked) ...[
                  _TipCard(
                    subtotal: order.total,
                    tipPercent: _tipPercent,
                    tip: _tip,
                    onPickPercent: _setTipPercent,
                    onCustom: _setCustomTip,
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                ],
                ..._tenders.asMap().entries.map(
                  (e) => _TenderRow(
                    tender: e.value,
                    businessLocationId: widget.order.businessLocationId,
                    index: e.key,
                    onMethodChanged: (m) => setState(() => e.value.method = m),
                    onAmountChanged: (a) => setState(() {
                      e.value.amount = a;
                      _absorbRemainder(e.key);
                    }),
                    onTenderedChanged: (a) =>
                        setState(() => e.value.tendered = a),
                    onCharge: () => _chargeTender(e.key),
                    onRemove: _tenders.length > 1
                        ? () => _removeTender(e.key)
                        : null,
                  ),
                ),
                if (!_fullyPaid)
                  Padding(
                    padding: const EdgeInsets.only(top: HaHoSpacing.sm),
                    child: OutlinedButton.icon(
                      onPressed: _addTender,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add tender (split bill)'),
                    ),
                  ),
                if (_fullyPaid) ...[
                  const SizedBox(height: HaHoSpacing.lg),
                  IgnorePointer(
                    ignoring: _sendingReceipt,
                    child: _ReceiptCard(
                      mode: _receiptMode,
                      contactController: _receiptContact,
                      onModeChanged: (m) => setState(() {
                        _receiptMode = m;
                        _receiptStatus = null;
                      }),
                    ),
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  if (_receiptStatus != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: HaHoSpacing.md),
                      child: Text(
                        _receiptStatus!,
                        style: const TextStyle(color: HaHoColors.success),
                      ),
                    ),
                  if (_receiptMode != 'none')
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        icon: Icon(
                          _receiptMode == 'print'
                              ? Icons.print_outlined
                              : Icons.send_outlined,
                        ),
                        label: Text(
                          _sendingReceipt
                              ? 'Sending…'
                              : _receiptMode == 'print'
                              ? 'Print receipt'
                              : 'Send receipt',
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: HaHoColors.success,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            vertical: HaHoSpacing.md,
                          ),
                        ),
                        onPressed: _sendingReceipt
                            ? null
                            : () async {
                                setState(() {
                                  _sendingReceipt = true;
                                  _receiptStatus = null;
                                });
                                try {
                                  final delivered = await _deliverReceipt();
                                  if (!mounted || !delivered) return;
                                  setState(
                                    () =>
                                        _receiptStatus = _receiptMode == 'print'
                                        ? 'Receipt sent to printer.'
                                        : 'Receipt sent.',
                                  );
                                } finally {
                                  if (mounted)
                                    setState(() => _sendingReceipt = false);
                                }
                              },
                      ),
                    ),
                  const SizedBox(height: HaHoSpacing.sm),
                  OutlinedButton(
                    onPressed: _sendingReceipt
                        ? null
                        : () => Navigator.pop(context, true),
                    child: const Text('Close'),
                  ),
                ],
              ],
            ),
    );
  }
}

// ─── Order summary card ──────────────────────────────────────────────────

class _OrderSummaryCard extends StatelessWidget {
  final PosOrder order;
  final num tip;
  final num grandTotal;
  final num due;
  const _OrderSummaryCard({
    required this.order,
    required this.tip,
    required this.grandTotal,
    required this.due,
  });

  @override
  Widget build(BuildContext context) {
    final items = order.productItems.fold<num>(0, (s, i) => s + i.quantity);
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  order.displayLabel,
                  style: HaHoTextStyles.body.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '$items item${items == 1 ? '' : 's'}',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
            ],
          ),
          const SizedBox(height: HaHoSpacing.sm),
          _kv('Subtotal', _money(order.subtotal, order.currency)),
          if (order.tax > 0) _kv('Tax', _money(order.tax, order.currency)),
          if (tip > 0) _kv('Tip', _money(tip, order.currency)),
          const Divider(color: HaHoColors.border),
          _kv('Total', _money(grandTotal, order.currency), bold: true),
          if (grandTotal > due)
            _kv('Paid', _money(grandTotal - due, order.currency)),
          if (due > 0)
            _kv(
              'Due',
              _money(due, order.currency),
              color: HaHoColors.primary,
              bold: true,
            ),
        ],
      ),
    );
  }

  Widget _kv(String l, String r, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(l, style: HaHoTextStyles.body.copyWith(color: color)),
          ),
          Text(
            r,
            style: HaHoTextStyles.body.copyWith(
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  static String _money(num value, String currency) {
    final sym = currency.toUpperCase() == 'USD' ? '\$' : '';
    return '$sym${value.toStringAsFixed(2)}';
  }
}

// ─── Tip picker ───────────────────────────────────────────────────────────

class _TipCard extends StatefulWidget {
  final num subtotal;
  final num tipPercent;
  final num tip;
  final ValueChanged<num> onPickPercent;
  final ValueChanged<num> onCustom;
  const _TipCard({
    required this.subtotal,
    required this.tipPercent,
    required this.tip,
    required this.onPickPercent,
    required this.onCustom,
  });

  @override
  State<_TipCard> createState() => _TipCardState();
}

class _TipCardState extends State<_TipCard> {
  final _customController = TextEditingController();
  bool _customMode = false;

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Tip',
                style: HaHoTextStyles.body.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Text(
                widget.tip > 0
                    ? '\$${widget.tip.toStringAsFixed(2)}'
                    : 'No tip',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
            ],
          ),
          const SizedBox(height: HaHoSpacing.sm),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 540 ? 6 : 3;
              final width =
                  (constraints.maxWidth - (columns - 1) * 8) / columns;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final pct in [0, 15, 18, 20, 25])
                    SizedBox(
                      width: width,
                      child: _tipOption(
                        pct == 0 ? 'No tip' : '$pct%',
                        !_customMode && widget.tipPercent == pct,
                        () {
                          setState(() => _customMode = false);
                          widget.onPickPercent(pct);
                        },
                      ),
                    ),
                  SizedBox(
                    width: width,
                    child: _tipOption(
                      'Custom',
                      _customMode,
                      () => setState(() => _customMode = true),
                    ),
                  ),
                ],
              );
            },
          ),
          if (_customMode) ...[
            const SizedBox(height: HaHoSpacing.sm),
            TextField(
              controller: _customController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              decoration: const InputDecoration(
                labelText: 'Custom tip amount',
                prefixText: '\$ ',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(10)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(10)),
                  borderSide: BorderSide(color: Color(0xFFDFE6E5)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(10)),
                  borderSide: BorderSide(color: Color(0xFF16776B)),
                ),
              ),
              onSubmitted: (v) {
                final amount = num.tryParse(v) ?? 0;
                widget.onCustom(amount);
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _tipOption(String label, bool selected, VoidCallback onTap) {
    return Semantics(
      selected: selected,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          backgroundColor: selected
              ? const Color(0xFF16776B)
              : const Color(0xFFF8FAFA),
          foregroundColor: selected ? Colors.white : const Color(0xFF192C36),
          side: BorderSide(
            color: selected ? const Color(0xFF16776B) : const Color(0xFFDFE6E5),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        child: Text(label),
      ),
    );
  }
}

// ─── Tender row ──────────────────────────────────────────────────────────

class _TenderRow extends StatefulWidget {
  final Tender tender;
  final String businessLocationId;
  final int index;
  final ValueChanged<String> onMethodChanged;
  final ValueChanged<num> onAmountChanged;
  final ValueChanged<num?> onTenderedChanged;
  final VoidCallback onCharge;
  final VoidCallback? onRemove;

  const _TenderRow({
    required this.tender,
    required this.businessLocationId,
    required this.index,
    required this.onMethodChanged,
    required this.onAmountChanged,
    required this.onTenderedChanged,
    required this.onCharge,
    this.onRemove,
  });

  @override
  State<_TenderRow> createState() => _TenderRowState();
}

class _TenderRowState extends State<_TenderRow> {
  late final TextEditingController _amountCtrl;
  late final TextEditingController _tenderedCtrl;

  bool get _terminalConnected =>
      stripeTerminalService.isConnected &&
      stripeTerminalService.connectionKind == 'bluetooth' &&
      stripeTerminalService.isBoundToBusinessLocation(
        widget.businessLocationId,
      );

  void _connectionChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _connectTerminal() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const BusinessLocationSettingsScreen()),
    );
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    stripeTerminalService.connectionRevision.addListener(_connectionChanged);
    _amountCtrl = TextEditingController(
      text: widget.tender.amount.toStringAsFixed(2),
    );
    _tenderedCtrl = TextEditingController(
      text: widget.tender.tendered != null
          ? widget.tender.tendered!.toStringAsFixed(2)
          : '',
    );
  }

  @override
  void didUpdateWidget(_TenderRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    // When the parent recomputes amount (e.g. after tip change or other
    // tender charges), sync the text field — but only if the user isn't
    // mid-edit. Comparing the parsed number vs the current widget value
    // is a cheap way to detect that.
    final cur = num.tryParse(_amountCtrl.text) ?? 0;
    if ((cur - widget.tender.amount).abs() > 0.001) {
      _amountCtrl.text = widget.tender.amount.toStringAsFixed(2);
    }
  }

  @override
  void dispose() {
    stripeTerminalService.connectionRevision.removeListener(_connectionChanged);
    _amountCtrl.dispose();
    _tenderedCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tender;
    final settings = context.watch<PosDeviceSettings>();
    final methods = settings.enabledMethods
        .where(
          (method) =>
              method != 'taptopay' ||
              stripeTerminalService.tapToPaySupported != false,
        )
        .toList();
    final methodLocked = t.charged || t.processing || t.attemptStarted;
    final methodName = settings.displayName(t.method);
    final paymentLabel =
        t.method == 'cash' || t.method == 'bank' || t.method == 'other'
        ? 'Record \$${t.amount.toStringAsFixed(2)} · $methodName'
        : 'Pay \$${t.amount.toStringAsFixed(2)} — $methodName';
    final needsTerminal = t.method == 'm2' && !_terminalConnected && !t.charged;
    return Container(
      margin: const EdgeInsets.only(top: HaHoSpacing.sm),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(
          color: t.charged ? HaHoColors.success : HaHoColors.border,
          width: t.charged ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Tender.iconForMethod(t.method),
                size: 18,
                color: t.charged ? HaHoColors.success : HaHoColors.textGray,
              ),
              const SizedBox(width: HaHoSpacing.sm),
              Text(
                'Tender ${widget.index + 1}',
                style: HaHoTextStyles.bodySmall.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
              const Spacer(),
              if (t.charged)
                const Icon(
                  Icons.check_circle,
                  color: HaHoColors.success,
                  size: 18,
                )
              else if (widget.onRemove != null)
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: widget.onRemove,
                ),
            ],
          ),
          const SizedBox(height: HaHoSpacing.sm),
          if (methods.length > 1)
            DropdownButtonFormField<String>(
              initialValue: methods.contains(t.method) ? t.method : null,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Payment method'),
              items: [
                for (final method in methods)
                  DropdownMenuItem(
                    value: method,
                    child: Text(settings.displayName(method)),
                  ),
              ],
              onChanged: methodLocked
                  ? null
                  : (method) {
                      if (method != null) widget.onMethodChanged(method);
                    },
            )
          else if (t.method.isNotEmpty)
            Row(
              children: [
                Icon(
                  Tender.iconForMethod(t.method),
                  size: 20,
                  color: HaHoColors.textGray,
                ),
                const SizedBox(width: HaHoSpacing.sm),
                Expanded(
                  child: Text(
                    'Payment method: $methodName',
                    style: HaHoTextStyles.bodySmall,
                  ),
                ),
              ],
            ),
          if (t.method == 'm2' && !t.charged)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                _terminalConnected
                    ? 'Card reader connected'
                    : 'Card reader not connected',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
            ),
          if (t.method.isEmpty)
            const Text(
              'No enabled payment method is available on this device.',
              style: TextStyle(color: HaHoColors.error),
            ),
          const SizedBox(height: HaHoSpacing.sm),
          // Amount
          TextField(
            controller: _amountCtrl,
            enabled: !t.charged && !t.processing && !t.attemptStarted,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            decoration: const InputDecoration(
              labelText: 'Amount',
              prefixText: '\$ ',
            ),
            onChanged: (v) {
              final a = num.tryParse(v) ?? 0;
              widget.onAmountChanged(a);
            },
          ),
          if (t.method == 'cash' && !t.charged) ...[
            const SizedBox(height: HaHoSpacing.sm),
            TextField(
              controller: _tenderedCtrl,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              decoration: const InputDecoration(
                labelText: 'Cash tendered (optional)',
                prefixText: '\$ ',
                helperText: 'Auto-computes change',
              ),
              onChanged: (v) {
                final a = num.tryParse(v);
                widget.onTenderedChanged(a);
              },
            ),
            if (t.tendered != null && t.tendered! > t.amount)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Change due: \$${(t.tendered! - t.amount).toStringAsFixed(2)}',
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.success,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
          if (t.error != null) ...[
            const SizedBox(height: HaHoSpacing.sm),
            Container(
              padding: const EdgeInsets.all(HaHoSpacing.sm),
              decoration: BoxDecoration(
                color: HaHoColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(HaHoRadius.md),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 16,
                    color: HaHoColors.error,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      t.error!,
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.error,
                      ),
                    ),
                  ),
                  // Anything about a missing reader → one-tap link into the
                  // pairing wizard. Operator never has to read instructions
                  // and figure out where to navigate.
                  if (t.error!.toLowerCase().contains('reader') ||
                      t.error!.toLowerCase().contains('m2') ||
                      t.error!.toLowerCase().contains('tap to pay'))
                    TextButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              const BusinessLocationSettingsScreen(),
                        ),
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: HaHoColors.error,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                      child: const Text(
                        'Pair now',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: HaHoSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: t.processing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Icon(t.charged ? Icons.check : Icons.flash_on, size: 18),
              label: Text(
                t.charged
                    ? 'Paid · \$${t.amount.toStringAsFixed(2)}'
                    : t.processing
                    ? 'Processing…'
                    : t.attemptStarted
                    ? 'Resume payment'
                    : needsTerminal
                    ? 'Connect card terminal'
                    : paymentLabel,
                textAlign: TextAlign.center,
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: t.charged
                    ? HaHoColors.success
                    : HaHoColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
              ),
              onPressed:
                  (t.charged ||
                      t.processing ||
                      !context.watch<PosDeviceSettings>().allows(t.method))
                  ? null
                  : needsTerminal && !t.attemptStarted
                  ? _connectTerminal
                  : widget.onCharge,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Receipt delivery picker ─────────────────────────────────────────────

class _ReceiptCard extends StatelessWidget {
  final String mode;
  final TextEditingController contactController;
  final ValueChanged<String> onModeChanged;
  const _ReceiptCard({
    required this.mode,
    required this.contactController,
    required this.onModeChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Receipt',
            style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: HaHoSpacing.sm),
          Wrap(
            spacing: 6,
            children: [
              _modeChip(context, 'print', 'Print', Icons.print),
              _modeChip(context, 'email', 'Email', Icons.email_outlined),
              _modeChip(context, 'sms', 'SMS', Icons.sms_outlined),
              _modeChip(context, 'none', 'None', Icons.close),
            ],
          ),
          if (mode == 'email' || mode == 'sms') ...[
            const SizedBox(height: HaHoSpacing.sm),
            TextField(
              controller: contactController,
              keyboardType: mode == 'email'
                  ? TextInputType.emailAddress
                  : TextInputType.phone,
              decoration: InputDecoration(
                labelText: mode == 'email' ? 'Email address' : 'Phone number',
                prefixIcon: Icon(
                  mode == 'email' ? Icons.alternate_email : Icons.phone,
                ),
                // A known guest is picked from the customer list, not typed.
                suffixIcon: IconButton(
                  tooltip: 'Pick a customer',
                  icon: const Icon(Icons.person_search_outlined),
                  onPressed: () => _pickCustomer(context),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _pickCustomer(BuildContext context) async {
    final contacts = context.read<ContactsProvider>();
    if (contacts.appmintContacts.isEmpty) await contacts.fetchAppmintContacts();
    if (!context.mounted) return;
    final email = mode == 'email';
    final list = contacts.appmintContacts
        .where((c) => (email ? c.email : c.phone)?.isNotEmpty == true)
        .toList()
      ..sort((a, b) => a.displayName.compareTo(b.displayName));
    final picked = await showModalBottomSheet<ContactModel>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text('Customers',
                  style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w600)),
            ),
            if (list.isEmpty)
              const ListTile(title: Text('No customers with contact details yet')),
            for (final c in list)
              ListTile(
                leading: CircleAvatar(child: Text(c.initials)),
                title: Text(c.displayName),
                subtitle: Text((email ? c.email : c.displayPhone ?? c.phone) ?? ''),
                onTap: () => Navigator.pop(ctx, c),
              ),
          ],
        ),
      ),
    );
    if (picked != null) {
      contactController.text = (email ? picked.email : picked.phone) ?? '';
    }
  }

  Widget _modeChip(
    BuildContext context,
    String value,
    String label,
    IconData icon,
  ) {
    final selected = mode == value;
    return ChoiceChip(
      avatar: Icon(
        icon,
        size: 16,
        color: selected ? Colors.white : HaHoColors.textGray,
      ),
      label: Text(label),
      selected: selected,
      showCheckmark: false,
      backgroundColor: const Color(0xFFF8FAFA),
      selectedColor: const Color(0xFF16776B),
      side: BorderSide(
        color: selected ? const Color(0xFF16776B) : const Color(0xFFDFE6E5),
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      labelStyle: TextStyle(
        color: selected ? Colors.white : HaHoColors.textDark,
      ),
      onSelected: (_) => onModeChanged(value),
    );
  }
}
