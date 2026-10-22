import 'package:flutter/foundation.dart';

import '../models/operations_reservation_model.dart';
import '../models/kitchen_ticket.dart';
import 'http_client.dart';

/// Operations API client for the queue/check-in/service-point lifecycle.
///
/// Endpoints used (legacy /checkin/* and /crm/reservations/queue/* are
/// being torn down; this service uses ONLY the surviving CRUD surface):
///
///   GET    /crm/reservations/get/:id?           — fetch one or all
///   GET    /crm/reservations/by-email/:email/:resvNumber?
///   POST   /crm/reservations/create
///   POST   /crm/reservations/update
///   DELETE /crm/reservations/cancel/:email/:resvNumber
///   GET    /crm/reservations/definitions
///   POST   /crm/reservations/slots
///   GET    /crm/reservations/service-point/get/:id?
///   POST   /crm/reservations/service-point/create | update
///   DELETE /crm/reservations/service-point/delete/:id
///
/// Plus the generic repository endpoint for filtered queue queries:
///   POST /repository/find/reservation
class OperationsService {
  final AppengineHttpClient _http = appengineHttpClient;

  // ─── Reservation definitions (catalog of bookable services) ──────────

  Future<List<String>> getKitchenStations() async {
    final response = await _http.get('/workflow/stations');
    final stations = response is Map ? response['stations'] : null;
    if (stations is! List) return [];
    return stations.map(normalizePrepStation).toSet().toList();
  }

  /// Fetch every prep ticket for one venue. The generic workflow endpoint
  /// doesn't support a location filter; scope in the repository query instead
  /// of filtering a truncated, organization-wide first page on the device.
  Future<List<Map<String, dynamic>>> listKitchenTasks({
    required String workflowId,
    required String businessLocationId,
  }) async {
    if (businessLocationId.isEmpty || workflowId.isEmpty) return [];
    final result = <Map<String, dynamic>>[];
    final since = DateTime.now()
        .toUtc()
        .subtract(const Duration(hours: 24))
        .toIso8601String();
    for (var page = 1; ; page++) {
      final response = await _http.post(
        '/repository/find/task',
        body: {
          'query': {
            'data.workflowId': workflowId,
            'data.payload.businessLocationId': businessLocationId,
            'state': {r'$ne': 'archived'},
            r'$or': [
              {
                'data.status': {
                  r'$in': ['new', 'pending', 'inprogress', 'blocked'],
                },
              },
              {
                'data.status': 'done',
                'data.completedAt': {r'$gte': since},
              },
            ],
          },
          'options': {
            'page': page,
            'pageSize': 200,
            'sort': 'createdate',
            'sortType': 1,
          },
        },
      );
      final raw = response is List
          ? response
          : (response is Map ? response['data'] : null);
      if (raw is! List)
        throw const FormatException('Invalid prep ticket response');
      final rows = raw
          .whereType<Map>()
          .map((r) => Map<String, dynamic>.from(r))
          .toList();
      result.addAll(rows);
      if (raw.length < 200) return result;
      if (page >= 50)
        throw StateError(
          'Too many prep tickets; archive completed tickets and retry.',
        );
    }
  }

  /// Public catalog used by the booking UI / "what can I book?" view.
  /// Returns the active definitions with per-org template overrides
  /// applied. SDK datatype is `reservationdefinition` (no underscore).
  Future<List<Map<String, dynamic>>> getReservationDefinitions() async {
    try {
      final response = await _http.get('/crm/reservations/definitions');
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.getReservationDefinitions failed: $e');
      return const [];
    }
  }

  /// Generate available appointment slots for a reservation definition
  /// on a given date. Backend reads the definition's officeHours,
  /// blockedTime, services[].duration, breakAfter, etc., and returns
  /// the open slots minus existing reservations.
  Future<Map<String, dynamic>> getSlots({
    required String reservationDefinitionId,
    required String serviceName,
    required DateTime serviceDate,
  }) async {
    try {
      final response = await _http.post(
        '/crm/reservations/slots',
        body: {
          'reservationDefinitionId': reservationDefinitionId,
          'serviceName': serviceName,
          'serviceDate': serviceDate.toIso8601String(),
        },
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return const {};
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.getSlots failed: $e');
      return const {};
    }
  }

  /// Resend the reservation reminder template (manual trigger from the
  /// operator UI). Reservations also auto-fire reminders per the
  /// definition's notifications[] schedule.
  Future<void> sendReservationReminder(
    String reservationId, {
    int notificationIndex = 0,
  }) async {
    try {
      await _http.post(
        '/crm/reservations/send-reminder/$reservationId',
        body: {'notificationIndex': notificationIndex},
      );
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.sendReservationReminder failed: $e');
      rethrow;
    }
  }

  /// Push a booked reservation into the live check-in queue. This is the
  /// correct hand-off (creates a check-in Task on the reservation-checkin
  /// pipeline + fires the ready notifications) — NOT a reservation status
  /// write. Backend: POST /checkin/from-reservation/:reservationId.
  Future<bool> checkInFromReservation(
    String reservationId, {
    int? partySize,
    String? notes,
    String? businessLocationId,
  }) async {
    if (reservationId.isEmpty) return false;
    try {
      await _http.post(
        '/checkin/from-reservation/$reservationId',
        body: {
          if (partySize != null) 'partySize': partySize,
          if (businessLocationId != null && businessLocationId.isNotEmpty)
            'businessLocationId': businessLocationId,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
      return true;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.checkInFromReservation failed: $e');
      rethrow;
    }
  }

  // ─── Reservations ─────────────────────────────────────────────────────

  /// Get reservations. Pass [id] to fetch one. Empty = all reservations
  /// the current user can see.
  Future<List<OpsReservation>> getReservations({String? id}) async {
    try {
      final path = id == null || id.isEmpty
          ? '/crm/reservations/get'
          : '/crm/reservations/get/$id';
      final response = await _http.get(path);
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is Map && id != null && id.isNotEmpty) {
        // Single reservation returned as object
        return [OpsReservation.fromJson(Map<String, dynamic>.from(response))];
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => OpsReservation.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.getReservations failed: $e');
      return const [];
    }
  }

  /// Filter reservations by status (waiting / notified / in_progress / etc).
  /// Uses /repository/find/reservation since /crm/reservations/get returns
  /// the caller's reservations only — operators need to see EVERYONE in
  /// the queue, not just their own.
  Future<List<OpsReservation>> findReservations({
    List<String>? statuses,
    String? businessLocationId,
    String? targetType,
    int pageSize = 200,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (statuses != null && statuses.isNotEmpty) {
        query['data.status'] = {r'$in': statuses};
      }
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        query['data.businessLocationId'] = businessLocationId;
      }
      if (targetType != null && targetType.isNotEmpty) {
        query['data.targetType'] = targetType;
      }
      final response = await _http.post(
        '/repository/find/reservation',
        body: {
          'query': query,
          // No server sort — bookings have no `joinedAt` (only fabricated queue
          // entries did). Desktop sorts client-side; match it and de-risk the
          // find (a missing sort key must never hide rows).
          'options': {'pageSize': pageSize},
        },
      );
      List rawList;
      if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is List) {
        rawList = response;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => OpsReservation.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.findReservations failed: $e');
      return const [];
    }
  }

  Future<OpsReservation?> createReservation(OpsReservation reservation) async {
    try {
      final response = await _http.post(
        '/crm/reservations/create',
        body: reservation.toCreatePayload(),
      );
      if (response is Map<String, dynamic>)
        return OpsReservation.fromJson(response);
      if (response is Map)
        return OpsReservation.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.createReservation failed: $e');
      rethrow;
    }
  }

  Future<OpsReservation?> updateReservation(OpsReservation reservation) async {
    if (reservation.sk.isEmpty) {
      throw Exception('updateReservation: sk required');
    }
    try {
      final response = await _http.post(
        '/crm/reservations/update',
        body: reservation.toCreateBody(),
      );
      if (response is Map<String, dynamic>)
        return OpsReservation.fromJson(response);
      if (response is Map)
        return OpsReservation.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.updateReservation failed: $e');
      rethrow;
    }
  }

  // ─── Service Points ───────────────────────────────────────────────────

  Future<List<ServicePoint>> getServicePoints({String? id}) async {
    try {
      final path = id == null || id.isEmpty
          ? '/crm/reservations/service-point/get'
          : '/crm/reservations/service-point/get/$id';
      final response = await _http.get(path);
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is Map && id != null && id.isNotEmpty) {
        return [ServicePoint.fromJson(Map<String, dynamic>.from(response))];
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => ServicePoint.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.getServicePoints failed: $e');
      return const [];
    }
  }

  /// Filter service points by businessLocationId / kind / status via the
  /// generic repository find endpoint. The dedicated get endpoint returns
  /// everything; this lets operator UI scope by venue.
  Future<List<ServicePoint>> findServicePoints({
    String? businessLocationId,
    String? kind,
    List<String>? statuses,
    int pageSize = 500,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        query['data.businessLocationId'] = businessLocationId;
      }
      if (kind != null && kind.isNotEmpty) {
        query['data.kind'] = kind;
      }
      if (statuses != null && statuses.isNotEmpty) {
        query['data.status'] = {r'$in': statuses};
      }
      final response = await _http.post(
        '/repository/find/service_point',
        body: {
          'query': query,
          'options': {
            'pageSize': pageSize,
            'sort': 'data.sortOrder',
            'sortType': 1,
          },
        },
      );
      List rawList;
      if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is List) {
        rawList = response;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => ServicePoint.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.findServicePoints failed: $e');
      return const [];
    }
  }

  Future<ServicePoint?> createServicePoint(ServicePoint sp) async {
    try {
      final response = await _http.post(
        '/crm/reservations/service-point/create',
        body: sp.toCreateBody(),
      );
      if (response is Map<String, dynamic>)
        return ServicePoint.fromJson(response);
      if (response is Map)
        return ServicePoint.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.createServicePoint failed: $e');
      rethrow;
    }
  }

  Future<void> deleteServicePoint(String id) async {
    if (id.isEmpty) throw Exception('deleteServicePoint: id required');
    try {
      await _http.delete('/crm/reservations/service-point/delete/$id');
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.deleteServicePoint failed: $e');
      rethrow;
    }
  }

  Future<ServicePoint?> updateServicePoint(ServicePoint sp) async {
    if (sp.sk.isEmpty) throw Exception('updateServicePoint: sk required');
    try {
      final response = await _http.post(
        '/crm/reservations/service-point/update',
        body: sp.toCreateBody(),
      );
      if (response is Map<String, dynamic>)
        return ServicePoint.fromJson(response);
      if (response is Map)
        return ServicePoint.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.updateServicePoint failed: $e');
      rethrow;
    }
  }

  /// Change ONLY a table's status via the dedicated backend endpoint. This
  /// sets data.status/lastStatusChangeAt/lastStatusReason server-side and
  /// deliberately leaves occupant fields (currentTabId, seatedAt, …) to the
  /// tab flow. Using this instead of a full-record update stops mobile from
  /// erasing the table↔tab link. Backend: POST storefront/service-point/:id/status.
  Future<bool> setServicePointStatus(
    String id,
    String status, {
    String? reason,
    // With status 'reserved': hold the table for this booking through its
    // grace period (check-in seats that party there; a no-show releases it).
    String? reservationId,
  }) async {
    if (id.isEmpty) throw Exception('setServicePointStatus: id required');
    try {
      await _http.post(
        '/storefront/service-point/$id/status',
        body: {
          'status': status,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
          if (reservationId != null && reservationId.isNotEmpty) 'reservationId': reservationId,
        },
      );
      return true;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.setServicePointStatus failed: $e');
      rethrow;
    }
  }

  /// Seat a party by attaching a service point to an open tab/order.
  /// Backend: POST storefront/pos/tab/:orderSk/assign-service-point.
  Future<bool> assignServicePointToTab({
    required String orderSk,
    required String servicePointId,
    bool occupy = true,
    String? alias,
    int? partySize,
  }) async {
    if (orderSk.isEmpty || servicePointId.isEmpty) return false;
    try {
      await _http.post(
        '/storefront/pos/tab/$orderSk/assign-service-point',
        body: {
          'servicePointId': servicePointId,
          'occupy': occupy,
          if (alias != null && alias.isNotEmpty) 'alias': alias,
          if (partySize != null) 'partySize': partySize,
        },
      );
      return true;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.assignServicePointToTab failed: $e');
      rethrow;
    }
  }

  /// Free a table from its tab. Backend: POST storefront/pos/tab/:orderSk/release-service-point.
  Future<bool> releaseServicePointFromTab({
    required String orderSk,
    bool markDirty = true,
  }) async {
    if (orderSk.isEmpty) return false;
    try {
      await _http.post(
        '/storefront/pos/tab/$orderSk/release-service-point',
        body: {'markDirty': markDirty},
      );
      return true;
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.releaseServicePointFromTab failed: $e');
      rethrow;
    }
  }

  // ─── Workflow (for operator KDS-equivalent screen) ────────────────────

  /// List workflow definitions. Used by the workflow task screen to let
  /// the operator pick which pipeline they're working on (kitchen prep,
  /// lab work, exam-prep, application processing, etc).
  Future<List<Map<String, dynamic>>> listWorkflows({
    String? name,
    bool throwOnError = false,
  }) async {
    try {
      final response = await _http.get(
        '/workflow/definition',
        queryParams: name != null && name.isNotEmpty ? {'name': name} : null,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.listWorkflows failed: $e');
      if (throwOnError) rethrow;
      return const [];
    }
  }

  /// List Tasks on a workflow filtered by stage / status / owner.
  /// Mirrors GET /workflow/task contract from workflow.controller.ts:140-162.
  Future<List<Map<String, dynamic>>> listTasks({
    String? workflowId,
    int? stageId,
    List<String>? statuses,
    String? ownerDatatype,
    String? ownerId,
    String? assignTo,
    int pageSize = 200,
  }) async {
    try {
      final params = <String, String>{};
      if (workflowId != null) params['workflowId'] = workflowId;
      if (stageId != null) params['stageId'] = stageId.toString();
      if (statuses != null && statuses.isNotEmpty) {
        params['status'] = statuses.join(',');
      }
      if (ownerDatatype != null) params['ownerDatatype'] = ownerDatatype;
      if (ownerId != null) params['ownerId'] = ownerId;
      if (assignTo != null) params['assignTo'] = assignTo;
      params['pageSize'] = pageSize.toString();
      final response = await _http.get('/workflow/task', queryParams: params);
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.listTasks failed: $e');
      return const [];
    }
  }

  Future<Map<String, dynamic>?> advanceTask(String taskId) async {
    try {
      final response = await _http.post('/workflow/task/$taskId/advance');
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.advanceTask failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> completeTask(String taskId) async {
    try {
      final response = await _http.post('/workflow/task/$taskId/complete');
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.completeTask failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> moveTaskToStage(
    String taskId,
    int stageId,
  ) async {
    try {
      final response = await _http.post(
        '/workflow/task/$taskId/move-to/$stageId',
      );
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.moveTaskToStage failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> cancelTask(String taskId) async {
    try {
      final response = await _http.post('/workflow/task/$taskId/cancel');
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.cancelTask failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> addTaskNote(String taskId, String note) async {
    try {
      final response = await _http.post(
        '/workflow/task/$taskId/note',
        body: {'note': note},
      );
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.addTaskNote failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> snoozeTask(String taskId, int minutes) async {
    try {
      final response = await _http.post(
        '/workflow/task/$taskId/snooze',
        body: {'minutes': minutes},
      );
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.snoozeTask failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> escalateTaskNow(String taskId) async {
    try {
      final response = await _http.post('/workflow/task/$taskId/escalate-now');
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.escalateTaskNow failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> reassignTask(
    String taskId,
    List<String> assignTo,
  ) async {
    try {
      final response = await _http.post(
        '/workflow/task/$taskId/reassign',
        body: {'assignTo': assignTo},
      );
      return response is Map<String, dynamic>
          ? response
          : (response is Map ? Map<String, dynamic>.from(response) : null);
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.reassignTask failed: $e');
      rethrow;
    }
  }

  // ─── Workflow analytics / SLA dashboard ───────────────────────────────

  /// Aggregate wait-time stats for a workflow over the last [windowDays].
  /// Server returns shape:
  ///   { totalFlow: { mean, p50, p95, samples }, perStage: [...],
  ///     currentlyActive: { total, byStage: {...} } }
  Future<Map<String, dynamic>?> getWaitStats(
    String workflowId, {
    int windowDays = 7,
  }) async {
    try {
      final response = await _http.get(
        '/workflow/analytics/$workflowId/wait-times',
        queryParams: {'windowDays': windowDays.toString()},
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('OperationsService.getWaitStats failed: $e');
      return null;
    }
  }

  /// Tasks that have already breached their SLA dueDate.
  Future<List<Map<String, dynamic>>> getBreachedTasks({
    String? workflowId,
  }) async {
    try {
      final response = await _http.get(
        '/workflow/escalation/breached',
        queryParams: workflowId != null && workflowId.isNotEmpty
            ? {'workflowId': workflowId}
            : null,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.getBreachedTasks failed: $e');
      return const [];
    }
  }

  /// Tasks due to breach within [withinMinutes].
  Future<List<Map<String, dynamic>>> getUpcomingBreaches({
    int withinMinutes = 30,
    String? workflowId,
  }) async {
    try {
      final params = <String, String>{
        'withinMinutes': withinMinutes.toString(),
      };
      if (workflowId != null && workflowId.isNotEmpty) {
        params['workflowId'] = workflowId;
      }
      final response = await _http.get(
        '/workflow/escalation/upcoming',
        queryParams: params,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('OperationsService.getUpcomingBreaches failed: $e');
      return const [];
    }
  }
}

final operationsService = OperationsService();
