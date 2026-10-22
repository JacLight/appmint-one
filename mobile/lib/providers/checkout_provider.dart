import 'package:flutter/foundation.dart';
import '../models/checkout.dart';
import '../models/stowbo_host.dart';
import '../services/stowbo_api.dart';

/// Server-driven checkout. The `stowbo_checkout` record on the server is the
/// single source of truth — this provider only mirrors it and re-reads after
/// every mutation, so a purchase started on one device can be resumed on
/// another. The UI renders whatever [state] says (step, quote, hold).
class CheckoutProvider extends ChangeNotifier {
  final StowboApi _api = stowboApi;

  CheckoutState? _state;
  bool _busy = false;
  String? _error;
  String? _conflict; // e.g. hold-in-progress / unavailable

  CheckoutState? get state => _state;
  bool get busy => _busy;
  String? get error => _error;
  String? get conflict => _conflict;
  bool get hasCheckout => _state != null;

  void _set(CheckoutState? s) {
    _state = s;
    notifyListeners();
  }

  /// One cart line from a listing selection, in the server's line shape.
  Map<String, dynamic> lineFor(
    StowboHost host, {
    required DateTime start,
    required DateTime end,
    int quantity = 1,
    List<Map<String, dynamic>>? addOns,
  }) =>
      {
        'listing': host.sk,
        'quantity': quantity,
        'startDate': start.toUtc().toIso8601String(),
        'endDate': end.toUtc().toIso8601String(),
        if (addOns != null && addOns.isNotEmpty) 'addOns': addOns,
      };

  /// Check the server for an unfinished purchase and load it. Called on launch;
  /// null if nothing to resume.
  Future<CheckoutState?> refreshResume() async {
    try {
      final res = await _api.resumeCheckout();
      _set(CheckoutState.fromResume(res));
    } catch (_) {
      // A failed resume never blocks the app — just means "no saved cart shown".
      _set(null);
    }
    return _state;
  }

  /// Save (create/update) the cart on the server and mirror it. Records the
  /// step so resume lands them back here.
  Future<CheckoutState?> saveCart(
    List<Map<String, dynamic>> items, {
    String step = 'cart',
    String? returnTo,
  }) async {
    return _guard(() async {
      final res = await _api.saveCart(
          items: items, step: step, returnTo: returnTo);
      _set(CheckoutState.fromSave(res));
      return _state;
    });
  }

  /// Stamp the step reached (no re-pricing). Cheap; call on each screen entry.
  Future<void> markStep(String step, {Map<String, dynamic>? context}) async {
    final id = _state?.checkoutId;
    if (id == null) return;
    try {
      await _api.saveProgress(id, step: step, context: context);
      _set(_state!.copyWith(step: step));
    } catch (_) {/* progress stamping is best-effort */}
  }

  /// Hold the capacity while they pay. Moves status → held with an expiry.
  Future<CheckoutState?> hold(List<Map<String, dynamic>> items,
      {String? returnTo}) async {
    return _guard(() async {
      final res = await _api.startCheckout(items: items, returnTo: returnTo);
      _set(CheckoutState.fromHold(res));
      return _state;
    });
  }

  /// Pay + confirm. Returns the created booking record on success, or null on
  /// failure (with [error] / [conflict] set). Clears the checkout when booked.
  Future<Map<String, dynamic>?> confirm({
    String? paymentMethodId,
    String? paymentIntentId,
    bool captureNow = true,
  }) async {
    final id = _state?.checkoutId;
    if (id == null) {
      _error = 'No checkout to confirm';
      notifyListeners();
      return null;
    }
    return _guard(() async {
      final booking = await _api.confirmCheckout(id,
          paymentMethodId: paymentMethodId,
          paymentIntentId: paymentIntentId,
          captureNow: captureNow);
      _set(null); // purchase is now a booking; checkout is done
      return booking;
    });
  }

  /// Abandon and release the held capacity.
  Future<void> abandon() async {
    final id = _state?.checkoutId;
    _set(null);
    if (id == null) return;
    try {
      await _api.abandonCheckout(id);
    } catch (_) {/* best-effort release; server also expires it */}
  }

  void clear() {
    _error = null;
    _conflict = null;
    _set(null);
  }

  Future<T?> _guard<T>(Future<T?> Function() body) async {
    _busy = true;
    _error = null;
    _conflict = null;
    notifyListeners();
    try {
      return await body();
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (msg.toLowerCase().contains('hold') ||
          msg.toLowerCase().contains('available')) {
        _conflict = msg;
      } else {
        _error = msg;
      }
      return null;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
