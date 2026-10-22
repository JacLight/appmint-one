import 'dart:convert';
import 'http_client.dart';

/// Client for the real Stowbo engine (`/client/stowbo/*`). Guest + host, scoped
/// to the signed-in customer. Dual-token (app + user) via [AppengineHttpClient].
class StowboApi {
  final AppengineHttpClient _http = appengineHttpClient;

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : {};

  /// Find-DTO / array unwrap → list of BaseModel records.
  List<Map<String, dynamic>> _records(dynamic r) {
    dynamic list;
    if (r is List) {
      list = r;
    } else if (r is Map) {
      list = r['data'] ?? r['items'] ?? r['results'] ?? [];
    }
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  // ── init ────────────────────────────────────────────────────────────────
  /// { signedIn, host, customer:{id,email}, listingCount }
  Future<Map<String, dynamic>> init() async =>
      _map(await _http.get('/client/stowbo/init'));

  // ── guest: discovery ─────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> browse({
    String? city,
    String? spaceType,
    String? keyword,
  }) async {
    final qp = <String, String>{
      if (city != null && city.isNotEmpty) 'city': city,
      if (spaceType != null && spaceType.isNotEmpty) 'spaceType': spaceType,
      if (keyword != null && keyword.isNotEmpty) 'keyword': keyword,
      'pageSize': '100',
    };
    return _records(await _http.get('/client/stowbo/listings',
        queryParams: qp.isEmpty ? null : qp));
  }

  /// { listing, children:[], addOns:[], schedule{}, host{}, moreFromHost:[] }
  /// Listing ids can be the raw title (with spaces) on legacy data, so encode.
  Future<Map<String, dynamic>> listingDetail(String listingId) async => _map(
      await _http.get(
          '/client/stowbo/listings/${Uri.encodeComponent(listingId)}'));

  /// Other places by the same host → { data:[card], total, host }.
  Future<Map<String, dynamic>> moreFromHost(String listingId,
          {String? startDate, String? endDate, int? quantity}) async =>
      _map(await _http.get(
          '/client/stowbo/listings/$listingId/more-from-host',
          queryParams: {
            if (startDate != null) 'startDate': startDate,
            if (endDate != null) 'endDate': endDate,
            if (quantity != null) 'quantity': '$quantity',
          }));

  /// Nearby alternatives → { data:[card], total }. Pass the guest's lat/lng and
  /// window so results are real (availability-checked + priced).
  Future<Map<String, dynamic>> nearbyListings(
    String listingId, {
    double? lat,
    double? lng,
    double? radiusKm,
    String? spaceType,
    String? startDate,
    String? endDate,
    int? quantity,
  }) async =>
      _map(await _http.get('/client/stowbo/listings/$listingId/nearby',
          queryParams: {
            if (lat != null) 'lat': '$lat',
            if (lng != null) 'lng': '$lng',
            if (radiusKm != null) 'radiusKm': '$radiusKm',
            if (spaceType != null) 'spaceType': spaceType,
            if (startDate != null) 'startDate': startDate,
            if (endDate != null) 'endDate': endDate,
            if (quantity != null) 'quantity': '$quantity',
          }));

  /// { capacity, booked, available, sufficient, unitBacked, quote{...} }.
  /// `quote` is the server-computed price for exactly this window + add-ons.
  Future<Map<String, dynamic>> availability(
    String listingId, {
    required String startDate,
    required String endDate,
    int quantity = 1,
    List<Map<String, dynamic>>? addOns,
    String? discountCode,
    String? customer,
  }) async =>
      _map(await _http.get('/client/stowbo/listings/$listingId/availability',
          queryParams: {
            'startDate': startDate,
            'endDate': endDate,
            'quantity': '$quantity',
            if (addOns != null && addOns.isNotEmpty)
              'addOns': jsonEncode(addOns),
            if (discountCode != null && discountCode.isNotEmpty)
              'discountCode': discountCode,
            if (customer != null && customer.isNotEmpty) 'customer': customer,
          }));

  // ── guest: checkout (server-driven, resumable across devices) ─────────────
  /// Price a cart. No side effects → { currency, lines[], subtotal, serviceFee,
  /// protectionFee, tax, total, bookable, unavailable[] }.
  Future<Map<String, dynamic>> quoteCart({
    required List<Map<String, dynamic>> items,
    String currency = 'usd',
  }) async =>
      _map(await _http.post('/client/stowbo/checkout/quote',
          body: {'items': items, 'currency': currency}));

  /// Save the cart + how far they got. One open purchase per customer, updated
  /// in place → { checkoutId, quote, checkout }. 409 if a hold is already live.
  Future<Map<String, dynamic>> saveCart({
    required List<Map<String, dynamic>> items,
    String currency = 'usd',
    String? step,
    String? returnTo,
    Map<String, dynamic>? context,
  }) async =>
      _map(await _http.post('/client/stowbo/checkout/cart', body: {
        'items': items,
        'currency': currency,
        if (step != null) 'step': step,
        if (returnTo != null) 'returnTo': returnTo,
        if (context != null) 'context': context,
      }));

  /// The unfinished purchase, re-priced → { resumable, checkoutId?, status,
  /// step, holdExpiresAt, holdExpired, previousTotal, quote, changed }.
  Future<Map<String, dynamic>> resumeCheckout() async =>
      _map(await _http.get('/client/stowbo/checkout/resume'));

  /// Stamp the step reached, without re-pricing.
  Future<Map<String, dynamic>> saveProgress(
    String checkoutId, {
    String? step,
    String? returnTo,
    Map<String, dynamic>? context,
  }) async =>
      _map(await _http.request(
          'PUT', '/client/stowbo/checkout/$checkoutId/progress',
          body: {
            if (step != null) 'step': step,
            if (returnTo != null) 'returnTo': returnTo,
            if (context != null) 'context': context,
          }));

  /// Take the capacity off the market while they pay → { checkoutId, expiresAt,
  /// quote }. 409 if something in the cart went unavailable.
  Future<Map<String, dynamic>> startCheckout({
    required List<Map<String, dynamic>> items,
    String currency = 'usd',
    String? returnTo,
    Map<String, dynamic>? context,
  }) async =>
      _map(await _http.post('/client/stowbo/checkout/hold', body: {
        'items': items,
        'currency': currency,
        if (returnTo != null) 'returnTo': returnTo,
        if (context != null) 'context': context,
      }));

  /// Pay and confirm → the created booking. 402 payment failed (hold intact),
  /// 409 hold expired / already confirmed.
  Future<Map<String, dynamic>> confirmCheckout(
    String checkoutId, {
    String? paymentMethodId,
    String? paymentIntentId,
    bool captureNow = true,
  }) async =>
      _map(await _http.post('/client/stowbo/checkout/$checkoutId/confirm',
          body: {
            if (paymentMethodId != null) 'paymentMethodId': paymentMethodId,
            if (paymentIntentId != null) 'paymentIntentId': paymentIntentId,
            'captureNow': captureNow,
          }));

  /// Abandon checkout and release the held capacity.
  Future<void> abandonCheckout(String checkoutId) =>
      _http.delete('/client/stowbo/checkout/$checkoutId');

  // ── guest: bookings ──────────────────────────────────────────────────────
  /// items: [{ listing(code), quantity, startDate, endDate, addOns? }]
  Future<Map<String, dynamic>> book({
    required List<Map<String, dynamic>> items,
    String currency = 'usd',
  }) async =>
      _map(await _http.post('/client/stowbo/bookings',
          body: {'items': items, 'currency': currency}));

  Future<List<Map<String, dynamic>>> myBookings({String? status}) async =>
      _records(await _http.get('/client/stowbo/bookings',
          queryParams: status == null ? null : {'status': status}));

  Future<Map<String, dynamic>> myBooking(String bookingId) async =>
      _map(await _http.get('/client/stowbo/bookings/$bookingId'));

  /// Flat stored lines: [{ booking, reference, pickupCode, index, ...line }]
  Future<List<Map<String, dynamic>>> myStuff() async =>
      _records(await _http.get('/client/stowbo/my-stuff'));

  Future<void> cancelBooking(String bookingId, {String? reason}) =>
      _http.request('PUT', '/client/stowbo/bookings/$bookingId/cancel',
          body: reason == null ? null : {'reason': reason});

  /// Host contact card for a confirmed booking →
  /// { id, name, email, phone, avatar, memberSince, verified } (or empty).
  Future<Map<String, dynamic>> bookingHost(String bookingId) async =>
      _map(await _http.get('/client/stowbo/bookings/$bookingId/host'));

  /// One entry per thing the guest has booked (across all bookings) →
  /// [{ id, booking, listing, unit, identifier, label, startDate, endDate,
  ///    status, checkedInAt, checkedOutAt, present, lastMovementAt, collector }].
  /// `present` = the last movement was inbound (it's physically here).
  Future<List<Map<String, dynamic>>> myItems(
          {String? booking, bool? active}) async =>
      _records(await _http.get('/client/stowbo/my-items', queryParams: {
        if (booking != null) 'booking': booking,
        if (active != null) 'active': '$active',
      }));

  /// Order events (booked, authorized, access(=movement), extended, settled,
  /// cancelled, note, request) → [{ at, type, actor, actorRole, line, amount,
  /// detail }]. The endpoint wraps them as { booking, status, timeline:[...] },
  /// so read the `timeline` key (not the generic data/items unwrap).
  Future<List<Map<String, dynamic>>> bookingTimeline(String bookingId) async {
    final res = await _http.get('/client/stowbo/bookings/$bookingId/timeline');
    final list = res is Map
        ? (res['timeline'] ?? res['data'] ?? res['items'] ?? [])
        : (res is List ? res : []);
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// Extend a stay's window. body: { endDate, line?, paymentIntentId? }.
  Future<Map<String, dynamic>> extendBooking(
          String bookingId, Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/bookings/$bookingId/extend',
          body: body));

  /// Apply a confirmed Stripe PaymentIntent to a booking's balance.
  Future<Map<String, dynamic>> settlePayment(
          String bookingId, String paymentIntentId) async =>
      _map(await _http.post(
          '/client/stowbo/bookings/$bookingId/settle-payment',
          body: {'paymentIntentId': paymentIntentId}));

  /// Add a paid extra service (add-on) to a booking. Pass the confirmed Stripe
  /// intent id when the add-on costs money.
  Future<Map<String, dynamic>> addBookingAddon(String bookingId,
          {required String name,
          required double amount,
          String? code,
          String? paymentIntentId}) async =>
      _map(await _http.post('/client/stowbo/bookings/$bookingId/addons', body: {
        'name': name,
        'amount': amount,
        if (code != null) 'code': code,
        if (paymentIntentId != null) 'paymentIntentId': paymentIntentId,
      }));

  /// Guest self-serve movement (unmanned spaces only) — in / out.
  /// body: { direction:'in'|'out', note?, photos? }.
  Future<Map<String, dynamic>> selfMovement(
          String itemId, Map<String, dynamic> body) async =>
      _map(await _http.post(
          '/client/stowbo/items/$itemId/movement', body: body));

  /// Guest asks the host to retrieve/return an item (manned) — a TRACKED request
  /// the guest then watches. Returns the updated item (with data.request).
  Future<Map<String, dynamic>> requestMovement(String itemId, String direction,
          {String? note}) async =>
      _map(await _http.post('/client/stowbo/items/$itemId/request', body: {
        'direction': direction,
        if (note != null) 'note': note,
      }));

  /// Guest cancels their own open request.
  Future<void> cancelRequest(String itemId) =>
      _http.request('DELETE', '/client/stowbo/items/$itemId/request');

  /// Host advances a guest request: acknowledged | preparing | ready.
  Future<Map<String, dynamic>> hostUpdateRequest(String itemId, String status,
          {String? note}) async =>
      _map(await _http.post('/client/stowbo/host/items/$itemId/request', body: {
        'status': status,
        if (note != null) 'note': note,
      }));

  // ── becoming a host ──────────────────────────────────────────────────────
  Future<Map<String, dynamic>> applyAsHost(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/apply', body: body));

  Future<Map<String, dynamic>> hostMe() async =>
      _map(await _http.get('/client/stowbo/host/me'));

  // ── host: listings + units ───────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> hostListings() async =>
      _records(await _http.get('/client/stowbo/host/listings'));

  Future<Map<String, dynamic>> createListing(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/listings', body: body));

  Future<List<Map<String, dynamic>>> hostUnits({String? listing}) async =>
      _records(await _http.get('/client/stowbo/host/units',
          queryParams: listing == null ? null : {'listing': listing}));

  Future<Map<String, dynamic>> createUnit(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/units', body: body));

  /// Record an in-person (Tap to Pay) card payment the host just collected.
  /// The card_present PaymentIntent is created + confirmed by
  /// [StripeTerminalService.takePayment]; this hands the succeeded intent id to
  /// the backend to record + credit the host. body: { paymentIntentId, amount,
  /// currency?, category?, bookingId?, reference?, description?, email?, phone? }.
  Future<Map<String, dynamic>> takePayment(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/take-payment', body: body));

  /// Create a self-serve payment request — a pay link + QR for a customer who
  /// isn't tapping a card here. Records a PENDING row and returns { url,
  /// paymentRequestId }. Set `send: true` (+ email/phone) to text/email it now.
  Future<Map<String, dynamic>> createPaymentRequest(
          Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/payment-request', body: body));

  /// Poll a payment request's live status — the host waits on this after sending
  /// a link / showing a QR. Returns { status, paid, amount, currency }.
  Future<Map<String, dynamic>> paymentRequestStatus(String requestId) async =>
      _map(await _http.get(
          '/client/stowbo/host/payment-request/${Uri.encodeComponent(requestId)}'));

  /// The host's transactions (collected + pending). Pending rows carry `url` so
  /// the app can re-show the QR / resend. Newest first.
  Future<List<Map<String, dynamic>>> hostTransactions() async =>
      _records(await _http.get('/client/stowbo/host/transactions'));

  /// Every booking across ALL the host's listings. Optional status filter
  /// (new | active | completed | cancelled | settled).
  Future<List<Map<String, dynamic>>> hostBookings({String? status}) async =>
      _records(await _http.get('/client/stowbo/host/bookings',
          queryParams: status != null ? {'status': status} : null));

  /// What a booking owes RIGHT NOW, including any running meter on still-present
  /// items — so a metered/open stay presets its real accrued due, not $0.
  /// Returns { total, paid, towardBill, balance, accrued, metered, due, currency }.
  /// THE money question, for the state you are about to enter:
  /// action = current (default) | checkout | cancel | no_show.
  /// Returns { due, refund, feeTotal, lines, paid, total, payState, message }.
  Future<Map<String, dynamic>> bookingDue(String bookingId, {String? action}) async =>
      _map(await _http.get('/client/stowbo/host/bookings/$bookingId/due',
          queryParams: action == null ? null : {'action': action}));

  /// Refund a paid transaction the host collected — full or partial. Omit
  /// `amount` for a full refund of what remains. body: { amount?, reason? }.
  Future<Map<String, dynamic>> refundTransaction(String ref,
          {double? amount, String? reason}) async =>
      _map(await _http.post(
          '/client/stowbo/host/transactions/${Uri.encodeComponent(ref)}/refund',
          body: {
            if (amount != null) 'amount': amount,
            if (reason != null && reason.isNotEmpty) 'reason': reason,
          }));

  /// (Re)send a receipt for a payment the host collected. With no email/phone it
  /// goes to the linked booking's customer. Backs the receipt screen's
  /// Email / Text receipt buttons. body: { email?, phone?, bookingId? }.
  Future<Map<String, dynamic>> sendReceipt(String ref,
          {String? email, String? phone, String? bookingId}) async =>
      _map(await _http.post(
          '/client/stowbo/host/transactions/${Uri.encodeComponent(ref)}/receipt',
          body: {
            if (email != null && email.isNotEmpty) 'email': email,
            if (phone != null && phone.isNotEmpty) 'phone': phone,
            if (bookingId != null && bookingId.isNotEmpty) 'bookingId': bookingId,
          }));

  /// Cancel (void) a still-pending payment request the host raised — its
  /// link/QR stops working.
  Future<Map<String, dynamic>> cancelPaymentRequest(String requestId) async =>
      _map(await _http.post(
          '/client/stowbo/host/payment-request/${Uri.encodeComponent(requestId)}/cancel'));

  /// The host's wallet: { balance, available, held, reserved, paidOut,
  /// pendingPayout, currency, minPayout }.
  Future<Map<String, dynamic>> hostWallet() async =>
      _map(await _http.get('/client/stowbo/host/wallet'));

  /// The host's payout history (newest first).
  Future<List<Map<String, dynamic>>> hostPayouts() async =>
      _records(await _http.get('/client/stowbo/host/payouts'));

  /// Request a payout. Omit `amount` to pay out the whole available balance.
  Future<Map<String, dynamic>> requestHostPayout(
          {double? amount, String? methodId, String? notes}) async =>
      _map(await _http.post('/client/stowbo/host/payouts', body: {
        if (amount != null) 'amount': amount,
        if (methodId != null && methodId.isNotEmpty) 'methodId': methodId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      }));

  // ── host: payout methods (where the money goes) ───────────────────────────
  // Stowbo's own door onto the host's wallet. The finance module does the real
  // work — validates the rail, encrypts the bank numbers, decides what may be
  // read back — so these routes only ever return the last four.

  /// Saved payout destinations. Each: { id, type(bank|paypal), label, isDefault,
  /// status(pending|verified|disabled), bank:{ bankName, accountType,
  /// accountNumberLast4, accountHolderName }, paypal:{ email } }.
  Future<List<Map<String, dynamic>>> payoutMethods() async {
    final res = await _http.get('/client/stowbo/host/payout-methods');
    if (res is List) {
      return res.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return _records(res);
  }

  /// Add a bank account. Routing/account numbers are encrypted on arrival.
  Future<Map<String, dynamic>> addBankPayoutMethod({
    required String bankName,
    required String accountType, // checking | savings
    required String routingNumber,
    required String accountNumber,
    required String accountHolderName,
    String? label,
    bool isDefault = false,
  }) async =>
      _map(await _http.post('/client/stowbo/host/payout-methods', body: {
        'type': 'bank',
        if (label != null && label.isNotEmpty) 'label': label,
        'isDefault': isDefault,
        'bank': {
          'bankName': bankName,
          'accountType': accountType,
          'routingNumber': routingNumber,
          'accountNumber': accountNumber,
          'accountHolderName': accountHolderName,
        },
      }));

  /// Add a PayPal address. Nothing sensitive is stored for this rail.
  Future<Map<String, dynamic>> addPaypalPayoutMethod({
    required String email,
    String? label,
    bool isDefault = false,
  }) async =>
      _map(await _http.post('/client/stowbo/host/payout-methods', body: {
        'type': 'paypal',
        if (label != null && label.isNotEmpty) 'label': label,
        'isDefault': isDefault,
        'paypal': {'email': email},
      }));

  Future<Map<String, dynamic>> setDefaultPayoutMethod(String methodId) async =>
      _map(await _http.put('/client/stowbo/host/payout-methods/$methodId/default', body: {}));

  Future<void> removePayoutMethod(String methodId) async =>
      await _http.delete('/client/stowbo/host/payout-methods/$methodId');

  // ── host: add-ons (reusable extras the host attaches to listings) ─────────
  /// Every add-on I own (excludes deleted). Records: { sk, data:{ name(slug),
  /// title, description, price, chargeEvery, service, status } }.
  Future<List<Map<String, dynamic>>> hostAddons() async =>
      _records(await _http.get('/client/stowbo/host/addons'));

  Future<Map<String, dynamic>> createAddon(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/addons', body: body));

  Future<Map<String, dynamic>> updateAddon(
          String addonId, Map<String, dynamic> body) async =>
      _map(await _http.put('/client/stowbo/host/addons/$addonId', body: body));

  /// Soft-delete (retire) an add-on. Bookings that already bought it keep it.
  Future<Map<String, dynamic>> deleteAddon(String addonId) async =>
      _map(await _http.delete('/client/stowbo/host/addons/$addonId'));

  /// Set which add-ons (by add-on NAME/slug) apply to one of my listings.
  Future<Map<String, dynamic>> setListingAddons(
          String listingId, List<String> names) async =>
      _map(await _http.put(
          '/client/stowbo/host/listings/${Uri.encodeComponent(listingId)}/addons',
          body: {'addOns': names}));

  // ── host: fees — a fee belongs to a listing (models/stowbo/stowbo-fee.ts) ─
  /// The fees on one of my listings (full records, in order).
  Future<List<Map<String, dynamic>>> listingFees(String listingId) async =>
      _records(await _http.get(
          '/client/stowbo/host/listings/${Uri.encodeComponent(listingId)}/fees'));

  /// Create a fee on this listing (saved as entered, attached right away).
  Future<Map<String, dynamic>> createListingFee(
          String listingId, Map<String, dynamic> body) async =>
      _map(await _http.post(
          '/client/stowbo/host/listings/${Uri.encodeComponent(listingId)}/fees',
          body: body));

  Future<Map<String, dynamic>> updateFee(
          String feeId, Map<String, dynamic> body) async =>
      _map(await _http.put('/client/stowbo/host/fees/$feeId', body: body));

  /// Remove a fee from this listing. Bookings that already carry it keep the row.
  Future<Map<String, dynamic>> removeListingFee(
          String listingId, String feeId) async =>
      _map(await _http.delete(
          '/client/stowbo/host/listings/${Uri.encodeComponent(listingId)}/fees/$feeId'));

  // ── host: coupons (storefront discounts locked to my listings) ───────────
  /// Records: { sk, data:{ code, name, type(percent|fixed), value, maxDiscount,
  /// minCartValue, firstOrderOnly, startDate, endDate, usageLimit,
  /// usageLimitPerCustomer, usageCount, products[] (listing codes), status } }.
  Future<List<Map<String, dynamic>>> hostDiscounts() async =>
      _records(await _http.get('/client/stowbo/host/discounts'));

  Future<Map<String, dynamic>> createDiscount(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/discounts', body: body));

  Future<Map<String, dynamic>> updateDiscount(
          String id, Map<String, dynamic> body) async =>
      _map(await _http.put('/client/stowbo/host/discounts/$id', body: body));

  /// Usage & stats for one of my codes: { uses, liveUses, discounted, revenue,
  /// usageCount, usageLimit, bookings:[{reference, customer, listing, status,
  /// total, discount, at}] } — from the bookings' bills, not a counter.
  Future<Map<String, dynamic>> discountStats(String id) async =>
      _map(await _http.get('/client/stowbo/host/discounts/$id/stats'));

  /// Retire a coupon: the code stops working; past bookings keep their discount.
  Future<Map<String, dynamic>> deleteDiscount(String id) async =>
      _map(await _http.delete('/client/stowbo/host/discounts/$id'));

  /// One of my listings — incl. drafts — with units and applicable add-ons.
  Future<Map<String, dynamic>> myListing(String listingId) async => _map(
      await _http.get(
          '/client/stowbo/host/listings/${Uri.encodeComponent(listingId)}'));

  // Drop-off / hand-back are no longer code-scan routes on the order — they are
  // item movements (in / out) + check-out at the Counter (see itemMovement /
  // itemCheckout).

  Future<Map<String, dynamic>> settle(String bookingId) async => _map(
      await _http.post('/client/stowbo/host/bookings/$bookingId/settle'));

  Future<Map<String, dynamic>> earnings() async =>
      _map(await _http.get('/client/stowbo/host/earnings'));

  // ── delegated pickup (owner side) ─────────────────────────────────────────
  /// Hand the pickup of some items to someone else. body: { items[], name,
  /// phone?|email?, verify: qr|qr_name|qr_id, validUntil?, note?, photo? } →
  /// the hand-off { id, code, status, passUrl, delegate, verify, validUntil, itemDetails[] }.
  Future<Map<String, dynamic>> createDelegation(
          String bookingId, Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/bookings/$bookingId/delegations',
          body: body));

  /// The hand-offs on my booking, newest first.
  Future<List<Map<String, dynamic>>> myDelegations(String bookingId) async =>
      _records(await _http.get('/client/stowbo/bookings/$bookingId/delegations'));

  Future<Map<String, dynamic>> resendDelegation(String id) async =>
      _map(await _http.post('/client/stowbo/delegations/$id/resend', body: {}));

  Future<Map<String, dynamic>> revokeDelegation(String id) async =>
      _map(await _http.request('DELETE', '/client/stowbo/delegations/$id'));

  // ── delegated pickup (host side) ──────────────────────────────────────────
  /// Resolve a scanned pickup code → { allowed, kind: owner|delegate, delegation,
  /// booking, collector{role,name,contact}, verify[], verifyLabel, photoRequired,
  /// validUntil, note, photo, items[], heldForOthers[], collected[], reason, message }.
  Future<Map<String, dynamic>> hostHandover(String code) async =>
      _map(await _http.get('/client/stowbo/host/handover',
          queryParams: {'code': code}));

  /// Hand over. body: { code, items?[], verified[], photos?[], note?, collectorName? }.
  Future<Map<String, dynamic>> hostCompleteHandover(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/handover', body: body));

  /// Refuse a pickup. body: { reason, who?, note?, delegation?|code? }.
  Future<Map<String, dynamic>> hostRefusePickup(
          String itemId, Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/items/$itemId/refuse', body: body));

  /// Hand-offs on my listings → { handoffs[], refusals[], totals }.
  Future<Map<String, dynamic>> hostHandovers(
          {String? from, String? to, String? listing, String? status}) async =>
      _map(await _http.get('/client/stowbo/host/handovers', queryParams: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (listing != null) 'listing': listing,
        if (status != null) 'status': status,
      }));

  /// The hand-offs on a booking I host.
  Future<List<Map<String, dynamic>>> hostBookingDelegations(String bookingId) async =>
      _records(await _http.get('/client/stowbo/host/bookings/$bookingId/delegations'));

  // ── host control center (operator-first) ──────────────────────────────────
  /// Today's board → { date, arrivals, inCustody, departures, overdue,
  /// capacity }. Entries are ITEMS: { item, booking, customer, listing, unit,
  /// identifier, startDate, endDate, checkedInAt, status, present }.
  Future<Map<String, dynamic>> hostToday({String? listing, String? date}) async =>
      _map(await _http.get('/client/stowbo/host/today', queryParams: {
        if (listing != null) 'listing': listing,
        if (date != null) 'date': date,
      }));

  /// Universal operator search (plate/phone/code/bay/tag) → { query, results:[
  /// { booking, reference, customer, status, total, items:[{ id, listing, unit,
  /// identifier, startDate, endDate, status, present, overstaying, actions[] }]}]}.
  /// `actions` (PER ITEM) are the legal moves now: checkin/in/out/checkout/charge.
  Future<Map<String, dynamic>> hostResolve(String q) async =>
      _map(await _http.get('/client/stowbo/host/resolve',
          queryParams: {'q': q}));

  /// What is in which unit right now (patrol, not handover) → { listing, at,
  /// occupied:[{item,unit,identifier,booking,customer,since,until,overstaying}]}.
  Future<Map<String, dynamic>> occupancyNow(String listingId) async =>
      _map(await _http.get(
          '/client/stowbo/host/listings/$listingId/occupancy-now'));

  /// Take a walk-in at the counter. body: { listing, customer?(phone/plate/
  /// email), quantity?, endDate?(omit=OPEN), identifier?, unit?, movementIn?,
  /// photos?, note?, condition? }. 409 if the space can't take it.
  Future<Map<String, dynamic>> hostBook(Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/bookings', body: body));

  /// Every ITEM under an order → [stowbo_booking_item].
  Future<List<Map<String, dynamic>>> bookingItems(String bookingId) async =>
      _records(await _http.get(
          '/client/stowbo/host/bookings/$bookingId/items'));

  // ── the session, per ITEM (a booking item, not the order) ─────────────────
  /// Check in — open the session. Idempotent. body: { note?, unit? }.
  Future<Map<String, dynamic>> itemCheckin(String itemId,
          {String? note, String? unit}) async =>
      _map(await _http.post('/client/stowbo/host/items/$itemId/checkin', body: {
        if (note != null) 'note': note,
        if (unit != null) 'unit': unit,
      }));

  /// Something in / out — unlimited, append-only, never billable, never touches
  /// capacity. body: { direction:'in'|'out', photos?, note?, condition?,
  /// releasedTo?, identifier?, unit?, ... }.
  Future<Map<String, dynamic>> itemMovement(
          String itemId, Map<String, dynamic> body) async =>
      _map(await _http.post(
          '/client/stowbo/host/items/$itemId/movement', body: body));

  /// Put / move the item to a unit (re-assignable). body: { unit, note? }.
  Future<Map<String, dynamic>> itemAssign(
          String itemId, Map<String, dynamic> body) async =>
      _map(await _http.post(
          '/client/stowbo/host/items/$itemId/assign', body: body));

  /// Preview what checking out would add (writes nothing) → { canCheckOut,
  /// accruing, present, used, overstay, usedUntil, rateLines, ... }. Safe to poll.
  Future<Map<String, dynamic>> itemCheckoutPreview(String itemId) async =>
      _map(await _http.get('/client/stowbo/host/items/$itemId/checkout'));

  /// Check out — close the session. The ONLY place capacity is released; a
  /// move-out is NOT a check-out. 409 STILL_PRESENT if not moved out.
  Future<Map<String, dynamic>> itemCheckout(String itemId, {String? note}) async =>
      _map(await _http.post('/client/stowbo/host/items/$itemId/checkout',
          body: {if (note != null) 'note': note}));

  // ── host: one booking, in full (the 360 dashboard) ───────────────────────
  Future<Map<String, dynamic>> hostBooking(String bookingId) async =>
      _map(await _http.get('/client/stowbo/host/bookings/$bookingId'));

  Future<void> respondBookingRequest(String bookingId, String requestId, String status) async {
    await _http.post('/client/stowbo/host/bookings/$bookingId/requests/$requestId', body: {'status': status});
  }

  Future<List<Map<String, dynamic>>> hostTimeline(String bookingId) async =>
      _records(await _http.get(
          '/client/stowbo/host/bookings/$bookingId/timeline'));

  /// Claims + adjustments + timeline are read from the booking record itself
  /// (`claims[]`, `adjustments[]`, `timeline[]`). There are no claim routes —
  /// disputes surface money as charge/refund lines.

  // ── the running account (charge more / refund) ────────────────────────────
  /// Charge the guest more (damage / overstay / extra). body: { amount,
  /// category?, description?, line? }.
  Future<Map<String, dynamic>> hostCharge(
          String bookingId, Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/bookings/$bookingId/charge',
          body: body));

  /// Refund / credit the guest. body: { amount, category?, description? }.
  Future<Map<String, dynamic>> hostRefund(
          String bookingId, Map<String, dynamic> body) async =>
      _map(await _http.post('/client/stowbo/host/bookings/$bookingId/refund',
          body: body));

  /// Undo an adjustment line by its INDEX (adds the opposite; original stays).
  Future<Map<String, dynamic>> reverseLine(
          String bookingId, int index, {String? reason}) async =>
      _map(await _http.post(
          '/client/stowbo/host/bookings/$bookingId/lines/$index/reverse',
          body: {if (reason != null) 'reason': reason}));

  // ── payout hold / release, and host-side cancel ───────────────────────────
  /// Hold the payout — the booking will not settle until released.
  Future<Map<String, dynamic>> hostHoldPayment(String bookingId,
          {String? reason}) async =>
      _map(await _http.post('/client/stowbo/host/bookings/$bookingId/hold',
          body: {if (reason != null) 'reason': reason}));

  /// Release a held payout.
  Future<Map<String, dynamic>> hostReleasePayment(String bookingId) async =>
      _map(await _http
          .post('/client/stowbo/host/bookings/$bookingId/release'));

  /// Cancel a booking on my own listing (host-scoped, not the guest cancel).
  Future<Map<String, dynamic>> hostCancelBooking(String bookingId,
          {String? reason}) async =>
      _map(await _http.post('/client/stowbo/host/bookings/$bookingId/cancel',
          body: {if (reason != null) 'reason': reason}));

  // ── a space (listing) dashboard ───────────────────────────────────────────
  Future<Map<String, dynamic>> hostListing(String listingId) async =>
      _map(await _http.get('/client/stowbo/host/listings/$listingId'));

  Future<List<Map<String, dynamic>>> hostListingBookings(
          String listingId, {String? status}) async =>
      _records(await _http.get(
          '/client/stowbo/host/listings/$listingId/bookings',
          queryParams: status == null ? null : {'status': status}));

  Future<Map<String, dynamic>> hostCalendar(String listingId,
          {String? from, int? days}) async =>
      _map(await _http.get('/client/stowbo/host/listings/$listingId/calendar',
          queryParams: {
            if (from != null) 'from': from,
            if (days != null) 'days': '$days',
          }));

  Future<void> updateListing(String listingId, Map<String, dynamic> patch) =>
      _http.request('PUT', '/client/stowbo/host/listings/$listingId',
          body: patch);

  Future<void> setListingStatus(String listingId, String status) =>
      _http.request('PUT', '/client/stowbo/host/listings/$listingId/status',
          body: {'status': status});

  /// Permanently remove a listing (host-owned). Backend blocks if it has live
  /// bookings; surfaces that as an error.
  Future<void> deleteListing(String listingId) =>
      _http.request('DELETE', '/client/stowbo/host/listings/$listingId');

  /// Update a unit — status (vacant/maintenance/overlocked/retired), number,
  /// access code. body: { status?, unitNumber?, accessCode?, name? }.
  Future<Map<String, dynamic>> updateUnit(
          String unitId, Map<String, dynamic> body) async =>
      _map(await _http
          .request('PUT', '/client/stowbo/host/units/$unitId', body: body));
}

final stowboApi = StowboApi();
