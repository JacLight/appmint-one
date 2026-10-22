import 'package:flutter/foundation.dart';

import '../services/scheduling_api.dart';

/// Scheduling state for both sides: the customer's bookings, and the
/// provider's day.
class SchedulingProvider extends ChangeNotifier {
  final SchedulingApi _api = schedulingApi;

  // ── Customer ────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _bookings = const [];
  bool _loadingBookings = false;
  String? _bookingsError;

  List<Map<String, dynamic>> get bookings => _bookings;
  bool get loadingBookings => _loadingBookings;
  String? get bookingsError => _bookingsError;

  Future<void> loadBookings({bool silent = false}) async {
    if (!silent) {
      _loadingBookings = true;
      _bookingsError = null;
      notifyListeners();
    }
    try {
      _bookings = await _api.myBookings();
      _bookingsError = null;
    } catch (e) {
      _bookingsError = _clean(e);
    } finally {
      _loadingBookings = false;
      notifyListeners();
    }
  }

  Future<String?> cancel(String id) async {
    try {
      await _api.cancel(id);
      await loadBookings(silent: true);
      return null;
    } catch (e) {
      return _clean(e);
    }
  }

  // ── Slots ───────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _slots = const [];
  bool _loadingSlots = false;
  String? _slotsError;

  List<Map<String, dynamic>> get slots => _slots;
  bool get loadingSlots => _loadingSlots;
  String? get slotsError => _slotsError;

  Future<void> loadSlots({
    required String definitionId,
    required DateTime day,
  }) async {
    _loadingSlots = true;
    _slotsError = null;
    _slots = const [];
    notifyListeners();
    try {
      _slots = await _api.availableSlots(
          reservationDefinitionId: definitionId, day: day);
      _slotsError = null;
    } catch (e) {
      _slotsError = _clean(e);
    } finally {
      _loadingSlots = false;
      notifyListeners();
    }
  }

  // ── Provider's day ──────────────────────────────────────────────────────

  List<Map<String, dynamic>> _today = const [];
  List<Map<String, dynamic>> _queue = const [];
  bool _loadingDay = false;
  String? _dayError;
  String? _acting;

  List<Map<String, dynamic>> get today => _today;
  List<Map<String, dynamic>> get queue => _queue;
  bool get loadingDay => _loadingDay;
  String? get dayError => _dayError;
  String? get acting => _acting;

  Future<void> loadDay({bool silent = false}) async {
    if (!silent) {
      _loadingDay = true;
      _dayError = null;
      notifyListeners();
    }
    try {
      _today = await _api.today();
      _queue = await _api.queue();
      _dayError = null;
    } catch (e) {
      _dayError = _clean(e);
    } finally {
      _loadingDay = false;
      notifyListeners();
    }
  }

  Future<String?> checkIn(String reservationId) =>
      _run(reservationId, () => _api.checkIn(reservationId));

  Future<String?> noShow(String taskId) =>
      _run(taskId, () => _api.noShow(taskId));

  Future<String?> assign(String taskId, {String? servicePointId}) =>
      _run(taskId, () => _api.assign(taskId, servicePointId: servicePointId));

  Future<String?> _run(String id, Future<void> Function() op) async {
    _acting = id;
    notifyListeners();
    try {
      await op();
      await loadDay(silent: true);
      return null;
    } catch (e) {
      return _clean(e);
    } finally {
      _acting = null;
      notifyListeners();
    }
  }

  static String _clean(Object e) =>
      e.toString().replaceAll('Exception: ', '').trim();
}
