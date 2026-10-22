import 'package:flutter/foundation.dart';
import '../models/operations_reservation_model.dart';
import '../services/checkin_service.dart';
import '../services/operations_service.dart';

/// Operations state — combines reservations (booking + queue lifecycle),
/// service points, and workflow tasks for the same venue.
///
/// Queue lifecycle: 'waiting' → 'notified' → 'in_progress' → 'completed' / 'no_show'.
/// Each transition just updates the reservation row's status + the matching
/// timestamp field. No dedicated queue endpoints — they were removed.
class OperationsProvider extends ChangeNotifier {
  final OperationsService _svc;
  final bool kitchenOnly;
  OperationsProvider({OperationsService? service, this.kitchenOnly = false})
      : _svc = service ?? operationsService;
  String _kitchenLocation = '';
  int _taskRequest = 0;
  bool _disposed = false;
  DateTime? lastTaskRefresh;
  List<String> kitchenStations = [];
  bool _loadingWorkflows = false;

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _taskRequest++;
    super.dispose();
  }

  Future<void> setKitchenLocation(String location) async {
    if (location == _kitchenLocation) return;
    _kitchenLocation = location;
    _tasks = [];
    lastTaskRefresh = null;
    await loadTasks();
  }

  // ── Selected venue scope ──
  String _businessLocationId = '';
  String get businessLocationId => _businessLocationId;

  // ── Reservations ──
  List<OpsReservation> _reservations = [];
  List<OpsReservation> get reservations => _reservations;
  bool _loadingReservations = false;
  bool get loadingReservations => _loadingReservations;

  // ── Reservation definitions (catalog of bookable services) ──
  List<Map<String, dynamic>> _reservationDefinitions = [];
  List<Map<String, dynamic>> get reservationDefinitions => _reservationDefinitions;
  bool _loadingReservationDefinitions = false;
  bool get loadingReservationDefinitions => _loadingReservationDefinitions;

  /// Convenience filters by status.
  List<OpsReservation> get waiting =>
      _reservations.where((r) => r.status == 'waiting').toList();
  List<OpsReservation> get notified =>
      _reservations.where((r) => r.status == 'notified').toList();
  List<OpsReservation> get inProgress =>
      _reservations.where((r) => r.status == 'in_progress').toList();
  List<OpsReservation> get bookings =>
      _reservations.where((r) => r.status == 'new' || r.status == 'confirmed').toList();
  List<OpsReservation> get queueOnly =>
      _reservations.where((r) => r.isQueueStage).toList();

  // ── Service points ──
  List<ServicePoint> _servicePoints = [];
  List<ServicePoint> get servicePoints => _servicePoints;
  bool _loadingServicePoints = false;
  bool get loadingServicePoints => _loadingServicePoints;

  List<ServicePoint> get availableServicePoints =>
      _servicePoints.where((sp) => sp.isAvailable && sp.isActive).toList();

  /// Filter SPs by parent — useful for drilling into a section/floor.
  List<ServicePoint> childrenOf(String? parentName) {
    return _servicePoints.where((sp) => sp.parentName == parentName).toList()
      ..sort((a, b) {
        final ao = a.sortOrder ?? 999;
        final bo = b.sortOrder ?? 999;
        return ao.compareTo(bo);
      });
  }

  // ── Workflow ──
  List<Map<String, dynamic>> _workflows = [];
  List<Map<String, dynamic>> get workflows => _workflows;
  String _activeWorkflowId = '';
  String get activeWorkflowId => _activeWorkflowId;
  List<Map<String, dynamic>> _tasks = [];
  List<Map<String, dynamic>> get tasks => _tasks;
  bool _loadingTasks = false;
  bool get loadingTasks => _loadingTasks;

  // ── Status / errors ──
  bool _busy = false;
  bool get busy => _busy;
  String? _error;
  String? get error => _error;

  // ─── Scope ────────────────────────────────────────────────────────────

  bool _hasLoadedOnce = false;

  Future<void> setBusinessLocation(String id) async {
    // First call always loads — even if id is empty, we still want
    // org-scoped reservations/service points to surface. Previously this
    // returned early on `id == _businessLocationId` (both '') so screens
    // sat empty forever.
    final changed = id != _businessLocationId;
    if (!changed && _hasLoadedOnce) return;
    _businessLocationId = id;
    if (changed) {
      _reservations = [];
      _servicePoints = [];
      notifyListeners();
    }
    _hasLoadedOnce = true;
    await Future.wait([
      loadReservations(),
      loadServicePoints(),
    ]);
  }

  // ─── Reservations ─────────────────────────────────────────────────────

  /// Load reservations and group by status client-side — mirrors the web
  /// (`modern-reservations.tsx`), which fetches ALL reservations for the org
  /// with no status/location/joinedAt filters and buckets them in the UI.
  /// The old version hard-refused without a location and over-filtered on a
  /// location name + fixed status set + a `joinedAt` sort, which silently
  /// hid everything ("shows empty").
  Future<void> loadReservations() async {
    _loadingReservations = true;
    _error = null;
    notifyListeners();
    try {
      final all = await _svc.findReservations();
      // If a location is selected, narrow to it best-effort; records without a
      // location (or a matching one) still show — never hide everything.
      _reservations = _businessLocationId.isEmpty
          ? all
          : all
              .where((r) =>
                  (r.businessLocationId ?? '').isEmpty ||
                  r.businessLocationId == _businessLocationId)
              .toList();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loadingReservations = false;
      notifyListeners();
    }
  }

  /// Load the catalog of bookable services (reservation definitions).
  /// Always refreshes — caller decides when to invalidate.
  Future<void> loadReservationDefinitions() async {
    _loadingReservationDefinitions = true;
    notifyListeners();
    try {
      _reservationDefinitions = await _svc.getReservationDefinitions();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loadingReservationDefinitions = false;
      notifyListeners();
    }
  }

  /// Operator books a future reservation on behalf of a customer (front
  /// desk / phone). Creates with status='confirmed', source='phone' (the
  /// front desk books what a guest asked for on the phone).
  Future<OpsReservation?> bookReservation({
    required String reservationDefinitionId,
    required String serviceName,
    required DateTime startTime,
    required OpsReservationCustomer customer,
    num? partySize,
    String? notes,
    num? duration,
  }) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final endTime = duration != null
          ? startTime.add(Duration(minutes: duration.toInt()))
          : null;
      final created = await _svc.createReservation(OpsReservation(
        status: 'confirmed',
        source: 'phone',
        reservationDefinitionId: reservationDefinitionId,
        definition: serviceName,
        service: serviceName,
        startTime: startTime.toIso8601String(),
        endTime: endTime?.toIso8601String(),
        customer: customer,
        partySize: partySize,
        notes: notes,
        businessLocationId: _businessLocationId.isEmpty ? null : _businessLocationId,
      ));
      if (created != null) {
        _reservations = [..._reservations, created];
      }
      return created;
    } catch (e) {
      _error = e.toString();
      return null;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Check a booked reservation into the live queue — the correct hand-off to
  /// the /checkin/* Task pipeline (creates a queue task + fires ready SMS),
  /// instead of writing an invented reservation status. Reload after so the
  /// list reflects the server's `used`/task state.
  Future<bool> checkInReservation(OpsReservation r, {int? partySize, String? notes}) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final ok = await _svc.checkInFromReservation(r.sk, partySize: partySize, notes: notes, businessLocationId: _businessLocationId);
      if (ok) await loadReservations();
      return ok;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Walk-in arrives — create a reservation in 'waiting' status.
  Future<OpsReservation?> walkIn({
    required OpsReservationCustomer customer,
    num? partySize,
    String? notes,
    String? servicePointId,
    String? workflowName,
    String? targetType,
    String? reservationDefinitionId,
  }) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final now = DateTime.now().toIso8601String();
      final created = await _svc.createReservation(OpsReservation(
        status: 'waiting',
        source: 'walk-in',
        customer: customer,
        partySize: partySize,
        notes: notes,
        joinedAt: now,
        servicePointId: servicePointId,
        workflowName: workflowName,
        targetType: targetType,
        reservationDefinitionId: reservationDefinitionId,
        businessLocationId: _businessLocationId.isEmpty ? null : _businessLocationId,
      ));
      if (created != null) {
        _reservations = [..._reservations, created];
      }
      return created;
    } catch (e) {
      _error = e.toString();
      return null;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Generic queue-state transition. Caller picks the target status; we
  /// stamp the matching timestamp field automatically.
  Future<bool> transition(
    OpsReservation r,
    String newStatus, {
    String? servicePointId,
  }) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final now = DateTime.now().toIso8601String();
      final updated = r.copyWith(
        status: newStatus,
        servicePointId: servicePointId ?? r.servicePointId,
        notifiedAt: newStatus == 'notified' ? now : r.notifiedAt,
        startedAt: newStatus == 'in_progress' ? now : r.startedAt,
        completedAt: (newStatus == 'completed' || newStatus == 'no_show')
            ? now
            : r.completedAt,
      );
      final saved = await _svc.updateReservation(updated);
      if (saved != null) {
        _reservations = _reservations.map((x) => x.sk == r.sk ? saved : x).toList();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Convenience: notify customer their spot is ready, and record the
  /// service point assignment.
  Future<bool> notifyReady(OpsReservation r, {required String servicePointId}) =>
      transition(r, 'notified', servicePointId: servicePointId);

  /// Move into actual service. If reservation has workflowName set, the
  /// caller is responsible for firing the workflow separately via
  /// /workflow/fire — this just flips the reservation row.
  Future<bool> startService(OpsReservation r, {String? servicePointId}) =>
      transition(r, 'in_progress', servicePointId: servicePointId);

  Future<bool> complete(OpsReservation r) => transition(r, 'completed');
  Future<bool> cancel(OpsReservation r) => transition(r, 'cancelled');

  /// The booked party never came: the check-in route records the no-show and
  /// gives back the table held for them.
  Future<bool> noShow(OpsReservation r) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await checkinService.noShow(r.sk);
      await Future.wait([loadReservations(), loadServicePoints()]);
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Hold a free table for a booked party through its grace period.
  Future<bool> holdTable(OpsReservation r, ServicePoint sp) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await _svc.setServicePointStatus(sp.sk, 'reserved', reservationId: r.sk);
      await Future.wait([loadReservations(), loadServicePoints()]);
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  // ─── Service Points ───────────────────────────────────────────────────

  Future<void> loadServicePoints() async {
    if (_businessLocationId.isEmpty) {
      _servicePoints = [];
      _loadingServicePoints = false;
      notifyListeners();
      return;
    }
    _loadingServicePoints = true;
    notifyListeners();
    try {
      _servicePoints = await _svc.findServicePoints(
        businessLocationId: _businessLocationId,
      );
    } catch (e) {
      _error = e.toString();
    } finally {
      _loadingServicePoints = false;
      notifyListeners();
    }
  }

  /// Mark a service point with a new status (clear/dirty/blocked/etc).
  /// Uses the dedicated status endpoint so occupant fields (currentTabId,
  /// seatedAt, …) are left to the tab flow — a full-record write here would
  /// erase the table↔tab link. Occupancy is freed by releasing the tab, not
  /// by a status flip.
  Future<bool> setServicePointStatus(ServicePoint sp, String newStatus, {String? reason}) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.setServicePointStatus(sp.sk, newStatus, reason: reason);
      // Re-fetch so we reflect the server's authoritative record (including
      // any occupant fields it kept or the tab flow cleared).
      await loadServicePoints();
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Assign a queue-stage reservation to a service point, in one shot:
  /// flips reservation status to 'notified' AND marks SP occupied with
  /// the reservation's id stamped on it. Customer notification is fired
  /// server-side automatically when the reservation hits 'notified'.
  Future<bool> assignServicePoint(OpsReservation r, ServicePoint sp) async {
    _busy = true;
    notifyListeners();
    try {
      // 1. Update SP first so a parallel viewer sees occupied state.
      final spUpdate = sp.copyWith(
        status: 'occupied',
        currentReservationId: r.sk,
        currentPartySize: r.partySize,
        seatedAt: DateTime.now().toIso8601String(),
      );
      final savedSp = await _svc.updateServicePoint(spUpdate);
      if (savedSp != null) {
        _servicePoints = _servicePoints.map((x) => x.sk == sp.sk ? savedSp : x).toList();
      }
      // 2. Flip the reservation to notified + record SP id.
      final ok = await transition(r, 'notified', servicePointId: sp.sk);
      return ok;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> saveServicePoint(ServicePoint sp) async {
    _busy = true;
    notifyListeners();
    try {
      final saved = sp.sk.isEmpty
          ? await _svc.createServicePoint(sp)
          : await _svc.updateServicePoint(sp);
      if (saved != null) {
        if (sp.sk.isEmpty) {
          _servicePoints = [..._servicePoints, saved];
        } else {
          _servicePoints =
              _servicePoints.map((x) => x.sk == sp.sk ? saved : x).toList();
        }
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> deleteServicePoint(String id) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.deleteServicePoint(id);
      _servicePoints = _servicePoints.where((sp) => sp.sk != id).toList();
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  // ─── Workflow tasks ───────────────────────────────────────────────────

  Future<void> loadWorkflows() async {
    if (_loadingWorkflows) return;
    _loadingWorkflows = true;
    try {
      _error = null;
      final definitions = await _svc.listWorkflows(
        name: kitchenOnly ? 'prep-pipeline' : null,
        throwOnError: kitchenOnly,
      );
      final stations = kitchenOnly ? await _svc.getKitchenStations() : <String>[];
      if (_disposed) return;
      _workflows = definitions;
      kitchenStations = stations;
      if (_workflows.isNotEmpty && _activeWorkflowId.isEmpty) {
        final first = _workflows.first;
        final data = first['data'] is Map ? first['data'] as Map : first;
        final sk = (first['sk'] ?? data['sk'] ?? '').toString();
        if (sk.isNotEmpty) await setActiveWorkflow(sk);
      } else if (_activeWorkflowId.isNotEmpty) {
        // Reopening the board: load its tickets now. It showed the tickets
        // from the last visit until the next 3-second poll.
        await loadTasks();
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _loadingWorkflows = false;
      notifyListeners();
    }
  }

  Future<void> setActiveWorkflow(String workflowId) async {
    _activeWorkflowId = workflowId;
    _tasks = [];
    notifyListeners();
    await loadTasks();
  }

  Future<void> loadTasks() async {
    final request = ++_taskRequest;
    final workflowId = _activeWorkflowId;
    final location = _kitchenLocation;
    if (workflowId.isEmpty || (kitchenOnly && location.isEmpty)) {
      _tasks = [];
      _loadingTasks = false;
      notifyListeners();
      return;
    }
    _loadingTasks = true;
    _error = null;
    notifyListeners();
    try {
      // No status filter → server default = active (new/pending/inprogress/
      // blocked) PLUS anything completed in the last 24h. A cook must see
      // blocked tickets (86'd / waiting on sub-prep) and just-fired ones.
      final next = kitchenOnly
          ? await _svc.listKitchenTasks(workflowId: workflowId, businessLocationId: location)
          : await _svc.listTasks(workflowId: workflowId);
      if (request != _taskRequest || _disposed) return;
      _tasks = next;
      lastTaskRefresh = DateTime.now();
    } catch (e) {
      if (request == _taskRequest) _error = e.toString();
    } finally {
      if (request == _taskRequest) {
        _loadingTasks = false;
        notifyListeners();
      }
    }
  }

  Future<bool> advanceTask(String taskId) async {
    _taskRequest++; // Don't let an older poll undo this action on screen.
    _loadingTasks = false;
    _busy = true;
    notifyListeners();
    try {
      final updated = await _svc.advanceTask(taskId);
      if (updated != null) {
        _tasks = _tasks.map((t) =>
            (t['sk'] ?? '').toString() == taskId ? updated : t).toList();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> completeTask(String taskId) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.completeTask(taskId);
      // Remove from active list since it's terminal.
      _tasks = _tasks.where((t) => (t['sk'] ?? '').toString() != taskId).toList();
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> cancelTask(String taskId) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.cancelTask(taskId);
      _tasks = _tasks.where((t) => (t['sk'] ?? '').toString() != taskId).toList();
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> addTaskNote(String taskId, String note) async {
    try {
      final updated = await _svc.addTaskNote(taskId, note);
      if (updated != null) {
        _tasks = _tasks.map((t) =>
            (t['sk'] ?? '').toString() == taskId ? updated : t).toList();
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    }
  }

  Future<bool> snoozeTask(String taskId, int minutes) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final updated = await _svc.snoozeTask(taskId, minutes);
      if (updated != null) {
        _tasks = _tasks.map((t) =>
            (t['sk'] ?? '').toString() == taskId ? updated : t).toList();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> escalateTaskNow(String taskId) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final updated = await _svc.escalateTaskNow(taskId);
      if (updated != null) {
        _tasks = _tasks.map((t) =>
            (t['sk'] ?? '').toString() == taskId ? updated : t).toList();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> reassignTask(String taskId, List<String> assignTo) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final updated = await _svc.reassignTask(taskId, assignTo);
      if (updated != null) {
        _tasks = _tasks.map((t) =>
            (t['sk'] ?? '').toString() == taskId ? updated : t).toList();
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
