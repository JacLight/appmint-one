import 'http_client.dart';

/// Scheduling — appointments, classes, coaching sessions, and the cases that
/// ride on them.
///
/// Two surfaces: `client-data` is the customer's own bookings, `checkin` is
/// the provider running the day. Both are real.
class SchedulingApi {
  static final SchedulingApi _instance = SchedulingApi._();
  factory SchedulingApi() => _instance;
  SchedulingApi._();

  final AppengineHttpClient _http = appengineHttpClient;

  static const _client = '/client-data';
  static const _checkin = '/checkin';

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : <String, dynamic>{};

  List<Map<String, dynamic>> _records(dynamic r) {
    dynamic list;
    if (r is List) {
      list = r;
    } else if (r is Map) {
      list = r['data'] ?? r['items'] ?? r['results'] ?? r['rows'] ?? [];
    }
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  // ── Customer ────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> myBookings() async =>
      _records(await _http.get('$_client/reservations'));

  Future<Map<String, dynamic>> booking(String id) async =>
      _map(await _http.get('$_client/reservations/$id'));

  /// Open times for a service on a day.
  ///
  /// `reservationDefinitionId` and `serviceDate` (YYYY-MM-DD) are both
  /// required by the server; the date is a calendar date in the business's
  /// timezone, not an instant, and must not be in the past.
  Future<List<Map<String, dynamic>>> availableSlots({
    required String reservationDefinitionId,
    required DateTime day,
    String? serviceName,
    int slotIncrementMinutes = 5,
    int? partySize,
    String? location,
  }) async {
    final res = await _http.post('$_client/reservations/available-slots', body: {
      'reservationDefinitionId': reservationDefinitionId,
      'serviceDate': _ymd(day),
      if (serviceName != null) 'serviceName': serviceName,
      'slotIncrementMinutes': slotIncrementMinutes,
      if (partySize != null) 'partySize': partySize,
      if (location != null) 'location': location,
    });
    return _records(res);
  }

  Future<Map<String, dynamic>> book(Map<String, dynamic> reservation) async =>
      _map(await _http.post('$_client/reservations', body: reservation));

  /// Reschedule. The server takes the whole reservation, not a patch.
  Future<Map<String, dynamic>> reschedule(
          Map<String, dynamic> reservation) async =>
      _map(await _http.put('$_client/reservations', body: reservation));

  Future<void> cancel(String id) async {
    await _http.delete('$_client/reservations/$id');
  }

  // ── Provider: running the day ───────────────────────────────────────────

  Future<List<Map<String, dynamic>>> today() async =>
      _records(await _http.get('$_checkin/reservations/today'));

  Future<List<Map<String, dynamic>>> upcoming() async =>
      _records(await _http.get('$_checkin/upcoming'));

  Future<List<Map<String, dynamic>>> queue() async =>
      _records(await _http.get('$_checkin/queue'));

  Future<Map<String, dynamic>> queueSummary() async =>
      _map(await _http.get('$_checkin/queue/summary'));

  Future<List<Map<String, dynamic>>> servicePoints({bool onlyFree = false}) async =>
      _records(await _http
          .get('$_checkin/service-point${onlyFree ? '/available' : ''}'));

  /// Turn a booking into an arrival.
  Future<Map<String, dynamic>> checkIn(String reservationId) async =>
      _map(await _http.post('$_checkin/from-reservation/$reservationId',
          body: const {}));

  Future<Map<String, dynamic>> walkIn(Map<String, dynamic> body) async =>
      _map(await _http.post('$_checkin/walk-in', body: body));

  Future<Map<String, dynamic>> assign(String taskId, {String? servicePointId}) async =>
      _map(await _http.post('$_checkin/$taskId/assign',
          body: {if (servicePointId != null) 'servicePointId': servicePointId}));

  Future<Map<String, dynamic>> noShow(String taskId) async =>
      _map(await _http.post('$_checkin/$taskId/no-show', body: const {}));

  Future<Map<String, dynamic>> leave(String taskId) async =>
      _map(await _http.post('$_checkin/$taskId/leave', body: const {}));

  static String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}

final schedulingApi = SchedulingApi();
