import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/booking_detail.dart';
import '../services/stowbo_api.dart';
import '../services/community_service.dart';
import '../services/community_chat_service.dart';
import '../services/payment_service.dart';
import '../services/stripe_service.dart';

/// Loads and mutates ONE booking's full detail. Fans out the four guest calls
/// (booking + host + my-items + listing) in parallel, then exposes the guest
/// actions the server actually allows: cancel, extend, and — since the raw
/// movement endpoint is the host's — a structured retrieval REQUEST sent over
/// chat (with a booking context), which is what the valet/manned case needs.
class BookingDetailProvider extends ChangeNotifier {
  final StowboApi _api = StowboApi();
  final CommunityService _community = CommunityService();

  BookingDetail? _detail;
  List<Map<String, dynamic>> _addOns = const []; // extra services on the listing
  bool _loading = false;
  bool _busy = false; // an action is in flight
  String? _error;
  Timer? _poll; // fallback live-refresh while a request is open
  StreamSubscription<Map<String, dynamic>>? _socketSub;
  String? _bookingId;

  BookingDetail? get detail => _detail;
  List<Map<String, dynamic>> get addOns => _addOns;
  bool get loading => _loading;
  bool get busy => _busy;
  String? get error => _error;

  @override
  void dispose() {
    _poll?.cancel();
    _socketSub?.cancel();
    super.dispose();
  }

  /// Subscribe to real-time booking events so the monitor moves the instant the
  /// host acts — the 12s poll is only a fallback if the socket is down.
  void _listenLive() {
    if (_socketSub != null) return;
    communityChatService.ensureConnected();
    _socketSub = communityChatService.onStowbo.listen((evt) {
      final id = _bookingId;
      final evtBooking = (evt['booking'] ?? evt['bookingId'] ?? '').toString();
      if (id != null && evtBooking == id) load(id);
    });
  }

  /// Poll every 12s while a retrieval request is open, so the guest watches it
  /// move requested → preparing → ready without leaving the screen. Stops itself
  /// the moment the request resolves.
  void _syncPolling() {
    final open = _detail?.activeRequest != null;
    if (open && _poll == null) {
      _poll = Timer.periodic(const Duration(seconds: 12), (_) {
        final d = _detail;
        if (d == null || d.activeRequest == null) {
          _poll?.cancel();
          _poll = null;
          return;
        }
        load(d.bookingId);
      });
    } else if (!open && _poll != null) {
      _poll!.cancel();
      _poll = null;
    }
  }

  Future<void> load(String bookingId) async {
    _bookingId = bookingId;
    _listenLive();
    _loading = _detail == null; // silent refresh once we have data
    _error = null;
    notifyListeners();
    try {
      final rec = await _api.myBooking(bookingId);
      if (rec.isEmpty) {
        _error = 'Booking not found';
        _loading = false;
        notifyListeners();
        return;
      }
      var detail = BookingDetail.fromRecord(rec);

      // Fan out the three enrichment calls; none should block the others, and a
      // failure in one (e.g. host card null) must not sink the whole screen.
      final results = await Future.wait([
        _api.bookingHost(bookingId).catchError((_) => <String, dynamic>{}),
        _api.myItems(booking: bookingId).catchError(
            (_) => <Map<String, dynamic>>[]),
        _api.bookingTimeline(bookingId).catchError(
            (_) => <Map<String, dynamic>>[]),
        _api.myDelegations(bookingId).catchError(
            (_) => <Map<String, dynamic>>[]),
        if (detail.listingId != null && detail.listingId!.isNotEmpty)
          _api.listingDetail(detail.listingId!).catchError(
              (_) => <String, dynamic>{})
        else
          Future.value(<String, dynamic>{}),
      ]);

      final hostMap = results[0] as Map<String, dynamic>;
      final itemRows = results[1] as List<Map<String, dynamic>>;
      final timelineRows = results[2] as List<Map<String, dynamic>>;
      final delegationRows = results[3] as List<Map<String, dynamic>>;
      final listingWrap = results[4] as Map<String, dynamic>;
      _delegations = delegationRows.map(PickupDelegation.from).toList();

      final host = hostMap.isEmpty ? null : BookingHost.from(hostMap);
      // my-items returns ALL the guest's items (the server ignores the booking
      // filter), so scope to THIS booking here — otherwise another booking's
      // item pollutes the phase and the request target.
      final items = itemRows
          .map(CustodyItem.from)
          .where((i) => i.booking == null || i.booking == bookingId)
          .toList()
        ..sort((a, b) => (a.startDate ?? DateTime(0))
            .compareTo(b.startDate ?? DateTime(0)));
      final timeline = timelineRows.map(TimelineEntry.from).toList()
        ..sort((a, b) =>
            (b.at ?? DateTime(0)).compareTo(a.at ?? DateTime(0)));
      Venue? venue;
      final listingRec = listingWrap['listing'];
      if (listingRec is Map) {
        venue = Venue.fromListingRecord(Map<String, dynamic>.from(listingRec));
      }
      _addOns = (listingWrap['addOns'] as List?)
              ?.whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList() ??
          const [];

      _detail = detail.copyWith(
        host: host,
        venue: venue,
        items: items,
        timeline: timeline,
      );
      _loading = false;
      _syncPolling();
      notifyListeners();
    } catch (e) {
      _error = 'Could not load booking — $e';
      _loading = false;
      notifyListeners();
    }
  }

  // ── delegated pickup ──────────────────────────────────────────────────────
  List<PickupDelegation> _delegations = const [];
  List<PickupDelegation> get delegations => _delegations;

  /// The live hand-off covering an item, if any.
  PickupDelegation? delegationFor(String itemId) {
    for (final d in _delegations) {
      if (d.isActive && d.items.contains(itemId)) return d;
    }
    return null;
  }

  /// Hand some items to someone else. Returns the hand-off (with its pass link)
  /// or throws with the server's reason.
  Future<PickupDelegation> delegate(Map<String, dynamic> body) async {
    final res = await _api.createDelegation(_bookingId!, body);
    final d = PickupDelegation.from(res);
    await load(_bookingId!);
    return d;
  }

  Future<void> revokeDelegation(String id) async {
    await _api.revokeDelegation(id);
    await load(_bookingId!);
  }

  Future<String?> resendDelegation(String id) async {
    final res = await _api.resendDelegation(id);
    await load(_bookingId!);
    return res['passUrl']?.toString();
  }

  Future<bool> cancel({String? reason}) async {
    final d = _detail;
    if (d == null) return false;
    return _run(() async {
      await _api.cancelBooking(d.bookingId, reason: reason);
      await load(d.bookingId);
      return true;
    });
  }

  /// Pay the outstanding balance with a card. Creates a PaymentIntent for the
  /// balance, presents the Stripe sheet, then applies the confirmed intent to
  /// the booking via settle-payment. Returns the amount paid, or null on
  /// cancel/failure. Mobile only.
  Future<double?> payBalance({String? email}) async {
    final d = _detail;
    if (d == null || kIsWeb) return null;
    final amount = d.payment.balance;
    if (amount <= 0.004) return null;
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await StripeService.initialize();
      final intent = await paymentService.createPaymentIntent(
        amount: amount,
        currency: d.currency.toLowerCase(),
        referenceId: d.bookingId,
        email: email,
      );
      final clientSecret =
          (intent['clientSecret'] ?? intent['client_secret'] ?? '').toString();
      if (clientSecret.isEmpty) throw Exception('Payment setup failed');
      final pk = (intent['publishableKey'] ?? '').toString();
      if (pk.isNotEmpty) await StripeService.setPublishableKey(pk);
      final ok = await StripeService.presentPaymentSheet(
          clientSecret: clientSecret, merchantDisplayName: 'Stowbo');
      if (!ok) {
        _busy = false;
        notifyListeners();
        return null; // sheet dismissed
      }
      final intentId = clientSecret.contains('_secret')
          ? clientSecret.split('_secret').first
          : clientSecret;
      await _api.settlePayment(d.bookingId, intentId);
      await load(d.bookingId);
      _busy = false;
      notifyListeners();
      return amount;
    } catch (e) {
      final msg = e.toString();
      _busy = false;
      if (msg.toLowerCase().contains('cancel')) {
        notifyListeners();
        return null;
      }
      _error = msg.replaceFirst('Exception: ', '');
      notifyListeners();
      return null;
    }
  }

  /// Guest self-serve move on an unmanned space (tool locker, self-storage).
  /// direction: 'out' (take) | 'in' (put back).
  Future<bool> selfMove(String itemId, String direction) async {
    final d = _detail;
    if (d == null) return false;
    return _run(() async {
      await _api.selfMovement(itemId, {'direction': direction});
      await load(d.bookingId);
      return true;
    });
  }

  /// Move the whole set at once (the daily "take everything / put it all back").
  /// direction 'out' moves every present item; 'in' returns every out item.
  Future<bool> selfMoveAll(String direction) async {
    final d = _detail;
    if (d == null) return false;
    final targets = d.items.where((i) {
      if (i.checkedInAt == null || i.checkedOutAt != null) return false;
      return direction == 'out' ? i.present : !i.present;
    }).toList();
    if (targets.isEmpty) return false;
    return _run(() async {
      for (final i in targets) {
        await _api.selfMovement(i.id, {'direction': direction});
      }
      await load(d.bookingId);
      return true;
    });
  }

  Future<bool> extend(DateTime newEnd) async {
    final d = _detail;
    if (d == null) return false;
    return _run(() async {
      await _api.extendBooking(
          d.bookingId, {'endDate': newEnd.toUtc().toIso8601String()});
      await load(d.bookingId);
      return true;
    });
  }

  /// Raise a TRACKED request on the in-custody item. Direction is derived (here
  /// → retrieve, out → return), so it works in advance. The host is notified by
  /// email + SMS; polling + socket then stream the status back.
  Future<bool> request({String? note}) async {
    final d = _detail;
    if (d == null) return false;
    final item = d.requestableItem;
    if (item == null) {
      _error = 'Nothing in custody to request right now.';
      notifyListeners();
      return false;
    }
    final dir = item.present ? 'out' : 'in';
    return _run(() async {
      await _api.requestMovement(item.id, dir, note: note);
      await load(d.bookingId);
      return true;
    });
  }

  /// Call off the open request.
  Future<bool> cancelActiveRequest() async {
    final d = _detail;
    final item = d?.requestingItem;
    if (d == null || item == null) return false;
    return _run(() async {
      await _api.cancelRequest(item.id);
      await load(d.bookingId);
      return true;
    });
  }

  /// Add a paid extra service (add-on) to the booking. Takes payment first via
  /// the Stripe sheet when it costs money, then records it on the bill.
  Future<bool> addService(
      {required String name, required double amount, String? code}) async {
    final d = _detail;
    if (d == null) return false;
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      String? intentId;
      if (amount > 0.004 && !kIsWeb) {
        await StripeService.initialize();
        final intent = await paymentService.createPaymentIntent(
          amount: amount,
          currency: d.currency.toLowerCase(),
          referenceId: d.bookingId,
        );
        final cs =
            (intent['clientSecret'] ?? intent['client_secret'] ?? '').toString();
        if (cs.isEmpty) throw Exception('Payment setup failed');
        final pk = (intent['publishableKey'] ?? '').toString();
        if (pk.isNotEmpty) await StripeService.setPublishableKey(pk);
        final ok = await StripeService.presentPaymentSheet(
            clientSecret: cs, merchantDisplayName: 'Stowbo');
        if (!ok) {
          _busy = false;
          notifyListeners();
          return false;
        }
        intentId = cs.contains('_secret') ? cs.split('_secret').first : cs;
      }
      await _api.addBookingAddon(d.bookingId,
          name: name, amount: amount, code: code, paymentIntentId: intentId);
      await load(d.bookingId);
      _busy = false;
      notifyListeners();
      return true;
    } catch (e) {
      final msg = e.toString();
      _busy = false;
      if (msg.toLowerCase().contains('cancel')) {
        notifyListeners();
        return false;
      }
      _error = msg.replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Ask the host about the current request / booking (opens a message with
  /// booking context) — the "inquire" path.
  Future<bool> messageHost(String content) => _sendHost(content);

  Future<bool> _sendHost(String content) async {
    final d = _detail;
    final host = d?.host;
    if (d == null || host == null) return false;
    final recipient = host.email.isNotEmpty ? host.email : host.id;
    return _run(() async {
      await _community.sendMessage(
        recipientId: recipient,
        content: content,
        context: {'bookingId': d.bookingId, 'reference': d.reference},
      );
      return true;
    });
  }

  Future<bool> _run(Future<bool> Function() action) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final ok = await action();
      _busy = false;
      notifyListeners();
      return ok;
    } catch (e) {
      _busy = false;
      _error = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }
}
