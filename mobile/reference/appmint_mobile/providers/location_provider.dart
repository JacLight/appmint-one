import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/location_service.dart';
import '../services/stripe_terminal_service.dart';

class LocationProvider extends ChangeNotifier {
  final LocationService _svc = locationService;
  // Persisted across app launches — the operator's last-picked location
  // should stick. Resetting to "first one" on every restart drove the
  // host nuts having to re-pick after switching apps.
  static const _kSelectedId = 'location_selected_id';

  List<Map<String, dynamic>> _locations = [];
  String _selectedId = '';
  bool _loading = false;

  List<Map<String, dynamic>> get locations => _locations;
  String get selectedId => _selectedId;
  bool get loading => _loading;

  Map<String, dynamic>? get selectedLocation {
    if (_selectedId.isEmpty) return null;
    for (final l in _locations) {
      if ((l['sk'] ?? '').toString() == _selectedId) return l;
    }
    return null;
  }

  /// The value to pass as `businessLocationId` on every server query.
  /// Backend stores foreign keys to the location's `data.name` slug
  /// (BusinessLocationField target), NOT the record's `sk`. React uses
  /// `selectedLocation?.name` for the same reason — passing the sk
  /// returns zero rows.
  String get businessLocationName {
    final loc = selectedLocation;
    if (loc == null) return '';
    final data = loc['data'];
    if (data is Map &&
        data['name'] is String &&
        (data['name'] as String).isNotEmpty) {
      return data['name'] as String;
    }
    final n = loc['name'];
    if (n is String && n.isNotEmpty) return n;
    return _selectedId;
  }

  LocationProvider() {
    Future.microtask(load);
  }

  Future<void> load() async {
    _loading = true;
    notifyListeners();
    try {
      // Restore the operator's last pick BEFORE fetching the list so the
      // network round-trip can validate it against current locations.
      if (_selectedId.isEmpty) {
        final p = await SharedPreferences.getInstance();
        _selectedId = p.getString(_kSelectedId) ?? '';
      }
      final next = await _svc.getBusinessLocations();
      _locations = next;
      // Drop selection if it no longer exists in the fresh list.
      if (_selectedId.isNotEmpty &&
          !next.any((l) => (l['sk'] ?? '').toString() == _selectedId)) {
        _selectedId = '';
      }
      // Auto-select the first location only when there's no remembered
      // pick — operations pages need a non-empty selection or they refuse
      // to load.
      if (_selectedId.isEmpty && next.isNotEmpty) {
        _selectedId = (next.first['sk'] ?? '').toString();
        await _persist();
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> select(String id) async {
    if (id == _selectedId) return;
    await stripeTerminalService.clearBusinessLocationBinding();
    _selectedId = id;
    await _persist();
    notifyListeners();
  }

  Future<void> _persist() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_kSelectedId, _selectedId);
    } catch (e) {
      if (kDebugMode) debugPrint('LocationProvider._persist failed: $e');
    }
  }
}
