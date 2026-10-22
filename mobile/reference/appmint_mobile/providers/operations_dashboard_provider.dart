import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/operations_service.dart';

/// Manager-facing operations dashboard state. Kept SEPARATE from
/// OperationsProvider so the 30s auto-refresh polling here doesn't
/// trigger rebuilds across queue/service-point/workflow-task screens.
class OperationsDashboardProvider extends ChangeNotifier {
  final OperationsService _svc = operationsService;

  List<Map<String, dynamic>> _workflows = [];
  List<Map<String, dynamic>> get workflows => _workflows;

  // '' means all workflows — wait-stats endpoint requires a workflow,
  // so when empty we only fetch breached + upcoming (cross-workflow).
  String _selectedWorkflowId = '';
  String get selectedWorkflowId => _selectedWorkflowId;

  Map<String, dynamic>? _waitStats;
  Map<String, dynamic>? get waitStats => _waitStats;

  List<Map<String, dynamic>> _breached = [];
  List<Map<String, dynamic>> get breached => _breached;

  List<Map<String, dynamic>> _upcoming = [];
  List<Map<String, dynamic>> get upcoming => _upcoming;

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  Timer? _refreshTimer;

  Future<void> loadWorkflows() async {
    try {
      _workflows = await _svc.listWorkflows();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> setWorkflow(String id) async {
    if (id == _selectedWorkflowId) return;
    _selectedWorkflowId = id;
    _waitStats = null;
    notifyListeners();
    await refresh();
  }

  Future<void> refresh() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      if (_selectedWorkflowId.isNotEmpty) {
        final results = await Future.wait([
          _svc.getWaitStats(_selectedWorkflowId),
          _svc.getBreachedTasks(workflowId: _selectedWorkflowId),
          _svc.getUpcomingBreaches(workflowId: _selectedWorkflowId),
        ]);
        _waitStats = results[0] as Map<String, dynamic>?;
        _breached = results[1] as List<Map<String, dynamic>>;
        _upcoming = results[2] as List<Map<String, dynamic>>;
      } else {
        _waitStats = null;
        final results = await Future.wait([
          _svc.getBreachedTasks(),
          _svc.getUpcomingBreaches(),
        ]);
        _breached = results[0];
        _upcoming = results[1];
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void startAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => refresh());
  }

  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}
