import 'dart:async';
import 'dart:collection';

/// Serialize admission changes without losing a different ticket while a
/// request is in flight. Repeated camera frames extend a short quiet period.
class EventScanQueue {
  EventScanQueue({DateTime Function()? now}) : _now = now ?? DateTime.now;
  final DateTime Function() _now;
  final _jobs =
      Queue<
        ({String key, Future<void> Function() work, Completer<void> done})
      >();
  final _pending = <String>{};
  final _lastSeen = <String, DateTime>{};
  bool _running = false;
  bool _disposed = false;

  Future<void> submit(
    String key,
    Future<void> Function() work, {
    bool explicitAction = false,
  }) {
    if (_disposed) return Future.value();
    final now = _now();
    final previous = _lastSeen[key];
    _lastSeen.removeWhere(
      (_, seen) => now.difference(seen) > const Duration(seconds: 2),
    );
    _lastSeen[key] = now;
    if (_pending.contains(key) ||
        (!explicitAction &&
            previous != null &&
            now.difference(previous) < const Duration(milliseconds: 1500))) {
      return Future.value();
    }
    final done = Completer<void>();
    _pending.add(key);
    _jobs.add((key: key, work: work, done: done));
    if (!_running) unawaited(_drain());
    return done.future;
  }

  Future<void> _drain() async {
    _running = true;
    while (_jobs.isNotEmpty && !_disposed) {
      final job = _jobs.removeFirst();
      try {
        await job.work();
        job.done.complete();
      } catch (error, stack) {
        job.done.completeError(error, stack);
      } finally {
        _pending.remove(job.key);
      }
    }
    _running = false;
  }

  void dispose() {
    _disposed = true;
    for (final job in _jobs) {
      _pending.remove(job.key);
      job.done.complete();
    }
    _jobs.clear();
    _lastSeen.clear();
  }
}
