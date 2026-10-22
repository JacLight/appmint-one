/// The guest's full view of one booking, hydrated from four calls:
///  • GET /bookings/:id          → money, codes, status, bill breakdown, window
///  • GET /bookings/:id/host     → host contact card (name/email/phone/avatar)
///  • GET /my-items?booking=:id  → per-ITEM custody state (the lifecycle driver)
///  • GET /listings/:id          → venue address / map / hours / staffing
///
/// Everything the old CustodyDetailScreen lacked lives here. The screen adapts
/// to the record: a one-drop bag check and a week-long valet are the same model.
class BookingDetail {
  final String bookingId;
  final String reference; // data.name (10-char slug)
  final String status; // confirmed | active | completed | settled | cancelled
  final String currency;
  final double total;
  final PaymentSummary payment;
  final List<BillRow> bill; // data.items[] (signed amounts)
  final String dropoffCode;
  final String pickupCode;
  final Deposit? deposit;
  final CancellationPolicy? cancellationPolicy;

  // Derived from the first `space` bill row (dates are NOT on data root).
  final DateTime? windowStart;
  final DateTime? windowEnd; // null = open-ended (long-term storage)
  final String? listingId;
  final String? listingTitle;
  final String? hostId;
  final int billedQuantity;

  // Hydrated from the other three calls.
  final BookingHost? host;
  final Venue? venue;
  final List<CustodyItem> items; // my-items filtered to this booking
  final List<TimelineEntry> timeline;

  BookingDetail({
    required this.bookingId,
    required this.reference,
    required this.status,
    required this.currency,
    required this.total,
    required this.payment,
    required this.bill,
    required this.dropoffCode,
    required this.pickupCode,
    required this.deposit,
    required this.cancellationPolicy,
    required this.windowStart,
    required this.windowEnd,
    required this.listingId,
    required this.listingTitle,
    required this.hostId,
    required this.billedQuantity,
    required this.host,
    required this.venue,
    required this.items,
    required this.timeline,
  });

  /// Build from the raw `GET /bookings/:id` BaseModel record. `host`, `venue`,
  /// `items`, `timeline` are attached afterwards by the loader (copyWith).
  factory BookingDetail.fromRecord(Map<String, dynamic> rec) {
    final data = _m(rec['data']);
    final bill = (data['items'] as List? ?? [])
        .whereType<Map>()
        .map((e) => BillRow.fromRow(Map<String, dynamic>.from(e)))
        .toList();
    // The `space` rows carry the window + listing/host denormalised.
    final space = bill.firstWhere((r) => r.kind == 'space',
        orElse: () => BillRow.empty());
    return BookingDetail(
      bookingId: _s(rec['sk']),
      reference: _s(data['name']),
      status: _s(data['status'], 'confirmed'),
      currency: _s(data['currency'], 'USD').toUpperCase(),
      total: _d(data['total']),
      payment: PaymentSummary.from(_m(rec['paymentSummary'])),
      bill: bill,
      dropoffCode: _s(data['dropoffCode']),
      pickupCode: _s(data['pickupCode']),
      deposit: data['deposit'] is Map
          ? Deposit.from(Map<String, dynamic>.from(data['deposit']))
          : null,
      cancellationPolicy: data['cancellationPolicy'] is Map
          ? CancellationPolicy.from(
              Map<String, dynamic>.from(data['cancellationPolicy']))
          : null,
      windowStart: space.startDate,
      windowEnd: space.endDate,
      listingId: space.listing,
      listingTitle: space.label.isNotEmpty ? space.label : null,
      hostId: space.hostId,
      billedQuantity: space.quantity,
      host: null,
      venue: null,
      items: const [],
      timeline: const [],
    );
  }

  BookingDetail copyWith({
    BookingHost? host,
    Venue? venue,
    List<CustodyItem>? items,
    List<TimelineEntry>? timeline,
  }) =>
      BookingDetail(
        bookingId: bookingId,
        reference: reference,
        status: status,
        currency: currency,
        total: total,
        payment: payment,
        bill: bill,
        dropoffCode: dropoffCode,
        pickupCode: pickupCode,
        deposit: deposit,
        cancellationPolicy: cancellationPolicy,
        windowStart: windowStart,
        windowEnd: windowEnd,
        listingId: listingId,
        listingTitle: listingTitle,
        hostId: hostId,
        billedQuantity: billedQuantity,
        host: host ?? this.host,
        venue: venue ?? this.venue,
        items: items ?? this.items,
        timeline: timeline ?? this.timeline,
      );

  // ── derived state that drives the adaptive UI ──────────────────────────────

  String get title =>
      venue?.title ?? listingTitle ?? host?.name ?? 'Your booking';

  int get itemCount => items.isNotEmpty ? items.length : (billedQuantity);

  /// Manned (valet/bag check → host acts) vs unmanned (parking/self-storage →
  /// guest self-serves). Default manned when the listing didn't say.
  bool get isManned => (venue?.staffing ?? 'manned') != 'unmanned';

  bool get isOpenEnded => windowEnd == null;

  bool get isCancelled => status == 'cancelled';
  bool get isClosed =>
      status == 'completed' ||
      status == 'settled' ||
      (items.isNotEmpty && items.every((i) => i.checkedOutAt != null));

  int get checkedInCount => items.where((i) => i.checkedInAt != null).length;
  int get openItemCount =>
      items.where((i) => i.checkedInAt != null && i.checkedOutAt == null).length;

  /// Items physically here right now (checked in, not out, last move inbound).
  int get presentCount => items
      .where((i) =>
          i.checkedInAt != null && i.checkedOutAt == null && i.present)
      .length;

  /// Items currently retrieved / out for use (the valet-car-is-out case).
  int get outCount => items
      .where((i) =>
          i.checkedInAt != null && i.checkedOutAt == null && !i.present)
      .length;

  bool get hasMovements =>
      items.any((i) => i.lastMovementAt != null) ||
      timeline.any((t) => t.type == 'access');

  StayPhase get phase {
    if (isCancelled) return StayPhase.cancelled;
    if (isClosed) return StayPhase.closed;
    if (checkedInCount == 0) return StayPhase.reserved;
    if (outCount > 0) return StayPhase.retrieved; // something is out
    return StayPhase.inCustody;
  }

  /// Only cancellable before anything is checked in (server enforces this too).
  bool get canCancel =>
      !isCancelled && !isClosed && checkedInCount == 0 && status == 'confirmed';

  bool get canExtend => !isCancelled && !isClosed && !isOpenEnded;

  // ── retrieval request loop ─────────────────────────────────────────────────

  /// The item carrying an open request (if any), and that request.
  CustodyItem? get requestingItem {
    for (final i in items) {
      if (i.hasOpenRequest) return i;
    }
    return null;
  }

  MovementRequest? get activeRequest => requestingItem?.request;

  /// An item that's here and could be retrieved (checked in, present, no open
  /// request) — the target for a "retrieve" request.
  CustodyItem? get retrievableItem {
    for (final i in items) {
      if (i.checkedInAt != null &&
          i.checkedOutAt == null &&
          i.present &&
          !i.hasOpenRequest) return i;
    }
    return null;
  }

  /// An item that's currently out and could be returned.
  CustodyItem? get returnableItem {
    for (final i in items) {
      if (i.checkedInAt != null &&
          i.checkedOutAt == null &&
          !i.present &&
          !i.hasOpenRequest) return i;
    }
    return null;
  }

  /// Any in-custody item with no open request — the target for a new request.
  /// You can ask for it whether it's here (→ retrieve) or out (→ return); the
  /// direction is derived, so requesting works in advance either way.
  CustodyItem? get requestableItem {
    for (final i in items) {
      if (i.checkedInAt != null && i.checkedOutAt == null && !i.hasOpenRequest) {
        return i;
      }
    }
    return null;
  }

  /// 'retrieve' when the thing is here, 'return' when it's currently out.
  String get requestKind =>
      (requestableItem?.present ?? true) ? 'retrieve' : 'return';

  /// Can the guest raise a request right now? (manned, in custody, none open).
  bool get canRequest =>
      isManned && activeRequest == null && requestableItem != null;

  /// Past (resolved) requests, newest first, from the timeline — the request
  /// log. Each guest 'request' event that isn't the currently-open one.
  List<TimelineEntry> get requestHistory =>
      timeline.where((t) => t.type == 'request').toList();
}

enum StayPhase { reserved, inCustody, retrieved, closed, cancelled }

// ── sub-models ───────────────────────────────────────────────────────────────

class PaymentSummary {
  final String currency;
  final double total;
  final double charged;
  final double refunded;
  final double paid; // net toward everything
  final double towardBill;
  final double balance;
  final String status; // paid | partial | unpaid
  PaymentSummary({
    required this.currency,
    required this.total,
    required this.charged,
    required this.refunded,
    required this.paid,
    required this.towardBill,
    required this.balance,
    required this.status,
  });
  factory PaymentSummary.from(Map<String, dynamic> m) => PaymentSummary(
        currency: _s(m['currency'], 'USD').toUpperCase(),
        total: _d(m['total']),
        charged: _d(m['charged']),
        refunded: _d(m['refunded']),
        paid: _d(m['paid']),
        towardBill: _d(m['towardBill']),
        balance: _d(m['balance']),
        status: _s(m['status'], 'unpaid'),
      );
  bool get isPaid => status == 'paid';
  bool get hasBalance => balance > 0.004;
}

class BillRow {
  final String kind; // space | addon | fee | discount | tax
  final String label;
  final double amount; // signed (discounts negative)
  final String? listing;
  final String? hostId;
  final int quantity;
  final DateTime? startDate;
  final DateTime? endDate;
  BillRow({
    required this.kind,
    required this.label,
    required this.amount,
    this.listing,
    this.hostId,
    this.quantity = 1,
    this.startDate,
    this.endDate,
  });
  factory BillRow.fromRow(Map<String, dynamic> r) => BillRow(
        kind: _s(r['kind']),
        label: _s(r['label'], _s(r['code'])),
        amount: _d(r['amount']),
        listing: r['listing'] == null ? null : _s(r['listing']),
        hostId: r['hostId'] == null ? null : _s(r['hostId']),
        quantity: (r['quantity'] is num) ? (r['quantity'] as num).toInt() : 1,
        startDate: _dt(r['startDate']),
        endDate: _dt(r['endDate']),
      );
  factory BillRow.empty() => BillRow(kind: '', label: '', amount: 0);
}

class Deposit {
  final double amount;
  final bool refundable;
  final String status; // none | held | applied | returned
  Deposit({required this.amount, required this.refundable, required this.status});
  factory Deposit.from(Map<String, dynamic> m) => Deposit(
        amount: _d(m['amount']),
        refundable: m['refundable'] == true,
        status: _s(m['status'], 'none'),
      );
}

class CancellationPolicy {
  final String policy; // flexible | moderate | strict
  final DateTime? freeUntil;
  final double refundablePortion; // 0..1
  CancellationPolicy(
      {required this.policy,
      required this.freeUntil,
      required this.refundablePortion});
  factory CancellationPolicy.from(Map<String, dynamic> m) => CancellationPolicy(
        policy: _s(m['policy'], 'moderate'),
        freeUntil: _dt(m['freeUntil']),
        refundablePortion: _d(m['refundablePortion']),
      );
  bool get freeNow => freeUntil == null || DateTime.now().isBefore(freeUntil!);
}

class BookingHost {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? avatar;
  final bool verified;
  BookingHost({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.avatar,
    required this.verified,
  });
  factory BookingHost.from(Map<String, dynamic> m) => BookingHost(
        id: _s(m['id']),
        name: _s(m['name'], 'Host'),
        email: _s(m['email']),
        phone: (m['phone'] == null || _s(m['phone']).isEmpty)
            ? null
            : _s(m['phone']),
        avatar: (m['avatar'] == null || _s(m['avatar']).isEmpty)
            ? null
            : _s(m['avatar']),
        verified: m['verified'] == true,
      );
  bool get isEmpty => id.isEmpty && email.isEmpty;
}

class Venue {
  final String title;
  final String address;
  final double? lat;
  final double? lng;
  final String accessHours;
  final String staffing; // manned | unmanned
  final String spaceType;
  final String? photoUrl;
  Venue({
    required this.title,
    required this.address,
    required this.lat,
    required this.lng,
    required this.accessHours,
    required this.staffing,
    required this.spaceType,
    required this.photoUrl,
  });

  /// From `GET /listings/:id` → { listing: <full record> }.
  factory Venue.fromListingRecord(Map<String, dynamic> listingRec) {
    final d = _m(listingRec['data']);
    final loc = _m(d['location']);
    final images = (d['images'] as List?)?.whereType<String>().toList() ?? [];
    return Venue(
      title: _s(d['title'], _s(d['name'], 'Venue')),
      address: _joinAddress(d['address']),
      lat: _numOrNull(loc['lat']),
      lng: _numOrNull(loc['lng']),
      accessHours: _s(d['accessHours']),
      staffing: _s(d['staffing'], 'manned'),
      spaceType: _s(d['spaceType']),
      photoUrl: images.isNotEmpty ? images.first : null,
    );
  }
  bool get hasCoords => lat != null && lng != null;
  bool get isManned => staffing != 'unmanned';
}

/// A tracked retrieval/return request on an item — the loop the guest watches:
/// requested → acknowledged → preparing → ready → fulfilled (or cancelled).
class MovementRequest {
  final bool active;
  final String direction; // out (retrieve) | in (return)
  final String status; // requested | acknowledged | preparing | ready | fulfilled | cancelled
  final String? note; // guest note
  final String? hostNote; // host note (e.g. "at bay 3")
  final DateTime? requestedAt;
  final DateTime? updatedAt;
  MovementRequest({
    required this.active,
    required this.direction,
    required this.status,
    required this.note,
    required this.hostNote,
    required this.requestedAt,
    required this.updatedAt,
  });
  factory MovementRequest.from(Map<String, dynamic> m) => MovementRequest(
        active: m['active'] == true,
        direction: _s(m['direction'], 'out'),
        status: _s(m['status'], 'requested'),
        note: (m['note'] == null || _s(m['note']).isEmpty) ? null : _s(m['note']),
        hostNote: (m['hostNote'] == null || _s(m['hostNote']).isEmpty)
            ? null
            : _s(m['hostNote']),
        requestedAt: _dt(m['requestedAt']),
        updatedAt: _dt(m['updatedAt']),
      );

  bool get isRetrieve => direction == 'out';

  /// 0..3 progress index over the visible steps (Requested→Preparing→Ready→Out).
  int get step {
    switch (status) {
      case 'requested':
        return 0;
      case 'acknowledged':
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'fulfilled':
        return 3;
      default:
        return 0;
    }
  }

  String get headline {
    switch (status) {
      case 'requested':
        return isRetrieve ? 'Request sent' : 'Return requested';
      case 'acknowledged':
        return 'Host got your request';
      case 'preparing':
        return isRetrieve ? 'Getting it ready' : 'Ready to receive it';
      case 'ready':
        return isRetrieve ? 'Ready — come and get it' : 'Ready for you to hand back';
      case 'fulfilled':
        return isRetrieve ? 'Handed to you' : 'Back in storage';
      case 'cancelled':
        return 'Request cancelled';
      default:
        return 'Request';
    }
  }
}

/// A single tracked thing (`stowbo_booking_item`) — the lifecycle unit.
class CustodyItem {
  final String id;
  final String? booking;
  final String? listing;
  final String? unit;
  final String? identifier; // plate / tag
  final String label;
  final DateTime? startDate;
  final DateTime? endDate;
  final String status; // reserved | active | ended | disputed | cancelled
  final DateTime? checkedInAt;
  final DateTime? checkedOutAt;
  final bool present; // last movement was inbound
  final DateTime? lastMovementAt;
  final MovementRequest? request;
  CustodyItem({
    required this.id,
    required this.booking,
    required this.listing,
    required this.unit,
    required this.identifier,
    required this.label,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.checkedInAt,
    required this.checkedOutAt,
    required this.present,
    required this.lastMovementAt,
    required this.request,
  });
  factory CustodyItem.from(Map<String, dynamic> m) => CustodyItem(
        id: _s(m['id']),
        booking: m['booking'] == null ? null : _s(m['booking']),
        listing: m['listing'] == null ? null : _s(m['listing']),
        unit: (m['unit'] == null || _s(m['unit']).isEmpty)
            ? null
            : _s(m['unit']),
        identifier: (m['identifier'] == null || _s(m['identifier']).isEmpty)
            ? null
            : _s(m['identifier']),
        label: _s(m['label']),
        startDate: _dt(m['startDate']),
        endDate: _dt(m['endDate']),
        status: _s(m['status'], 'reserved'),
        checkedInAt: _dt(m['checkedInAt']),
        checkedOutAt: _dt(m['checkedOutAt']),
        present: m['present'] == true,
        lastMovementAt: _dt(m['lastMovementAt']),
        request: m['request'] is Map
            ? MovementRequest.from(Map<String, dynamic>.from(m['request']))
            : null,
      );

  /// The item's own phase, for per-row rendering.
  String get displayName => label.isNotEmpty
      ? label
      : (identifier ?? (unit != null ? 'Unit $unit' : 'Item'));

  bool get hasOpenRequest => request?.active == true;
}

/// A hand-off: the owner let someone else collect some of the items.
class PickupDelegation {
  final String id;
  final List<String> items;
  final String delegateName;
  final String? delegatePhone;
  final String? delegateEmail;
  final String verify; // qr | qr_name | qr_id
  final String verifyLabel;
  final DateTime? validUntil;
  final String? note;
  final String code;
  final String status; // active | revoked | completed | expired
  final DateTime? completedAt;
  final String? collectedBy;
  final String? passUrl;
  PickupDelegation({
    required this.id,
    required this.items,
    required this.delegateName,
    required this.delegatePhone,
    required this.delegateEmail,
    required this.verify,
    required this.verifyLabel,
    required this.validUntil,
    required this.note,
    required this.code,
    required this.status,
    required this.completedAt,
    required this.collectedBy,
    required this.passUrl,
  });
  factory PickupDelegation.from(Map<String, dynamic> m) {
    final d = _m(m['delegate']);
    return PickupDelegation(
      id: _s(m['id']),
      items: (m['items'] is List) ? (m['items'] as List).map((e) => e.toString()).toList() : const [],
      delegateName: _s(d['name']),
      delegatePhone: d['phone'] == null ? null : _s(d['phone']),
      delegateEmail: d['email'] == null ? null : _s(d['email']),
      verify: _s(m['verify'], 'qr_id'),
      verifyLabel: _s(m['verifyLabel'], 'QR + photo ID'),
      validUntil: _dt(m['validUntil']),
      note: m['note'] == null ? null : _s(m['note']),
      code: _s(m['code']),
      status: _s(m['status'], 'active'),
      completedAt: _dt(m['completedAt']),
      collectedBy: m['collectedBy'] == null ? null : _s(m['collectedBy']),
      passUrl: m['passUrl'] == null ? null : _s(m['passUrl']),
    );
  }
  bool get isActive => status == 'active';
  String get who => delegateName.isNotEmpty ? delegateName : (delegatePhone ?? delegateEmail ?? 'someone');
}

class TimelineEntry {
  final DateTime? at;
  final String type; // booked | access | extended | settled | cancelled | note …
  final String actor;
  final String actorRole; // guest | host | platform | system
  final String detail;
  final double? amount;
  TimelineEntry({
    required this.at,
    required this.type,
    required this.actor,
    required this.actorRole,
    required this.detail,
    required this.amount,
  });
  factory TimelineEntry.from(Map<String, dynamic> m) => TimelineEntry(
        at: _dt(m['at']),
        type: _s(m['type']),
        actor: _s(m['actor']),
        actorRole: _s(m['actorRole']),
        detail: _s(m['detail']),
        amount: m['amount'] is num ? (m['amount'] as num).toDouble() : null,
      );
}

// ── parse helpers ──────────────────────────────────────────────────────────

Map<String, dynamic> _m(dynamic v) =>
    v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

String _s(dynamic v, [String fallback = '']) =>
    v == null ? fallback : v.toString();

double _d(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

double? _numOrNull(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

DateTime? _dt(dynamic v) {
  if (v == null) return null;
  if (v is int) return DateTime.fromMillisecondsSinceEpoch(v).toLocal();
  final s = v.toString();
  if (s.isEmpty) return null;
  final ms = int.tryParse(s);
  if (ms != null && s.length >= 12) {
    return DateTime.fromMillisecondsSinceEpoch(ms).toLocal();
  }
  return DateTime.tryParse(s)?.toLocal();
}

/// Address may be a string or a {line1, city, state, ...} map.
String _joinAddress(dynamic a) {
  if (a == null) return '';
  if (a is String) return a;
  if (a is Map) {
    final parts = [
      a['line1'] ?? a['street'] ?? a['address'],
      a['line2'],
      a['city'],
      a['state'] ?? a['region'],
      a['postalCode'] ?? a['zip'],
    ].where((e) => e != null && e.toString().trim().isNotEmpty).toList();
    return parts.join(', ');
  }
  return a.toString();
}
