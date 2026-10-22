/// Mirror of the server's checkout record (`stowbo_checkout`). The server owns
/// the truth — the app only displays what these fields say and re-fetches after
/// every mutation. Steps are server-defined: cart → payment → (confirmed).
class CheckoutState {
  final String? checkoutId;
  final String status; // open | held | confirmed | none
  final String step; // cart | payment | ...
  final Quote quote;
  final DateTime? holdExpiresAt;
  final bool holdExpired;
  final bool changed; // price moved since they last saw it (resume)
  final double? previousTotal;
  final String? returnTo;
  final Map<String, dynamic>? context;

  /// What the server will actually charge at confirm — upfront% of the total
  /// plus any deposit. 0 means free, or an open/metered stay paid on the way
  /// out: either way the app skips the card and confirms straight through.
  final double dueNow;

  const CheckoutState({
    required this.checkoutId,
    required this.status,
    required this.step,
    required this.quote,
    this.holdExpiresAt,
    this.holdExpired = false,
    this.changed = false,
    this.previousTotal,
    this.returnTo,
    this.context,
    this.dueNow = 0,
  });

  bool get isHeld => status == 'held';
  bool get hasLiveHold =>
      isHeld &&
      holdExpiresAt != null &&
      holdExpiresAt!.isAfter(DateTime.now());

  static DateTime? _dt(dynamic v) =>
      (v is String && v.isNotEmpty) ? DateTime.tryParse(v)?.toLocal() : null;

  /// GET /checkout/resume → { resumable, checkoutId, status, step, ... , quote }
  static CheckoutState? fromResume(Map<String, dynamic> m) {
    if (m['resumable'] != true) return null;
    return CheckoutState(
      checkoutId: m['checkoutId']?.toString(),
      status: (m['status'] ?? 'open').toString(),
      step: (m['step'] ?? 'cart').toString(),
      quote: Quote.fromMap(_asMap(m['quote'])),
      holdExpiresAt: _dt(m['holdExpiresAt']),
      holdExpired: m['holdExpired'] == true,
      changed: m['changed'] == true,
      previousTotal: (m['previousTotal'] as num?)?.toDouble(),
      returnTo: m['returnTo']?.toString(),
      context: m['context'] is Map
          ? Map<String, dynamic>.from(m['context'])
          : null,
    );
  }

  /// POST /checkout/cart → { checkoutId, quote, checkout }
  factory CheckoutState.fromSave(Map<String, dynamic> m) {
    final checkout = _asMap(m['checkout']);
    final data = _asMap(checkout['data']);
    return CheckoutState(
      checkoutId: m['checkoutId']?.toString(),
      status: (data['status'] ?? 'open').toString(),
      step: (data['step'] ?? 'cart').toString(),
      quote: Quote.fromMap(_asMap(m['quote'])),
      holdExpiresAt: _dt(data['holdExpiresAt']),
      returnTo: data['returnTo']?.toString(),
      context: data['context'] is Map
          ? Map<String, dynamic>.from(data['context'])
          : null,
    );
  }

  /// POST /checkout/hold → { checkoutId, expiresAt, quote, dueNow }
  factory CheckoutState.fromHold(Map<String, dynamic> m) => CheckoutState(
        checkoutId: m['checkoutId']?.toString(),
        status: 'held',
        step: 'payment',
        quote: Quote.fromMap(_asMap(m['quote'])),
        holdExpiresAt: _dt(m['expiresAt']),
        dueNow: (m['dueNow'] as num?)?.toDouble() ?? 0,
      );

  CheckoutState copyWith({String? step, String? status}) => CheckoutState(
        checkoutId: checkoutId,
        status: status ?? this.status,
        step: step ?? this.step,
        quote: quote,
        holdExpiresAt: holdExpiresAt,
        holdExpired: holdExpired,
        changed: changed,
        previousTotal: previousTotal,
        returnTo: returnTo,
        context: context,
        dueNow: dueNow,
      );

  static Map<String, dynamic> _asMap(dynamic v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
}

/// The server's price breakdown for a cart. All money is server-computed — the
/// app renders these labelled amounts and NEVER multiplies a rate by a
/// duration (with bands/caps/grace that arithmetic no longer matches).
class Quote {
  final String currency;
  final List<QuoteLine> lines;
  final double subtotal;
  final double addOnTotal;
  final double discount;
  final List<DiscountLine> discounts;
  final DiscountRejected? discountRejected;
  final double serviceFee;
  final double protectionFee;
  final List<FeeLine> fees;
  final double tax;
  final List<TaxLine> taxLines;
  final double total;
  final bool bookable;
  final List<String> unavailable;

  const Quote({
    required this.currency,
    required this.lines,
    required this.subtotal,
    required this.addOnTotal,
    required this.discount,
    required this.discounts,
    required this.discountRejected,
    required this.serviceFee,
    required this.protectionFee,
    this.fees = const [],
    required this.tax,
    required this.taxLines,
    required this.total,
    required this.bookable,
    required this.unavailable,
  });

  static double _d(dynamic v) => (v is num) ? v.toDouble() : 0;
  static List<T> _list<T>(dynamic v, T Function(Map<String, dynamic>) f) =>
      (v is List)
          ? v
              .whereType<Map>()
              .map((e) => f(Map<String, dynamic>.from(e)))
              .toList()
          : const [];

  factory Quote.fromMap(Map<String, dynamic> m) => Quote(
        currency: (m['currency'] ?? 'USD').toString(),
        lines: _list(m['lines'], QuoteLine.fromMap),
        subtotal: _d(m['subtotal']),
        addOnTotal: _d(m['addOnTotal']),
        discount: _d(m['discount']),
        discounts: _list(m['discounts'], DiscountLine.fromMap),
        discountRejected: m['discountRejected'] is Map
            ? DiscountRejected.fromMap(
                Map<String, dynamic>.from(m['discountRejected']))
            : null,
        serviceFee: _d(m['serviceFee']),
        protectionFee: _d(m['protectionFee']),
        fees: _list(m['fees'], FeeLine.fromMap),
        tax: _d(m['tax']),
        taxLines: _list(m['taxLines'], TaxLine.fromMap),
        total: _d(m['total']),
        bookable: m['bookable'] == true,
        unavailable: (m['unavailable'] is List)
            ? (m['unavailable'] as List).map((e) => e.toString()).toList()
            : const [],
      );

  bool get isEmpty => lines.isEmpty;
}

/// Labelled fees priced by the server, displayed without recalculation.
class FeeLine {
  final String label;
  final double amount;
  const FeeLine({required this.label, required this.amount});
  factory FeeLine.fromMap(Map<String, dynamic> m) => FeeLine(
        label: (m['label'] ?? m['name'] ?? 'Fee').toString(),
        amount: (m['amount'] as num?)?.toDouble() ?? 0,
      );
}

/// One applied discount — a labelled amount, nothing to re-derive.
class DiscountLine {
  final String? code;
  final String name;
  final double amount;
  final String? message;
  const DiscountLine(
      {this.code, required this.name, required this.amount, this.message});
  factory DiscountLine.fromMap(Map<String, dynamic> m) => DiscountLine(
        code: m['code']?.toString(),
        name: (m['name'] ?? m['code'] ?? 'Discount').toString(),
        amount: (m['amount'] is num) ? (m['amount'] as num).toDouble() : 0,
        message: m['message']?.toString(),
      );
}

/// A discount code the server declined — reported, not thrown.
class DiscountRejected {
  final String? code;
  final String message;
  const DiscountRejected({this.code, required this.message});
  factory DiscountRejected.fromMap(Map<String, dynamic> m) => DiscountRejected(
        code: m['code']?.toString(),
        message: (m['message'] ?? 'Code not applied').toString(),
      );
}

/// One tax line — server-computed per jurisdiction.
class TaxLine {
  final String? jurisdiction;
  final double amount;
  const TaxLine({this.jurisdiction, required this.amount});
  factory TaxLine.fromMap(Map<String, dynamic> m) => TaxLine(
        jurisdiction: m['jurisdiction']?.toString(),
        amount: (m['amount'] is num) ? (m['amount'] as num).toDouble() : 0,
      );
}

/// One labelled band of the rate breakdown, e.g. "First 2 hours" → $6. The app
/// prints label + amount; it must not recompute this from a rate and duration.
class RateLine {
  final String label;
  final double amount;
  const RateLine({required this.label, required this.amount});
  factory RateLine.fromMap(Map<String, dynamic> m) => RateLine(
        label: (m['label'] ?? '').toString(),
        amount: (m['amount'] is num) ? (m['amount'] as num).toDouble() : 0,
      );
}

class QuoteLine {
  final String listing;
  final String title;
  final String? spaceType;
  final DateTime? startDate;
  final DateTime? endDate;
  final int quantity;
  final List<RateLine> rateLines; // labelled band breakdown (server-computed)
  final double addOnTotal;
  final double subtotal;
  final double discount;
  final double tax;
  final double total;
  final bool sufficient;
  final int available;
  final List<Map<String, dynamic>> addOns;

  const QuoteLine({
    required this.listing,
    required this.title,
    this.spaceType,
    this.startDate,
    this.endDate,
    required this.quantity,
    required this.rateLines,
    required this.addOnTotal,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.total,
    required this.sufficient,
    required this.available,
    required this.addOns,
  });

  static double _d(dynamic v) => (v is num) ? v.toDouble() : 0;
  static DateTime? _dt(dynamic v) =>
      (v is String && v.isNotEmpty) ? DateTime.tryParse(v)?.toLocal() : null;

  factory QuoteLine.fromMap(Map<String, dynamic> m) => QuoteLine(
        listing: (m['listing'] ?? '').toString(),
        title: (m['listingTitle'] ?? m['listing'] ?? '').toString(),
        spaceType: m['spaceType']?.toString(),
        startDate: _dt(m['startDate']),
        endDate: _dt(m['endDate']),
        quantity: (m['quantity'] as num?)?.toInt() ?? 1,
        rateLines: (m['rateLines'] is List)
            ? (m['rateLines'] as List)
                .whereType<Map>()
                .map((e) => RateLine.fromMap(Map<String, dynamic>.from(e)))
                .toList()
            : const [],
        addOnTotal: _d(m['addOnTotal']),
        subtotal: _d(m['subtotal']),
        discount: _d(m['discount']),
        tax: _d(m['tax']),
        total: _d(m['total'] ?? m['subtotal']),
        sufficient: m['sufficient'] != false,
        available: (m['available'] as num?)?.toInt() ?? 0,
        addOns: (m['addOns'] is List)
            ? (m['addOns'] as List)
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList()
            : const [],
      );
}
