import 'package:flutter/foundation.dart';
import 'http_client.dart';

/// Wraps the backend `/checkin/*` endpoints
/// (see `/Users/imzee/projects/appengine/src/checkin/checkin.controller.ts`).
///
/// One screen per vertical — restaurant, salon, clinic, DMV, pickup counter —
/// flows through this same surface. Tasks at stage 0 of the
/// `reservation-checkin-pipeline` workflow are the queue.
class CheckinService {
  final AppengineHttpClient _http = AppengineHttpClient();

  /// Live queue — tasks at stage 0 of the check-in pipeline.
  /// Server returns each task with `enrich.{waitedMs,isOverdue,queuePosition,displayName}`.
  Future<List<Map<String, dynamic>>> listQueue({
    String? businessLocationId,
    int? partySize,
    String? source,
  }) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      if (partySize != null) qp['partySize'] = partySize.toString();
      if (source != null && source.isNotEmpty) qp['source'] = source;
      final response = await _http.get('/checkin/queue', queryParams: qp.isEmpty ? null : qp);
      return _asList(response);
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.listQueue failed: $e');
      rethrow;
    }
  }

  /// Summary stats: counts, current avg wait, longest current.
  Future<Map<String, dynamic>> queueSummary({String? businessLocationId}) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      final response = await _http.get('/checkin/queue/summary', queryParams: qp.isEmpty ? null : qp);
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return {};
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.queueSummary failed: $e');
      return {};
    }
  }

  /// Upcoming reservations (not yet checked in) within the window.
  /// Server enriches with `{minutesUntil, isLate, isImminent, displayName}`.
  Future<List<Map<String, dynamic>>> upcoming({
    String? businessLocationId,
    int? windowHours,
  }) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      if (windowHours != null) qp['windowHours'] = windowHours.toString();
      final response = await _http.get('/checkin/upcoming', queryParams: qp.isEmpty ? null : qp);
      return _asList(response);
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.upcoming failed: $e');
      rethrow;
    }
  }

  /// ALL service points at this location — any status. Occupied/reserved
  /// rows come with `enrich.assignedTask` populated so the UI can show who's
  /// seated where. This is the React Check-in screen's Spots panel.
  Future<List<Map<String, dynamic>>> listAllServicePoints({
    String? businessLocationId,
  }) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      final response = await _http.get('/checkin/service-point',
          queryParams: qp.isEmpty ? null : qp);
      return _asList(response);
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.listAllServicePoints failed: $e');
      return const [];
    }
  }

  /// Past queue tasks (assigned out, completed, no-show, left, cancelled)
  /// inside the given window. Defaults to last 24h.
  Future<List<Map<String, dynamic>>> queueHistory({
    String? businessLocationId,
    int? sinceMs,
  }) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      qp['sinceMs'] = (sinceMs ?? 24 * 60 * 60 * 1000).toString();
      final response = await _http.get('/checkin/queue/history',
          queryParams: qp.isEmpty ? null : qp);
      return _asList(response);
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.queueHistory failed: $e');
      return const [];
    }
  }

  /// All reservations for today (operator's tz). React Check-in shows this
  /// as a collapsible strip — booked/confirmed/pending/arrived/used/no-show.
  Future<List<Map<String, dynamic>>> reservationsToday({
    String? businessLocationId,
  }) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      qp['tzOffsetMinutes'] = DateTime.now().timeZoneOffset.inMinutes.toString();
      final response = await _http.get('/checkin/reservations/today',
          queryParams: qp.isEmpty ? null : qp);
      return _asList(response);
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.reservationsToday failed: $e');
      return const [];
    }
  }

  /// Available service points for assignment ("what's open" view).
  Future<List<Map<String, dynamic>>> availableServicePoints({
    String? businessLocationId,
  }) async {
    try {
      final qp = <String, String>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        qp['businessLocationId'] = businessLocationId;
      }
      final response =
          await _http.get('/checkin/service-point/available', queryParams: qp.isEmpty ? null : qp);
      return _asList(response);
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.availableServicePoints failed: $e');
      return const [];
    }
  }

  // ─── Host actions ─────────────────────────────────────────────────────

  /// Create a walk-in queue entry (no prior reservation).
  /// `body` matches the server's @Post('walk-in') schema: customer, partySize,
  /// preferences, notes, businessLocationId, preferredServicePoint(Kind).
  Future<Map<String, dynamic>?> walkIn(Map<String, dynamic> body) async {
    try {
      final response = await _http.post('/checkin/walk-in', body: body);
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.walkIn failed: $e');
      rethrow;
    }
  }

  /// Convert a reservation into a queue entry — the reserved guest just arrived.
  Future<Map<String, dynamic>?> fromReservation(
    String reservationId, {
    Map<String, dynamic>? extra,
  }) async {
    try {
      final response = await _http.post(
        '/checkin/from-reservation/$reservationId',
        body: extra ?? const {},
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.fromReservation failed: $e');
      rethrow;
    }
  }

  /// Assign a service point — advances task to terminal stage, notifies customer.
  Future<Map<String, dynamic>?> assign(String taskId, String servicePointId) async {
    try {
      final response = await _http.post(
        '/checkin/$taskId/assign',
        body: {'servicePointId': servicePointId},
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.assign failed: $e');
      rethrow;
    }
  }

  /// Guest left the queue.
  Future<Map<String, dynamic>?> leave(String taskId, {String? reason}) async {
    try {
      final response = await _http.post(
        '/checkin/$taskId/leave',
        body: {if (reason != null) 'reason': reason},
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.leave failed: $e');
      rethrow;
    }
  }

  /// Mark guest as no-show.
  Future<Map<String, dynamic>?> noShow(String taskId) async {
    try {
      final response = await _http.post('/checkin/$taskId/no-show');
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.noShow failed: $e');
      rethrow;
    }
  }

  /// Re-send "your table is ready" notification.
  Future<Map<String, dynamic>?> notify(String taskId) async {
    try {
      final response = await _http.post('/checkin/$taskId/notify');
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.notify failed: $e');
      rethrow;
    }
  }

  /// Clear a service point — bus or mark available. `finalStatus` defaults
  /// to 'dirty' on the server.
  Future<Map<String, dynamic>?> clearServicePoint(
    String spId, {
    String? finalStatus,
  }) async {
    try {
      final response = await _http.post(
        '/checkin/service-point/$spId/clear',
        body: {if (finalStatus != null) 'finalStatus': finalStatus},
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('CheckinService.clearServicePoint failed: $e');
      rethrow;
    }
  }

  List<Map<String, dynamic>> _asList(dynamic response) {
    List raw;
    if (response is List) {
      raw = response;
    } else if (response is Map && response['data'] is List) {
      raw = response['data'] as List;
    } else if (response is Map && response['items'] is List) {
      raw = response['items'] as List;
    } else {
      raw = const [];
    }
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
}

final checkinService = CheckinService();
