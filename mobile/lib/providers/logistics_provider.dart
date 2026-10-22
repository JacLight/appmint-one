import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/logistics_api.dart';

/// Customer side of the logistics module: quote, order, track.
///
/// The server owns price and stage. Nothing here computes a fare or advances a
/// job locally — a quote is whatever `/logistics/jobs` returned, and a stage is
/// whatever `/logistics/orders/:id/track` says it is.
class LogisticsProvider extends ChangeNotifier {
  final LogisticsApi _api = logisticsApi;

  // ── Quote ───────────────────────────────────────────────────────────────

  QuoteResult? _quote;
  bool _quoting = false;
  String? _quoteError;

  QuoteResult? get quote => _quote;
  bool get quoting => _quoting;
  String? get quoteError => _quoteError;

  /// True when the quote is too old to book against. The server signs a quote
  /// for 15 minutes; past that the customer has to be re-quoted rather than
  /// shown a stale price.
  bool get quoteExpired => _quote?.expired ?? false;

  /// Price a delivery. Returns the message to show, or null on success.
  ///
  /// An out-of-area request comes back as `valid: false` with per-stop
  /// reasons, not an exception, so that case is handled here rather than
  /// surfacing as a generic failure.
  Future<String?> getQuote({
    required List<Map<String, dynamic>> stops,
    String? customerNotes,
  }) async {
    _quoting = true;
    _quoteError = null;
    notifyListeners();
    try {
      final result = await _api.createQuote(stops);
      if (!result.valid) {
        _quote = null;
        _quoteError = result.problem;
        return _quoteError;
      }
      _quote = result;
      return null;
    } catch (e) {
      _quoteError = _clean(e);
      _quote = null;
      return _quoteError;
    } finally {
      _quoting = false;
      notifyListeners();
    }
  }

  void clearQuote() {
    _quote = null;
    _quoteError = null;
    notifyListeners();
  }

  // ── Orders ──────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _orders = const [];
  bool _loadingOrders = false;
  String? _ordersError;

  List<Map<String, dynamic>> get orders => _orders;
  bool get loadingOrders => _loadingOrders;
  String? get ordersError => _ordersError;

  Future<void> loadOrders({bool silent = false}) async {
    if (!silent) {
      _loadingOrders = true;
      _ordersError = null;
      notifyListeners();
    }
    try {
      _orders = await _api.orders();
      _ordersError = null;
    } catch (e) {
      _ordersError = _clean(e);
    } finally {
      _loadingOrders = false;
      notifyListeners();
    }
  }

  /// Book the quoted delivery. The server creates the job and a PaymentIntent
  /// at exactly the quoted amount, so the price cannot move between the quote
  /// and the charge.
  Future<Map<String, dynamic>> placeOrder({
    required List<Map<String, dynamic>> stops,
    String? notes,
    Map<String, dynamic>? scheduling,
  }) async {
    final q = _quote;
    if (q?.quoteId == null) {
      throw Exception('Get a price first.');
    }
    if (q!.expired) {
      throw Exception('That price has expired. Get a new one.');
    }
    final created = await _api.orderFromQuote(
      q.quoteId!,
      stops: stops,
      notes: notes,
      scheduling: scheduling,
    );
    await loadOrders(silent: true);
    return created;
  }

  Future<String?> cancelOrder(String jobId, {String? reason}) async {
    try {
      await _api.cancelOrder(jobId, reason: reason);
      await loadOrders(silent: true);
      return null;
    } catch (e) {
      return _clean(e);
    }
  }

  Future<String?> rate(String jobId, {required int stars, String? comment}) async {
    try {
      await _api.rate(jobId, stars: stars, comment: comment);
      await loadOrders(silent: true);
      return null;
    } catch (e) {
      return _clean(e);
    }
  }

  // ── Tracking ────────────────────────────────────────────────────────────
  //
  // Polled, because appengine has no logistics WebSocket gateway. When one
  // lands this is the only place that changes.

  Timer? _trackPoll;
  String? _trackingJobId;
  Map<String, dynamic>? _tracking;
  String? _trackError;

  Map<String, dynamic>? get tracking => _tracking;
  String? get trackError => _trackError;
  String? get trackingJobId => _trackingJobId;

  void startTracking(String jobId,
      {Duration every = const Duration(seconds: 10)}) {
    if (_trackingJobId == jobId && _trackPoll != null) return;
    stopTracking();
    _trackingJobId = jobId;
    _tracking = null;
    _trackError = null;
    notifyListeners();
    _pollTrack();
    _trackPoll = Timer.periodic(every, (_) => _pollTrack());
  }

  Future<void> _pollTrack() async {
    final id = _trackingJobId;
    if (id == null) return;
    try {
      final next = await _api.track(id);
      // A later poll may land after the screen moved on.
      if (_trackingJobId != id) return;
      _tracking = next;
      _trackError = null;
    } catch (e) {
      if (_trackingJobId != id) return;
      _trackError = _clean(e);
    }
    notifyListeners();
  }

  void stopTracking() {
    _trackPoll?.cancel();
    _trackPoll = null;
    _trackingJobId = null;
  }

  @override
  void dispose() {
    _trackPoll?.cancel();
    super.dispose();
  }

  static String _clean(Object e) =>
      e.toString().replaceAll('Exception: ', '').trim();
}
