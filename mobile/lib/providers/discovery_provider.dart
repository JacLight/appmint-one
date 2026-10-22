import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/search_when.dart';
import '../models/stowbo_host.dart';
import '../services/host_service.dart';
import '../services/location_service.dart';

/// Guest-side browse. Loads listings; supports a kind filter and, when the
/// guest shares their location, ranks spots nearest-first (Uber-style).
class DiscoveryProvider extends ChangeNotifier {
  final HostService _hosts = hostService;

  List<StowboHost> _all = [];
  final Set<String> _kinds = {};
  String _query = '';
  bool _loading = false;
  String? _error;

  double? _userLat;
  double? _userLng;
  LocationFailure? _locFailure;
  bool _locating = false;
  bool _autoLocated = false;

  /// The distance ceiling, in miles. Defaults to 20 — spots further than this
  /// are hidden and the rest are ranked nearest-first. `null` means "any
  /// distance" (the filter is off), so everything shows. Only applies once we
  /// know where the guest is.
  double? _radiusMiles = 20;
  static const double _metresPerMile = 1609.344;

  double? get radiusMiles => _radiusMiles;
  bool get distanceFilterOn => _radiusMiles != null && hasLocation;
  void setRadiusMiles(double? miles) {
    _radiusMiles = miles;
    notifyListeners();
  }

  // The "when" set in search — carried into listing detail + checkout so
  // availability is always checked for the window the guest actually chose.
  SearchWhen _when = SearchWhen.nowToday();
  SearchWhen get when => _when;
  void setWhen(SearchWhen w) {
    _when = w;
    notifyListeners();
  }

  double? get userLat => _userLat; // device GPS
  double? get userLng => _userLng;
  LocationFailure? get locFailure => _locFailure;
  bool get locating => _locating;

  // The CENTER of discovery — what distance and the radius are measured from.
  // Defaults to the device's own location; the guest can move it to any point
  // (search an area) and snap it back with "Use my location".
  double? _centerLat;
  double? _centerLng;
  String? _centerLabel;
  bool _centerIsDevice = true;

  double? get centerLat => _centerLat;
  double? get centerLng => _centerLng;
  bool get hasCenter => _centerLat != null && _centerLng != null;
  bool get centerIsDevice => _centerIsDevice;
  String get centerLabel => _centerLabel ?? (hasCenter ? 'Near me' : 'Anywhere');

  // Retained name — "do we have a point to rank from". It is the center now,
  // which may be the device or a chosen spot.
  bool get hasLocation => hasCenter;

  // Keywords each category chip should match against a listing's free-text
  // spaceType.
  static const Map<String, List<String>> _kindAliases = {
    'Bag check': ['bag'],
    'Luggage': ['luggage', 'bag', 'suitcase'],
    'Parking': ['park', 'lot', 'garage', 'valet', 'bay', 'driveway'],
    'Coat check': ['coat'],
    'Locker': ['locker'],
    'Storage': ['storage', 'store', 'warehouse', 'box', 'unit', 'gear'],
  };

  bool _kindMatches(String chip, String kind) {
    final k = kind.toLowerCase();
    final words = _kindAliases[chip] ?? [chip.toLowerCase()];
    return words.any(k.contains);
  }

  List<StowboHost> get hosts {
    var list = _all;
    if (_kinds.isNotEmpty) {
      // spaceType is free text on the server ("Parking lot", "Street parking",
      // "Warehouse"…), so an exact match against the chip label ("Parking")
      // drops everything. Match by keyword, case-insensitive, with aliases.
      list = list.where((h) => _kinds.any((k) => _kindMatches(k, h.kind))).toList();
    }
    if (_query.trim().isNotEmpty) {
      final q = _query.toLowerCase();
      list = list
          .where((h) =>
              h.name.toLowerCase().contains(q) ||
              h.address.toLowerCase().contains(q) ||
              h.kind.toLowerCase().contains(q))
          .toList();
    }
    // Distance filter: with a center AND a radius, drop anything beyond it — and
    // un-geocoded spots, which cannot be shown to be in range. "Any distance"
    // (radius null) keeps everything.
    if (hasCenter && _radiusMiles != null) {
      final ceiling = _radiusMiles! * _metresPerMile;
      list = list.where((h) {
        final d = _distance(h);
        return d != null && d <= ceiling;
      }).toList();
    }
    // Nearest-first when we have a center (located spots before un-geocoded
    // ones, which sink to the bottom).
    if (hasCenter) {
      list = [...list]..sort((a, b) {
          final da = _distance(a), db = _distance(b);
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return da.compareTo(db);
        });
    }
    return list;
  }

  /// Metres from the center to a listing, or null if either side lacks a fix.
  double? distanceTo(StowboHost h) => _distance(h);
  double? _distance(StowboHost h) {
    if (!hasCenter || h.lat == null || h.lng == null) return null;
    return LocationService.metresBetween(
        _centerLat!, _centerLng!, h.lat!, h.lng!);
  }

  Set<String> get kinds => _kinds;
  bool isKindSelected(String k) => _kinds.contains(k);
  String get query => _query;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    // The FIRST load asks for location so we can default to nearby spots. The
    // list renders as soon as it arrives; the ranking + 20-mile radius apply the
    // moment the fix comes back (locate() notifies), without blocking the list.
    final browseFut = _hosts.browse();
    if (!_autoLocated) {
      _autoLocated = true;
      unawaited(locate());
    }
    try {
      _all = await browseFut;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    _loading = false;
    notifyListeners();
  }

  /// Ask for the device location and, while the center is following the device,
  /// move the center to it. Requests permission; surfaces a typed failure.
  Future<void> locate() async {
    _locating = true;
    _locFailure = null;
    notifyListeners();
    final res = await locationService.current();
    if (res.ok) {
      _userLat = res.lat;
      _userLng = res.lng;
      _locFailure = null;
      if (_centerIsDevice) {
        _centerLat = res.lat;
        _centerLng = res.lng;
        _centerLabel = 'Near me';
      }
    } else {
      _locFailure = res.failure;
    }
    _locating = false;
    notifyListeners();
  }

  /// Move the search center to a chosen point (an address / a map tap). Distance
  /// and the radius are re-measured from here; "Use my location" snaps it back.
  void setCenter(double lat, double lng, String label) {
    _centerLat = lat;
    _centerLng = lng;
    _centerLabel = label;
    _centerIsDevice = false;
    notifyListeners();
  }

  /// Snap the center back to the device and refresh the fix.
  Future<void> useMyLocation() async {
    _centerIsDevice = true;
    await locate();
  }

  /// Toggle a storage type in the multi-select filter (checkbox behaviour).
  void toggleKind(String kind) {
    if (!_kinds.remove(kind)) _kinds.add(kind);
    notifyListeners();
  }

  /// Clear all type filters ("All").
  void clearKinds() {
    if (_kinds.isEmpty) return;
    _kinds.clear();
    notifyListeners();
  }

  void setQuery(String q) {
    _query = q;
    notifyListeners();
  }
}
