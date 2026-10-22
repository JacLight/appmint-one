/// The full booking record — the operational truth behind the 360 dashboard.
/// Parsed from `/client/stowbo/host/bookings/:id`.
double _d(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
int _i(dynamic v) =>
    v == null ? 0 : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
DateTime? _dt(dynamic v) =>
    v == null ? null : DateTime.tryParse(v.toString())?.toLocal();
List<Map<String, dynamic>> _list(dynamic v) => (v is List)
    ? v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
    : const [];

/// One movement of a holding — in or out, append-only.
class Movement {
  final DateTime? at;
  final String direction; // in | out
  final String by;
  final String? note;
  final String? condition;
  final List<Map<String, dynamic>> photos;
  Movement.fromMap(Map<String, dynamic> m)
      : at = _dt(m['at']),
        direction = (m['direction'] ?? '').toString(),
        by = (m['by'] ?? '').toString(),
        note = m['note']?.toString(),
        condition = m['condition']?.toString(),
        photos = _list(m['photos']);
}

/// One physical thing a line covers (a car, a bag). Presence is the direction
/// of the last movement — being "out" means at lunch, not finished.
class Holding {
  final String ref;
  final String? unit;
  final String? identifier;
  final String? label;
  final String? collector;
  final List<Movement> movements;
  Holding.fromMap(Map<String, dynamic> m)
      : ref = (m['ref'] ?? '').toString(),
        unit = m['unit']?.toString(),
        identifier = m['identifier']?.toString(),
        label = m['label']?.toString(),
        collector = m['collector']?.toString(),
        movements = _list(m['movements'])
            .map((e) => Movement.fromMap(e))
            .toList();

  /// Present = the last movement was an "in" (or there are none yet, i.e. it
  /// hasn't left). The server is authoritative; this mirrors its rule.
  bool get present =>
      movements.isEmpty ? false : movements.last.direction == 'in';
  String get display =>
      (identifier?.isNotEmpty == true)
          ? identifier!
          : (unit?.isNotEmpty == true)
              ? unit!
              : (label?.isNotEmpty == true)
                  ? label!
                  : ref;
}

class BookingLine {
  final int index;
  final String listing;
  final String listingTitle;
  final String? unit;
  final int quantity;
  final String state; // booked | stored | retrieved | damaged | lost | abandoned
  final String? condition;
  final List<Map<String, dynamic>> dropoffPhotos;
  final List<Map<String, dynamic>> pickupPhotos;
  final List<Map<String, dynamic>> addOns;
  final List<Holding> holdings;
  final double price;

  // Bill lines that are NOT a space: an add-on, an extra charge, a discount /
  // refund / waiver, or a reversal of one. They live in the same `items` array
  // as the space lines (that is the line model), addressed by index — which is
  // what a reverse needs.
  final String? kind; // addon | charge | discount | refund | waiver | adjustment
  final String code;
  final String label;
  final double amount;
  final String reversedBy; // set when this line has been reversed
  final String reversalOf; // set when this line IS a reversal of another

  bool get isAdjustment => (kind ?? '').isNotEmpty && listing.isEmpty;
  bool get reversed => reversedBy.isNotEmpty;
  bool get isReversal => reversalOf.isNotEmpty;

  BookingLine.fromMap(this.index, Map<String, dynamic> m)
      : listing = (m['listing'] ?? '').toString(),
        listingTitle = (m['listingTitle'] ?? m['listing'] ?? 'Item').toString(),
        unit = m['unit']?.toString(),
        quantity = _i(m['quantity'] ?? 1),
        state = (m['state'] ?? 'booked').toString(),
        condition = m['condition']?.toString(),
        dropoffPhotos = _list(m['dropoffPhotos']),
        pickupPhotos = _list(m['pickupPhotos']),
        addOns = _list(m['addOns']),
        holdings =
            _list(m['holdings']).map((e) => Holding.fromMap(e)).toList(),
        price = _d(m['price']),
        kind = m['kind']?.toString(),
        code = (m['code'] ?? '').toString(),
        label = (m['label'] ?? '').toString(),
        amount = _d(m['amount']),
        reversedBy = (m['reversedBy'] ?? '').toString(),
        reversalOf = (m['reversalOf'] ?? '').toString();
}

class TimelineEvent {
  final DateTime? at;
  final String type;
  final String actor;
  final String actorRole; // guest | host | operator | system
  final double amount;
  final String detail;
  TimelineEvent.fromMap(Map<String, dynamic> m)
      : at = _dt(m['at']),
        type = (m['type'] ?? 'note').toString(),
        actor = (m['actor'] ?? '').toString(),
        actorRole = (m['actorRole'] ?? '').toString(),
        amount = _d(m['amount']),
        detail = (m['detail'] ?? '').toString();
}

class Adjustment {
  final String id;
  final String kind; // charge | discount | refund | waiver
  final String category;
  final double amount;
  final String bearer; // guest | host | platform
  final String description;
  final bool reversed;
  Adjustment.fromMap(Map<String, dynamic> m)
      : id = (m['id'] ?? '').toString(),
        kind = (m['kind'] ?? 'charge').toString(),
        category = (m['category'] ?? 'other').toString(),
        amount = _d(m['amount']),
        bearer = (m['bearer'] ?? 'guest').toString(),
        description = (m['description'] ?? '').toString(),
        reversed = (m['reversedBy'] ?? '').toString().isNotEmpty;
}

class Claim {
  final String id;
  final String type; // damage | loss | dispute | complaint | overcharge
  final String status; // open | investigating | ... | resolved
  final String description;
  final double claimedAmount;
  final String openedByRole;
  Claim.fromMap(Map<String, dynamic> m)
      : id = (m['id'] ?? '').toString(),
        type = (m['type'] ?? 'dispute').toString(),
        status = (m['status'] ?? 'open').toString(),
        description = (m['description'] ?? '').toString(),
        claimedAmount = _d(m['claimedAmount']),
        openedByRole = (m['openedByRole'] ?? '').toString();
}

class Booking {
  final String sk;
  final String reference;
  final String customer;
  final String status;
  final String currency;
  final String dropoffCode;
  final String pickupCode;
  final List<BookingLine> lines;
  final List<TimelineEvent> timeline;
  final List<Adjustment> adjustments;
  final List<Claim> claims;
  // money
  final double subtotal;
  final double addOnTotal;
  final double deposit;
  final double overstayCharge;
  final double discount;
  final double serviceFee;
  final double protectionFee;
  final double tax;
  final double adjustmentTotal;
  final double total;
  final double balanceDue;
  final double platformFee;
  final double hostEarning;
  final bool paymentHeld; // host has held the payout (data.paymentHold set)
  final DateTime? checkedInAt; // session opened (a move-in is NOT this)
  final DateTime? checkedOutAt; // session closed early
  final DateTime? createdAt;

  /// The session is open once checked in and not yet checked out.
  bool get sessionOpen => checkedInAt != null && checkedOutAt == null;

  Booking({
    required this.sk,
    required this.reference,
    required this.customer,
    required this.status,
    required this.currency,
    required this.dropoffCode,
    required this.pickupCode,
    required this.lines,
    required this.timeline,
    required this.adjustments,
    required this.claims,
    required this.subtotal,
    required this.addOnTotal,
    required this.deposit,
    required this.overstayCharge,
    this.discount = 0,
    this.serviceFee = 0,
    this.protectionFee = 0,
    this.tax = 0,
    required this.adjustmentTotal,
    required this.total,
    required this.balanceDue,
    this.platformFee = 0,
    required this.hostEarning,
    this.paymentHeld = false,
    this.checkedInAt,
    this.checkedOutAt,
    this.createdAt,
  });

  factory Booking.fromRecord(Map<String, dynamic> rec) {
    final data = (rec['data'] is Map)
        ? Map<String, dynamic>.from(rec['data'])
        : <String, dynamic>{};
    final items = _list(data['items']);
    return Booking(
      sk: (rec['sk'] ?? '').toString(),
      reference: (data['name'] ?? rec['name'] ?? '').toString(),
      customer: (data['customer'] ?? '').toString(),
      status: (data['status'] ?? 'requested').toString(),
      currency: (data['currency'] ?? 'USD').toString(),
      dropoffCode: (data['dropoffCode'] ?? '').toString(),
      pickupCode: (data['pickupCode'] ?? '').toString(),
      lines: [
        for (var i = 0; i < items.length; i++) BookingLine.fromMap(i, items[i])
      ],
      timeline: _list(data['timeline']).map(TimelineEvent.fromMap).toList()
        ..sort((a, b) =>
            (b.at ?? DateTime(2000)).compareTo(a.at ?? DateTime(2000))),
      adjustments: _list(data['adjustments']).map(Adjustment.fromMap).toList(),
      claims: _list(data['claims']).map(Claim.fromMap).toList(),
      subtotal: _d(data['subtotal']),
      addOnTotal: _d(data['addOnTotal']),
      deposit: _d(data['deposit']),
      overstayCharge: _d(data['overstayCharge']),
      discount: _d(data['discount']),
      serviceFee: _d(data['serviceFee']),
      protectionFee: _d(data['protectionFee']),
      tax: _d(data['tax']),
      adjustmentTotal: _d(data['adjustmentTotal']),
      total: _d(data['total']),
      balanceDue: _d(data['balanceDue']),
      platformFee: _d(data['platformFee']),
      hostEarning: _d(data['hostEarning']),
      paymentHeld: data['paymentHold'] is Map,
      checkedInAt: _dt(data['checkedInAt']),
      checkedOutAt: _dt(data['checkedOutAt']),
      createdAt: _dt(rec['createdate']),
    );
  }

  bool get isSettled => status == 'settled';
  bool get isCancelled => status == 'cancelled' || status == 'no_show';
  bool get inCustody => status == 'in_custody' || status == 'overdue';
}
