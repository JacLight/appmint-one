import 'package:flutter/foundation.dart';

import '../services/lms_api.dart';

/// Courses: what there is, what I am on, and where I am in it.
class LearningProvider extends ChangeNotifier {
  final LmsApi _api = lmsApi;

  List<Map<String, dynamic>> _catalog = const [];
  List<Map<String, dynamic>> _mine = const [];
  bool _loading = false;
  String? _catalogError;
  String? _mineError;
  String _keyword = '';

  List<Map<String, dynamic>> get catalog => _catalog;
  List<Map<String, dynamic>> get mine => _mine;
  bool get loading => _loading;
  String? get catalogError => _catalogError;
  String? get mineError => _mineError;
  String get keyword => _keyword;

  /// Started but not finished — the "pick up where you left off" row.
  List<Map<String, dynamic>> get inProgress {
    final rows = [
      for (final c in _mine)
        if (percentOf(c) > 0 && percentOf(c) < 100) c,
    ];
    rows.sort((a, b) => percentOf(b).compareTo(percentOf(a)));
    return rows;
  }

  List<Map<String, dynamic>> get finished => [
        for (final c in _mine)
          if (percentOf(c) >= 100) c,
      ];

  /// How far through a course this person is. The server owns completion;
  /// this only reads what it reported.
  static int percentOf(Map<String, dynamic> row) {
    final e = row['enrollment'];
    final raw = (e is Map ? e['percent'] : null) ?? row['percent'];
    if (raw is num) return raw.round().clamp(0, 100);
    return 0;
  }

  static Map<String, dynamic> courseOf(Map<String, dynamic> row) {
    final c = row['course'];
    return c is Map ? Map<String, dynamic>.from(c) : row;
  }

  static String idOf(Map<String, dynamic> row) {
    final c = courseOf(row);
    return '${c['id'] ?? c['slug'] ?? c['sk'] ?? row['id'] ?? ''}';
  }

  Future<void> load({String? keyword}) async {
    if (keyword != null) _keyword = keyword;
    _loading = true;
    notifyListeners();

    // Two reads, kept apart: a catalogue outage must not hide the courses
    // somebody is already paying attention to, and the other way round.
    try {
      _catalog = await _api.catalog(keyword: _keyword.isEmpty ? null : _keyword);
      _catalogError = null;
    } catch (e) {
      _catalogError = _say(e);
    }
    try {
      _mine = await _api.myCourses();
      _mineError = null;
    } catch (e) {
      _mineError = _say(e);
    }

    _loading = false;
    notifyListeners();
  }

  /// Everything in the catalogue this person is not already on.
  List<Map<String, dynamic>> get browsable {
    final enrolled = {for (final m in _mine) idOf(m)};
    return [
      for (final c in _catalog)
        if (c['enrolled'] != true && !enrolled.contains('${c['id'] ?? ''}')) c,
    ];
  }

  Future<String?> enroll(String course) async {
    try {
      await _api.enroll(course);
      await load();
      return null;
    } catch (e) {
      return _say(e);
    }
  }

  String _say(Object e) => e.toString().replaceAll('Exception: ', '');
}
