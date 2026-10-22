import '../models/custody.dart';
import 'stowbo_api.dart';

/// Read side of the customer's custody: their bookings and stored things,
/// flattened into [Custody] views. Bookings are NOT created here — the customer
/// builds a cart (CheckoutProvider) that becomes a booking on confirm; the
/// server then auto-creates one booking-item per thing. This service only
/// reads what already exists.
class CustodyService {
  final StowboApi _api = stowboApi;

  /// Guest's bookings, flattened to one Custody per line.
  Future<List<Custody>> forGuest(String guestUserId) async {
    final bookings = await _api.myBookings();
    final out = <Custody>[];
    for (final b in bookings) {
      final data = (b['data'] is Map) ? b['data'] as Map : const {};
      final items = (data['items'] is List) ? data['items'] as List : const [];
      if (items.isEmpty) {
        out.add(Custody.fromBookingRecord(b));
      } else {
        for (var i = 0; i < items.length; i++) {
          out.add(Custody.fromBookingRecord(b, line: i));
        }
      }
    }
    return _sorted(out);
  }

  /// Host's queue — items currently in their care. Sourced from the today
  /// board's `inCustody` (the dedicated custody route was retired; the Counter
  /// is the real operator surface now).
  Future<List<Custody>> forHost(List<String> hostIds) async {
    final today = await _api.hostToday();
    final inCustody =
        (today['inCustody'] is List) ? today['inCustody'] as List : const [];
    return inCustody
        .whereType<Map>()
        .map((e) => _lineToCustody(Map<String, dynamic>.from(e)))
        .toList();
  }

  // Drop-off and hand-back are now item movements (in / out) + check-out at the
  // Counter (`itemMovement` / `itemCheckout`), not code-scan order routes.

  Future<double?> settle(Custody c, {String method = 'cash', String? ref}) async {
    final res = await _api.settle(c.sk);
    final total = res['total'] ?? res['settled'] ?? res['amount'];
    return total is num ? total.toDouble() : c.estimatedCharge();
  }

  Future<void> cancel(String bookingId) => _api.cancelBooking(bookingId);

  // ── mapping ───────────────────────────────────────────────────────────────
  Custody _lineToCustody(Map<String, dynamic> line) {
    double d(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
    int i(dynamic v) =>
        v == null ? 1 : (v is num ? v.toInt() : int.tryParse('$v') ?? 1);
    final state = (line['state'] ?? 'stored').toString();
    return Custody(
      sk: (line['booking'] ?? '').toString(),
      hostId: (line['listing'] ?? '').toString(),
      hostName: (line['listingTitle'] ?? line['listing'] ?? 'Booking').toString(),
      guestUserId: (line['customer'] ?? '').toString(),
      guestName: (line['customerName'] ?? line['customer'] ?? 'Guest').toString(),
      guestEmail: (line['customer'] ?? '').toString(),
      itemCount: i(line['quantity']),
      status: state == 'retrieved'
          ? CustodyStatus.retrieved
          : CustodyStatus.stored,
      handoffCode: (line['dropoffCode'] ?? '').toString(),
      pickupCode: (line['pickupCode'] ?? '').toString(),
      lineIndex: i(line['index']) - 1 < 0 ? 0 : i(line['index']),
      serverTotal: line['total'] == null ? null : d(line['total']),
      ratePerHour: d(line['price']),
    );
  }

  List<Custody> _sorted(List<Custody> list) {
    list.sort((a, b) {
      if (a.isActive != b.isActive) return a.isActive ? -1 : 1;
      final at = a.reservedAt ?? DateTime(2000);
      final bt = b.reservedAt ?? DateTime(2000);
      return bt.compareTo(at);
    });
    return list;
  }
}

final custodyService = CustodyService();
