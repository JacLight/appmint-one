/// The custody state machine:
///   RESERVED ──drop-off──▶ STORED ──retrieve──▶ RETRIEVED ──settle──▶ CLOSED
enum CustodyStatus { reserved, stored, retrieved, closed, cancelled }

extension CustodyStatusX on CustodyStatus {
  String get wire {
    switch (this) {
      case CustodyStatus.reserved:
        return 'RESERVED';
      case CustodyStatus.stored:
        return 'STORED';
      case CustodyStatus.retrieved:
        return 'RETRIEVED';
      case CustodyStatus.closed:
        return 'CLOSED';
      case CustodyStatus.cancelled:
        return 'CANCELLED';
    }
  }

  String get label {
    switch (this) {
      case CustodyStatus.reserved:
        return 'Reserved';
      case CustodyStatus.stored:
        return 'Stored';
      case CustodyStatus.retrieved:
        return 'Retrieved';
      case CustodyStatus.closed:
        return 'Closed';
      case CustodyStatus.cancelled:
        return 'Cancelled';
    }
  }

  static CustodyStatus parse(String? s) {
    switch ((s ?? '').toUpperCase()) {
      case 'STORED':
        return CustodyStatus.stored;
      case 'RETRIEVED':
        return CustodyStatus.retrieved;
      case 'CLOSED':
        return CustodyStatus.closed;
      case 'CANCELLED':
        return CustodyStatus.cancelled;
      default:
        return CustodyStatus.reserved;
    }
  }
}

/// One booking + its custody lifecycle. Maps to a `stowbo_custody` record.
class Custody {
  final String sk;
  final String hostId;
  final String hostName;
  final String hostEmail;
  final String guestUserId;
  final String guestName;
  final String guestEmail;
  final String? guestPhone;
  final int itemCount;
  final CustodyStatus status;
  final String handoffCode; // dropoff code — guest shows at drop-off
  final String pickupCode; // guest shows at retrieval
  final int lineIndex; // which booking line this represents
  final double? serverTotal; // authoritative total from the engine
  final String? dropoffPhotoUrl;
  final String? plate; // parking vertical
  final double ratePerHour;
  final DateTime? reservedAt;
  final DateTime? storedAt;
  final DateTime? retrievedAt;
  final double? amount; // final settled charge
  final String? paymentMethod; // 'stripe' | 'cash' | null
  final String? paymentRef; // Stripe PaymentIntent id, for reconciliation
  final String? threadId; // community chat thread with the other party

  Custody({
    required this.sk,
    required this.hostId,
    required this.hostName,
    this.hostEmail = '',
    required this.guestUserId,
    required this.guestName,
    this.guestEmail = '',
    this.guestPhone,
    required this.itemCount,
    required this.status,
    required this.handoffCode,
    this.pickupCode = '',
    this.lineIndex = 0,
    this.serverTotal,
    this.dropoffPhotoUrl,
    this.plate,
    required this.ratePerHour,
    this.reservedAt,
    this.storedAt,
    this.retrievedAt,
    this.amount,
    this.paymentMethod,
    this.paymentRef,
    this.threadId,
  });

  bool get isPaid => status == CustodyStatus.closed && amount != null;
  bool get awaitingPayment =>
      status == CustodyStatus.retrieved && amount == null;

  bool get isActive =>
      status == CustodyStatus.reserved || status == CustodyStatus.stored;

  /// Elapsed custody duration (drop-off → now/retrieve).
  Duration elapsed([DateTime? now]) {
    final start = storedAt;
    if (start == null) return Duration.zero;
    final end = retrievedAt ?? now ?? DateTime.now();
    final d = end.difference(start);
    return d.isNegative ? Duration.zero : d;
  }

  /// The charge, as computed by the engine (the UI never prices anything).
  double estimatedCharge([DateTime? now]) => serverTotal ?? amount ?? 0;

  static double _d(dynamic v, [double def = 0]) =>
      v == null ? def : (v is num ? v.toDouble() : double.tryParse('$v') ?? def);
  static int _i(dynamic v, [int def = 0]) =>
      v == null ? def : (v is num ? v.toInt() : int.tryParse('$v') ?? def);
  static DateTime? _dt(dynamic v) =>
      v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

  static CustodyStatus _status(String? bStatus, String? lineState) {
    switch ((bStatus ?? '').toLowerCase()) {
      case 'settled':
        return CustodyStatus.closed;
      case 'cancelled':
      case 'no_show':
        return CustodyStatus.cancelled;
    }
    switch ((lineState ?? '').toLowerCase()) {
      case 'stored':
        return CustodyStatus.stored;
      case 'retrieved':
        return CustodyStatus.retrieved;
      case 'damaged':
      case 'lost':
      case 'abandoned':
        return CustodyStatus.stored;
      default:
        return CustodyStatus.reserved;
    }
  }

  /// Flatten one line of a real `stowbo_booking` record into a Custody view.
  /// [hostName]/[hostEmail] can be supplied by the caller (resolved from the
  /// listing) since the booking itself only carries the listing code.
  factory Custody.fromBookingRecord(
    Map<String, dynamic> rec, {
    int line = 0,
    String? hostName,
    String? hostEmail,
  }) {
    final data = (rec['data'] is Map)
        ? Map<String, dynamic>.from(rec['data'])
        : <String, dynamic>{};
    final items = (data['items'] is List) ? data['items'] as List : const [];
    final l = (line < items.length && items[line] is Map)
        ? Map<String, dynamic>.from(items[line])
        : <String, dynamic>{};
    final bStatus = data['status']?.toString();
    final status = _status(bStatus, l['state']?.toString());
    final total = data['total'] == null ? null : _d(data['total']);
    return Custody(
      sk: (rec['sk'] ?? '').toString(),
      hostId: (l['hostId'] ?? l['listing'] ?? '').toString(),
      hostName: hostName ??
          (l['listingTitle'] ?? l['listing'] ?? 'Stowbo host').toString(),
      hostEmail: hostEmail ?? (l['hostEmail'] ?? '').toString(),
      guestUserId: (data['customer'] ?? rec['author'] ?? '').toString(),
      guestName: (data['customerName'] ?? data['customer'] ?? 'Guest').toString(),
      guestEmail: (data['customer'] ?? '').toString(),
      itemCount: _i(l['quantity'], 1),
      status: status,
      handoffCode: (data['dropoffCode'] ?? '').toString(),
      pickupCode: (data['pickupCode'] ?? '').toString(),
      lineIndex: line,
      serverTotal: total,
      dropoffPhotoUrl: null,
      ratePerHour: _d(l['price'], 0),
      reservedAt: _dt(rec['createdate']),
      storedAt: status.index >= CustodyStatus.stored.index
          ? _dt(rec['modifydate'])
          : null,
      retrievedAt: status.index >= CustodyStatus.retrieved.index
          ? _dt(rec['modifydate'])
          : null,
      amount: status == CustodyStatus.closed ? total : null,
      paymentMethod: null,
      paymentRef: null,
      threadId: null,
    );
  }

  static const String datatype = 'stowbo_booking';
}
