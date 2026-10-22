import 'package:flutter/foundation.dart';
import '../models/custody.dart';
import '../models/stowbo_host.dart';
import '../services/custody_service.dart';
import '../services/host_service.dart';
import '../services/payment_service.dart';
import '../services/stripe_service.dart';

/// Shared custody state for both roles, backed by the real Stowbo engine.
class CustodyProvider extends ChangeNotifier {
  final CustodyService _svc = custodyService;
  final HostService _hosts = hostService;

  List<Custody> _items = [];
  List<StowboHost> _hostListings = [];
  bool _loading = false;
  String? _error;
  String? _lastGuestId;

  List<Custody> get items => _items;
  List<Custody> get active => _items.where((c) => c.isActive).toList();
  List<Custody> get stored =>
      _items.where((c) => c.status == CustodyStatus.stored).toList();
  List<StowboHost> get hostListings => _hostListings;
  bool get loading => _loading;
  String? get error => _error;

  // Host earnings
  Map<String, dynamic>? _earnings;
  Map<String, dynamic>? get earnings => _earnings;
  double get settledTotal => (_earnings?['settled'] as num?)?.toDouble() ?? 0;
  double get pendingTotal => (_earnings?['pending'] as num?)?.toDouble() ?? 0;

  Future<void> loadEarnings() async {
    try {
      _earnings = await _hosts.earnings();
      notifyListeners();
    } catch (_) {}
  }

  // Host units per listing
  List<Map<String, dynamic>> _units = [];
  List<Map<String, dynamic>> get units => _units;

  Future<void> loadUnits(String listingId) async {
    await _guard(() async {
      _units = await _hosts.units(listing: listingId);
    });
  }

  Future<bool> createUnit(
      {required String listing,
      required String unitNumber,
      String? accessCode}) async {
    try {
      await _hosts.createUnit(
          listing: listing, unitNumber: unitNumber, accessCode: accessCode);
      _units = await _hosts.units(listing: listing);
      notifyListeners();
      return true;
    } catch (e) {
      _setError(e);
      return false;
    }
  }

  Future<void> loadForGuest(String guestUserId) async {
    _lastGuestId = guestUserId;
    await _guard(() async {
      _items = await _svc.forGuest(guestUserId);
    });
  }

  bool _hostEnsured = false;

  /// Self-serve host enrolment — grants the `stowbo-host` benefit so listing
  /// works. Idempotent; the server no-ops if already enrolled.
  Future<void> ensureHostEnrolled() async {
    if (_hostEnsured) return;
    _hostEnsured = true;
    try {
      await _hosts.applyAsHost();
    } catch (_) {/* already a host, or approval pending — ignore */}
  }

  Future<void> loadForHost(String ownerUserId) async {
    await _guard(() async {
      await ensureHostEnrolled();
      _hostListings = await _hosts.myListings(ownerUserId);
      _items = await _svc.forHost(const []);
    });
  }

  // A customer never books directly — pending purchases live in the cart
  // (CheckoutProvider) and become a booking only on confirm, so a booking row
  // always means a real, paid booking and progress survives a device change.

  // Drop-off / hand-back moved to item movements + check-out at the Counter.

  /// Host cash settle (engine capture).
  Future<double?> settle(Custody c, {String method = 'cash'}) async {
    try {
      final amount = await _svc.settle(c, method: method);
      await _reloadHost();
      return amount;
    } catch (e) {
      _setError(e);
      return null;
    }
  }

  /// Guest-side card payment: create a PaymentIntent, present the Stripe sheet,
  /// then settle the booking through the engine. Returns amount, or null on
  /// cancel/failure.
  Future<double?> payWithCard(Custody c, {String? email}) async {
    final amount = c.estimatedCharge();
    try {
      final intent = await paymentService.createPaymentIntent(
          amount: amount, referenceId: c.sk, email: email);
      final clientSecret =
          (intent['clientSecret'] ?? intent['client_secret'] ?? '').toString();
      if (clientSecret.isEmpty) throw Exception('Payment setup failed');
      final pk = (intent['publishableKey'] ?? '').toString();
      if (pk.isNotEmpty) StripeService.setPublishableKey(pk);
      await StripeService.presentPaymentSheet(clientSecret: clientSecret);
      final charged = await _svc.settle(c, method: 'stripe');
      if (_lastGuestId != null) await loadForGuest(_lastGuestId!);
      return charged ?? amount;
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('Canceled') || msg.contains('canceled')) return null;
      _setError(e);
      return null;
    }
  }

  Future<bool> cancel(String bookingId) async {
    try {
      await _svc.cancel(bookingId);
      if (_lastGuestId != null) await loadForGuest(_lastGuestId!);
      return true;
    } catch (e) {
      _setError(e);
      return false;
    }
  }

  /// Free capacity + server price quote for a listing + window (booking flow).
  Future<Map<String, dynamic>> checkAvailability(
          StowboHost host, DateTime start, DateTime end, int quantity,
          {List<Map<String, dynamic>>? addOns}) =>
      _hosts.availability(host.sk,
          start: start, end: end, quantity: quantity, addOns: addOns);

  Future<StowboHost?> createListing(StowboHost host) async {
    try {
      final h = await _hosts.createListing(host);
      _hostListings = [h, ..._hostListings];
      notifyListeners();
      return h;
    } catch (e) {
      _setError(e);
      return null;
    }
  }

  Future<void> _reloadHost() async {
    _items = await _svc.forHost(const []);
    notifyListeners();
  }

  void _setError(Object e) {
    _error = e.toString().replaceFirst('Exception: ', '');
    notifyListeners();
  }

  Future<void> _guard(Future<void> Function() op) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await op();
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    _loading = false;
    notifyListeners();
  }
}
