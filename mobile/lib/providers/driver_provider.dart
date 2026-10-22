import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../services/location_service.dart';
import '../services/logistics_api.dart';

/// One step the driver can take on a job. Each maps to a server call — the
/// server owns the state machine, so nothing advances locally.
enum DriverAction {
  accept,
  reject,
  startPickup,
  arrivePickup,
  completePickup,
  startDropoff,
  arriveDropoff,
  completeDropoff,
  complete,
  fail,
  cancel,
}

extension DriverActionLabel on DriverAction {
  String get label => switch (this) {
        DriverAction.accept => 'Accept',
        DriverAction.reject => 'Decline',
        DriverAction.startPickup => 'Start pickup',
        DriverAction.arrivePickup => 'Arrived at pickup',
        DriverAction.completePickup => 'Picked up',
        DriverAction.startDropoff => 'Start drop-off',
        DriverAction.arriveDropoff => 'Arrived at drop-off',
        DriverAction.completeDropoff => 'Dropped off',
        DriverAction.complete => 'Complete',
        DriverAction.fail => 'Could not complete',
        DriverAction.cancel => 'Cancel',
      };
}

/// Driver side of the logistics module.
///
/// Going online is gated on a real location fix and the reason for any failure
/// is surfaced verbatim — the app never shows "online" while the server has no
/// position for this driver.
class DriverProvider extends ChangeNotifier {
  final LogisticsApi _api = logisticsApi;

  // ── Online state ────────────────────────────────────────────────────────

  bool _online = false;
  bool _goingOnline = false;

  /// Why the driver could not go online, if that is why they are offline.
  LocationFailure? _locationBlock;
  String? _onlineError;

  bool get online => _online;
  bool get goingOnline => _goingOnline;
  LocationFailure? get locationBlock => _locationBlock;
  String? get onlineError => _onlineError;

  /// The exact sentence to show when going online failed. Null when fine.
  String? get blockReason {
    if (_onlineError != null) return _onlineError;
    final b = _locationBlock;
    if (b == null) return null;
    return LocationService.label(b, purpose: 'to go online');
  }

  StreamSubscription<Position>? _positions;
  Position? _lastReported;
  DateTime? _lastReportAt;

  /// Attempt to go online. Returns null on success, or the reason it failed.
  Future<String?> goOnline() async {
    _goingOnline = true;
    _onlineError = null;
    _locationBlock = null;
    notifyListeners();
    try {
      // One permission-checked fix first: if this fails there is no point
      // opening a stream, and the driver needs the specific reason.
      final fix = await locationService.current();
      if (!fix.ok) {
        _locationBlock = fix.failure;
        _online = false;
        return blockReason;
      }

      // Position first, then availability: dispatch only offers work to an
      // online agent, so this order means the server never has an online
      // driver whose location it does not know.
      await _api.updateLocation(
          lat: fix.position!.latitude, lng: fix.position!.longitude);
      _lastReported = fix.position;
      _lastReportAt = DateTime.now();

      await _api.setAvailability('online');

      _online = true;
      _startReporting();
      await loadFeed(silent: true);
      return null;
    } catch (e) {
      _onlineError = _clean(e);
      _online = false;
      return _onlineError;
    } finally {
      _goingOnline = false;
      notifyListeners();
    }
  }

  Future<String?> goOffline() async {
    await _positions?.cancel();
    _positions = null;
    try {
      await _api.setAvailability('offline');
      _online = false;
      return null;
    } catch (e) {
      // Stop reporting either way, but say so: the server may still consider
      // this driver on duty and keep offering work.
      _online = false;
      _onlineError = _clean(e);
      return _onlineError;
    } finally {
      notifyListeners();
    }
  }

  /// Stream positions and report movement. Throttled so a stationary driver
  /// does not hammer the endpoint, and so a moving one still updates often
  /// enough for the customer's track screen to look live.
  void _startReporting() {
    _positions?.cancel();
    _positions = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25, // metres
      ),
    ).listen((p) async {
      final now = DateTime.now();
      final since = _lastReportAt == null
          ? const Duration(hours: 1)
          : now.difference(_lastReportAt!);
      final moved = _lastReported == null
          ? double.infinity
          : LocationService.metresBetween(_lastReported!.latitude,
              _lastReported!.longitude, p.latitude, p.longitude);

      if (moved < 25 && since < const Duration(seconds: 20)) return;

      try {
        await _api.updateLocation(
          lat: p.latitude,
          lng: p.longitude,
          heading: p.heading,
          speed: p.speed,
        );
        _lastReported = p;
        _lastReportAt = now;
      } catch (_) {
        // A dropped position report is not worth interrupting the driver over;
        // the next one carries the newer position anyway.
      }
    }, onError: (Object e) {
      _onlineError = _clean(e);
      notifyListeners();
    });
  }

  // ── Job feed ────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _feed = const [];
  bool _loadingFeed = false;
  String? _feedError;

  List<Map<String, dynamic>> get feed => _feed;
  bool get loadingFeed => _loadingFeed;
  String? get feedError => _feedError;

  Future<void> loadFeed({bool silent = false}) async {
    if (!silent) {
      _loadingFeed = true;
      _feedError = null;
      notifyListeners();
    }
    try {
      _feed = await _api.availableJobs();
      _feedError = null;
    } catch (e) {
      _feedError = _clean(e);
    } finally {
      _loadingFeed = false;
      notifyListeners();
    }
  }

  // ── My jobs ─────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _mine = const [];
  bool get hasActive => active != null;
  List<Map<String, dynamic>> get mine => _mine;

  /// The job in flight, if any. A driver runs one at a time in this flow.
  Map<String, dynamic>? get active {
    for (final j in _mine) {
      final s = '${j['status'] ?? ''}'.toLowerCase();
      if (s.isEmpty) continue;
      if (s.contains('complete') || s.contains('cancel') || s.contains('fail')) {
        continue;
      }
      return j;
    }
    return null;
  }

  Future<void> loadMine({bool silent = false}) async {
    if (!silent) notifyListeners();
    try {
      _mine = await _api.myJobs();
    } catch (e) {
      _feedError = _clean(e);
    }
    notifyListeners();
  }

  // ── Acting on a job ─────────────────────────────────────────────────────

  String? _acting;
  String? get acting => _acting;

  /// Which step comes next for a job in its current state.
  ///
  /// Statuses are the server's own, from
  /// `appengine/src/logistics/delivery.service.ts`: pending, assigned,
  /// accepted, arrived_pickup, picked_up, arrived_dropoff, delivered, and the
  /// terminal completed / cancelled / failed / rejected.
  static List<DriverAction> nextActions(Map<String, dynamic> job) {
    final s = '${job['status'] ?? ''}'.toLowerCase().trim();
    return switch (s) {
      'pending' => [DriverAction.accept, DriverAction.reject],
      'assigned' || 'accepted' => [
          DriverAction.startPickup,
          DriverAction.cancel,
        ],
      'arrived_pickup' => [DriverAction.completePickup, DriverAction.fail],
      'picked_up' => [DriverAction.arriveDropoff, DriverAction.fail],
      'arrived_dropoff' => [DriverAction.completeDropoff, DriverAction.fail],
      'delivered' => [DriverAction.complete],
      'completed' || 'cancelled' || 'failed' || 'rejected' => const [],
      _ => [DriverAction.arrivePickup, DriverAction.fail],
    };
  }

  /// True when the job is finished and no step remains.
  static bool isTerminal(Map<String, dynamic> job) =>
      nextActions(job).isEmpty;

  /// Run one step. Returns null on success or the server's message on failure.
  Future<String?> act(String jobId, DriverAction action,
      {String? reason, Map<String, dynamic>? body}) async {
    _acting = jobId;
    notifyListeners();
    try {
      switch (action) {
        case DriverAction.accept:
          await _api.accept(jobId);
        case DriverAction.reject:
          await _api.reject(jobId, reason: reason);
        case DriverAction.startPickup:
          await _api.startPickup(jobId);
        case DriverAction.arrivePickup:
          await _api.arrivePickup(jobId);
        case DriverAction.completePickup:
          await _api.completePickup(jobId, body: body);
        case DriverAction.startDropoff:
          await _api.startDropoff(jobId);
        case DriverAction.arriveDropoff:
          await _api.arriveDropoff(jobId);
        case DriverAction.completeDropoff:
          await _api.completeDropoff(jobId, body: body);
        case DriverAction.complete:
          await _api.complete(jobId);
        case DriverAction.fail:
          await _api.fail(jobId, reason: reason);
        case DriverAction.cancel:
          await _api.cancelJob(jobId, reason: reason);
      }
      await loadMine(silent: true);
      await loadFeed(silent: true);
      return null;
    } catch (e) {
      return _clean(e);
    } finally {
      _acting = null;
      notifyListeners();
    }
  }

  // ── Earnings ────────────────────────────────────────────────────────────
  //
  // This driver's money comes from /logistics/payouts. (/logistics/stats is
  // org-level dispatch counts — active, pending and completed jobs, online
  // agents — which belongs to a dispatcher, not a driver.)

  List<Map<String, dynamic>> _payouts = const [];
  bool _loadingPayouts = false;
  String? _payoutsError;

  List<Map<String, dynamic>> get payouts => _payouts;
  bool get loadingPayouts => _loadingPayouts;
  String? get payoutsError => _payoutsError;

  /// Sum of payout amounts the server returned, or null when none carry one.
  num? get paidTotal {
    num sum = 0;
    var found = false;
    for (final p in _payouts) {
      final v = p['amount'] ?? p['total'] ?? p['net'];
      final n = v is num ? v : num.tryParse('$v');
      if (n != null) {
        sum += n;
        found = true;
      }
    }
    return found ? sum : null;
  }

  Future<void> loadPayouts() async {
    _loadingPayouts = true;
    _payoutsError = null;
    notifyListeners();
    try {
      _payouts = await _api.payouts();
      _payoutsError = null;
    } catch (e) {
      _payoutsError = _clean(e);
    } finally {
      _loadingPayouts = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _positions?.cancel();
    super.dispose();
  }

  static String _clean(Object e) =>
      e.toString().replaceAll('Exception: ', '').trim();
}
