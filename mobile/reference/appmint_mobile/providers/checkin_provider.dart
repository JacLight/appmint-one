import 'package:flutter/foundation.dart';
import '../services/checkin_service.dart';

/// State for the Check-in screen — live queue, upcoming reservations,
/// available service points, plus the host actions (walk-in, assign, notify,
/// leave, no-show).
///
/// Location-scoped: refuses to load when `businessLocationId` is empty so
/// the host never sees cross-location queue rows.
class CheckinProvider extends ChangeNotifier {
  final CheckinService _svc = checkinService;

  String _businessLocationId = '';
  bool _hasLoadedOnce = false;

  List<Map<String, dynamic>> _queue = const [];
  List<Map<String, dynamic>> _upcoming = const [];
  List<Map<String, dynamic>> _availableSpots = const [];
  List<Map<String, dynamic>> _allSpots = const [];
  List<Map<String, dynamic>> _history = const [];
  List<Map<String, dynamic>> _today = const [];
  Map<String, dynamic> _summary = const {};

  bool _loadingQueue = false;
  bool _loadingUpcoming = false;
  bool _busy = false;
  String? _error;

  // ─── Getters ─────────────────────────────────────────────────────────

  String get businessLocationId => _businessLocationId;
  List<Map<String, dynamic>> get queue => _queue;
  List<Map<String, dynamic>> get upcoming => _upcoming;
  List<Map<String, dynamic>> get availableSpots => _availableSpots;
  /// Every service point at this location regardless of status — drives the
  /// Spots panel where the host can see who's seated where, what's dirty,
  /// what's blocked, and tap available ones to assign.
  List<Map<String, dynamic>> get allSpots => _allSpots;
  /// Past queue tasks (last 24h) — assigned, completed, no-show, left.
  List<Map<String, dynamic>> get history => _history;
  /// All reservations for today's calendar day, any status.
  List<Map<String, dynamic>> get today => _today;
  Map<String, dynamic> get summary => _summary;
  bool get loadingQueue => _loadingQueue;
  bool get loadingUpcoming => _loadingUpcoming;
  bool get busy => _busy;
  String? get error => _error;
  int get queueCount => _queue.length;

  // ─── Scope ───────────────────────────────────────────────────────────

  Future<void> setBusinessLocation(String id) async {
    final changed = id != _businessLocationId;
    if (!changed && _hasLoadedOnce) return;
    _businessLocationId = id;
    if (changed) {
      _queue = const [];
      _upcoming = const [];
      _availableSpots = const [];
      _summary = const {};
      notifyListeners();
    }
    _hasLoadedOnce = true;
    await refresh();
  }

  Future<void> refresh() async {
    await Future.wait([
      loadQueue(),
      loadUpcoming(),
      loadAvailableSpots(),
      loadAllSpots(),
      loadHistory(),
      loadToday(),
      loadSummary(),
    ]);
  }

  Future<void> loadAllSpots() async {
    if (_businessLocationId.isEmpty) {
      _allSpots = const [];
      notifyListeners();
      return;
    }
    try {
      _allSpots = await _svc.listAllServicePoints(businessLocationId: _businessLocationId);
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('loadAllSpots failed: $e');
    }
  }

  Future<void> loadHistory() async {
    if (_businessLocationId.isEmpty) {
      _history = const [];
      notifyListeners();
      return;
    }
    try {
      _history = await _svc.queueHistory(businessLocationId: _businessLocationId);
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('loadHistory failed: $e');
    }
  }

  Future<void> loadToday() async {
    if (_businessLocationId.isEmpty) {
      _today = const [];
      notifyListeners();
      return;
    }
    try {
      _today = await _svc.reservationsToday(businessLocationId: _businessLocationId);
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('loadToday failed: $e');
    }
  }

  // ─── Loaders ─────────────────────────────────────────────────────────

  Future<void> loadQueue() async {
    if (_businessLocationId.isEmpty) {
      _queue = const [];
      _error = 'Pick a location to load the queue';
      _loadingQueue = false;
      notifyListeners();
      return;
    }
    _loadingQueue = true;
    _error = null;
    notifyListeners();
    try {
      _queue = await _svc.listQueue(businessLocationId: _businessLocationId);
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _loadingQueue = false;
      notifyListeners();
    }
  }

  Future<void> loadUpcoming() async {
    if (_businessLocationId.isEmpty) {
      _upcoming = const [];
      notifyListeners();
      return;
    }
    _loadingUpcoming = true;
    notifyListeners();
    try {
      _upcoming = await _svc.upcoming(businessLocationId: _businessLocationId);
    } catch (e) {
      if (kDebugMode) debugPrint('loadUpcoming failed: $e');
    } finally {
      _loadingUpcoming = false;
      notifyListeners();
    }
  }

  Future<void> loadAvailableSpots() async {
    if (_businessLocationId.isEmpty) {
      _availableSpots = const [];
      notifyListeners();
      return;
    }
    try {
      _availableSpots =
          await _svc.availableServicePoints(businessLocationId: _businessLocationId);
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('loadAvailableSpots failed: $e');
    }
  }

  Future<void> loadSummary() async {
    if (_businessLocationId.isEmpty) {
      _summary = const {};
      notifyListeners();
      return;
    }
    try {
      _summary = await _svc.queueSummary(businessLocationId: _businessLocationId);
      notifyListeners();
    } catch (e) {
      if (kDebugMode) debugPrint('loadSummary failed: $e');
    }
  }

  // ─── Host actions ────────────────────────────────────────────────────

  Future<bool> walkIn({
    String customerName = '',
    String? phone,
    String? email,
    int partySize = 1,
    String? notes,
    String? preferredServicePointKind,
    int? quotedWaitMinutes,
  }) async {
    if (_businessLocationId.isEmpty) {
      _error = 'Pick a location first';
      notifyListeners();
      return false;
    }
    // Server needs at least one of name / phone / email.
    if (customerName.trim().isEmpty && (phone ?? '').isEmpty && (email ?? '').isEmpty) {
      _error = 'Add a name, phone, or email';
      notifyListeners();
      return false;
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await _svc.walkIn({
        'businessLocationId': _businessLocationId,
        'customer': {
          if (customerName.trim().isNotEmpty) 'name': customerName.trim(),
          if ((phone ?? '').isNotEmpty) 'phone': phone,
          if ((email ?? '').isNotEmpty) 'email': email,
        },
        'partySize': partySize,
        if ((notes ?? '').isNotEmpty) 'notes': notes,
        if ((preferredServicePointKind ?? '').isNotEmpty)
          'preferredServicePointKind': preferredServicePointKind,
        if (quotedWaitMinutes != null) 'quotedWaitMinutes': quotedWaitMinutes,
      });
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> assign(String taskId, String servicePointId) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await _svc.assign(taskId, servicePointId);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> leave(String taskId, {String? reason}) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.leave(taskId, reason: reason);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> noShow(String taskId) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.noShow(taskId);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> notify(String taskId) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.notify(taskId);
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Clear / bus a service point — moves it back toward available.
  /// finalStatus defaults to 'dirty' on the server (table needs cleaning);
  /// pass 'available' to skip the dirty step.
  Future<bool> clearServicePoint(String spId, {String? finalStatus}) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.clearServicePoint(spId, finalStatus: finalStatus);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> checkInFromReservation(String reservationId) async {
    _busy = true;
    notifyListeners();
    try {
      await _svc.fromReservation(reservationId);
      await refresh();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
