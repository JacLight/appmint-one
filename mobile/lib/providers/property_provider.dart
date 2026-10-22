import 'package:flutter/foundation.dart';

import '../config/sla_policy.dart';
import '../services/property_api.dart';

/// The manager's side: what we own, who is in it, what is empty.
class PropertyProvider extends ChangeNotifier {
  final PropertyApi _api = propertyApi;

  // Showcase
  List<Map<String, dynamic>> _offers = const [];
  bool _offersLoading = false;
  String? _offersError;
  String _keyword = '';

  // Portfolio
  List<Map<String, dynamic>> _buildings = const [];
  List<Map<String, dynamic>> _allUnits = const [];
  Map<String, dynamic> _today = const {};
  bool _loading = false;
  String? _error;

  // One building, opened
  String? _openId;
  Map<String, dynamic> _open = const {};
  List<Map<String, dynamic>> _openUnits = const [];
  List<Map<String, dynamic>> _openTenancies = const [];
  bool _openLoading = false;
  String? _openError;

  List<Map<String, dynamic>> get offers => _offers;
  bool get offersLoading => _offersLoading;
  String? get offersError => _offersError;
  String get keyword => _keyword;

  List<Map<String, dynamic>> get buildings => _buildings;
  List<Map<String, dynamic>> get allUnits => _allUnits;
  Map<String, dynamic> get today => _today;
  bool get loading => _loading;
  String? get error => _error;

  Map<String, dynamic> get open => _open;
  List<Map<String, dynamic>> get openUnits => _openUnits;
  List<Map<String, dynamic>> get openTenancies => _openTenancies;
  bool get openLoading => _openLoading;
  String? get openError => _openError;

  // ── Showcase ────────────────────────────────────────────────────────────

  Future<void> loadOffers({String? keyword}) async {
    if (keyword != null) _keyword = keyword;
    _offersLoading = true;
    _offersError = null;
    notifyListeners();
    try {
      _offers = await _api.browse(keyword: _keyword);
      _offersError = null;
    } catch (e) {
      _offersError = _say(e);
    } finally {
      _offersLoading = false;
      notifyListeners();
    }
  }

  // ── Portfolio ───────────────────────────────────────────────────────────

  Future<void> loadPortfolio() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _buildings = await _api.portfolio();
      _error = null;
    } catch (e) {
      _error = _say(e);
    } finally {
      _loading = false;
      notifyListeners();
    }
    // Units and the day's counters are separate reads: a portfolio that
    // loaded should still draw when one of them fails.
    try {
      _allUnits = await _api.units();
      notifyListeners();
    } catch (_) {}
    try {
      _today = await _api.today();
      notifyListeners();
    } catch (_) {}
  }

  /// Units belonging to one building, from the portfolio-wide read.
  List<Map<String, dynamic>> unitsOf(String listingName) => [
        for (final u in _allUnits)
          if ('${u['listing'] ?? ''}' == listingName) u,
      ];

  /// Occupied / total across everything, for the portfolio header.
  ({int total, int occupied, int vacant, int down}) get rollup {
    var occupied = 0, vacant = 0, down = 0;
    for (final u in _allUnits) {
      switch ('${u['status'] ?? ''}'.toLowerCase()) {
        case 'occupied':
        case 'reserved':
          occupied++;
        case 'maintenance':
        case 'overlocked':
          down++;
        default:
          vacant++;
      }
    }
    return (
      total: _allUnits.length,
      occupied: occupied,
      vacant: vacant,
      down: down
    );
  }

  // ── Leasing: the lease book and the applications ────────────────────────

  List<Map<String, dynamic>> _leases = const [];
  List<Map<String, dynamic>> _applications = const [];
  bool _leasingLoading = false;
  String? _leaseError;
  String? _applicationError;

  List<Map<String, dynamic>> get leases => _leases;
  List<Map<String, dynamic>> get applications => _applications;
  bool get leasingLoading => _leasingLoading;
  String? get leaseError => _leaseError;
  String? get applicationError => _applicationError;

  /// Tenancies ending within 60 days, soonest first — the renewal list.
  List<Map<String, dynamic>> get expiring {
    final now = DateTime.now();
    final rows = <({Map<String, dynamic> row, DateTime end})>[];
    for (final l in _leases) {
      final end = _endOf(l);
      if (end == null) continue;
      final days = end.difference(now).inDays;
      if (days < 0 || days > 60) continue;
      rows.add((row: l, end: end));
    }
    rows.sort((a, b) => a.end.compareTo(b.end));
    return [for (final r in rows) r.row];
  }

  /// Tenancies with money outstanding, most owed first.
  List<Map<String, dynamic>> get arrears {
    final rows = <({Map<String, dynamic> row, double owed})>[];
    for (final l in _leases) {
      final owed = _owedOf(l);
      if (owed <= 0.004) continue;
      rows.add((row: l, owed: owed));
    }
    rows.sort((a, b) => b.owed.compareTo(a.owed));
    return [for (final r in rows) r.row];
  }

  double get totalArrears {
    var sum = 0.0;
    for (final l in _leases) {
      sum += _owedOf(l);
    }
    return sum;
  }

  static DateTime? _endOf(Map<String, dynamic> lease) {
    final items = lease['items'];
    if (items is List) {
      for (final i in items) {
        if (i is Map) {
          final d = DateTime.tryParse('${i['endDate'] ?? ''}');
          if (d != null) return d;
        }
      }
    }
    return DateTime.tryParse('${lease['endDate'] ?? ''}');
  }

  static double _owedOf(Map<String, dynamic> lease) {
    final s = lease['paymentSummary'];
    final raw = (s is Map ? s['balance'] : null) ?? lease['balance'];
    return raw is num ? raw.toDouble() : 0.0;
  }

  /// Approve, decline or screen an application. Returns an error to show, or
  /// null when it went through.
  Future<String?> decide(String id, String decision, {String reason = ''}) async {
    try {
      await _api.decideApplication(id, decision, reason: reason);
      await loadLeasing();
      return null;
    } catch (e) {
      return _say(e);
    }
  }

  Future<void> loadLeasing() async {
    _leasingLoading = true;
    _leaseError = null;
    _applicationError = null;
    notifyListeners();
    try {
      _leases = await _api.allTenancies();
    } catch (e) {
      _leaseError = _say(e);
    }
    try {
      _applications = await _api.hostApplications();
    } catch (e) {
      // Expected until the host-side applications read exists; the screen
      // says so rather than showing an empty list that means "none".
      _applicationError = _say(e);
    }
    _leasingLoading = false;
    notifyListeners();
  }

  // ── Announcements this manager posted ───────────────────────────────────

  List<Map<String, dynamic>> _announcements = const [];
  bool _announcementsLoading = false;
  String? _announcementsError;

  List<Map<String, dynamic>> get announcements => _announcements;
  bool get announcementsLoading => _announcementsLoading;
  String? get announcementsError => _announcementsError;

  Future<void> loadAnnouncements() async {
    _announcementsLoading = true;
    _announcementsError = null;
    notifyListeners();
    try {
      _announcements = await _api.hostAnnouncements();
      _announcementsError = null;
    } catch (e) {
      _announcementsError = _say(e);
    } finally {
      _announcementsLoading = false;
      notifyListeners();
    }
  }

  // ── The request queue ───────────────────────────────────────────────────

  List<Map<String, dynamic>> _requests = const [];
  bool _requestsLoading = false;
  String? _requestsError;

  List<Map<String, dynamic>> get requests => _requests;
  bool get requestsLoading => _requestsLoading;
  String? get requestsError => _requestsError;

  /// Breached first, then nearest due, then no clock, then closed.
  List<Map<String, dynamic>> get requestQueue {
    final rows = [..._requests];
    rows.sort((a, b) {
      final ca = SlaClock.of(a), cb = SlaClock.of(b);
      final byRank = ca.rank.compareTo(cb.rank);
      if (byRank != 0) return byRank;
      final ra = ca.remaining, rb = cb.remaining;
      if (ra == null || rb == null) return 0;
      return ra.compareTo(rb);
    });
    return rows;
  }

  Future<void> loadRequests() async {
    _requestsLoading = true;
    _requestsError = null;
    notifyListeners();
    try {
      _requests = await _api.hostRequests();
      _requestsError = null;
    } catch (e) {
      _requestsError = _say(e);
    } finally {
      _requestsLoading = false;
      notifyListeners();
    }
  }

  // ── One building ────────────────────────────────────────────────────────

  Future<void> openBuilding(String id, {Map<String, dynamic>? known}) async {
    _openId = id;
    _open = known ?? const {};
    _openUnits = const [];
    _openTenancies = const [];
    _openLoading = true;
    _openError = null;
    notifyListeners();
    try {
      _open = await _api.portfolioItem(id);
      _openError = null;
    } catch (e) {
      // A building we were handed from the list is still worth drawing.
      if (_open.isEmpty) _openError = _say(e);
    }
    try {
      _openUnits = await _api.units(listing: '${_open['name'] ?? id}');
    } catch (_) {}
    try {
      _openTenancies = await _api.buildingTenancies(id);
    } catch (_) {}
    _openLoading = false;
    notifyListeners();
  }

  Future<String?> setUnitStatus(String unitId, String status) async {
    try {
      await _api.updateUnit(unitId, {'status': status});
      final id = _openId;
      if (id != null) await openBuilding(id, known: _open);
      await loadPortfolio();
      return null;
    } catch (e) {
      return _say(e);
    }
  }

  String _say(Object e) => e.toString().replaceAll('Exception: ', '');
}
