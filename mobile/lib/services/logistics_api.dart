import 'http_client.dart';

/// The `/logistics` API, one method per real route.
///
/// Every path here is a controller decorator in
/// `appengine/src/logistics/delivery.controller.ts` (agent + operator) or
/// `delivery-client.controller.ts` (customer). Nothing is invented: if a
/// method exists, the endpoint exists.
class LogisticsApi {
  static final LogisticsApi _instance = LogisticsApi._();
  factory LogisticsApi() => _instance;
  LogisticsApi._();

  final AppengineHttpClient _http = appengineHttpClient;

  /// Customer-facing routes — `DeliveryClientController` and
  /// `DeliveryQuoteController` both sit on this prefix.
  static const _client = '/client/logistics';

  /// Agent and operator routes — `DeliveryController`.
  static const _ops = '/logistics/delivery';

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : <String, dynamic>{};

  /// Find-DTO / array unwrap -> list of BaseModel records.
  List<Map<String, dynamic>> _records(dynamic r) {
    dynamic list;
    if (r is List) {
      list = r;
    } else if (r is Map) {
      list = r['data'] ?? r['items'] ?? r['results'] ?? r['rows'] ?? [];
    }
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────

  /// Everything the app needs on launch: config, zones, the agent's own record.
  Future<Map<String, dynamic>> init() async =>
      _map(await _http.get('$_client/init'));

  Future<Map<String, dynamic>> config() async =>
      _map(await _http.get('$_ops/config'));

  Future<Map<String, dynamic>> me() async => _map(await _http.get('$_client/me'));

  Future<Map<String, dynamic>> stripeConfig() async =>
      _map(await _http.get('$_client/stripe/config'));

  // ── Zones and geocoding ─────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> zones() async =>
      _records(await _http.get('$_ops/zones'));

  Future<Map<String, dynamic>> zone(String name) async =>
      _map(await _http.get('$_ops/zones/$name'));

  /// Which service zone covers a point. The server owns the answer — the app
  /// never decides whether an address is serviceable.
  Future<Map<String, dynamic>> zoneLookup(
          {required double lat, required double lng}) async =>
      _map(await _http.get('$_ops/zones/lookup', queryParams: {
        'lat': '$lat',
        'lng': '$lng',
      }));

  Future<Map<String, dynamic>> geocode(String address) async =>
      _map(await _http.post('$_ops/geocode', body: {'address': address}));

  // ── Customer: ordering ──────────────────────────────────────────────────

  /// Price a delivery without creating it.
  ///
  /// Returns `{valid, quoteId, expiresAt, pricing:{total,basePrice,currency},
  /// tracking:{distance,duration,routeSource}}`. An out-of-area request comes
  /// back as `{valid: false, errors, stops}` rather than throwing, so the
  /// caller must check [QuoteResult.valid] instead of relying on an exception.
  /// The quoteId is signed and valid for 15 minutes.
  Future<QuoteResult> createQuote(List<Map<String, dynamic>> stops) async {
    final res = _map(await _http.post('$_client/quotes', body: {'stops': stops}));
    return QuoteResult.fromJson(res);
  }

  /// Book a quoted delivery. The server creates the job and a Stripe
  /// PaymentIntent at exactly the quoted amount, so the price cannot drift
  /// between quoting and paying.
  Future<Map<String, dynamic>> orderFromQuote(
    String quoteId, {
    required List<Map<String, dynamic>> stops,
    String? notes,
    Map<String, dynamic>? scheduling,
    String paymentMethod = 'stripe',
  }) async =>
      _map(await _http.post('$_client/quotes/$quoteId/order', body: {
        'stops': stops,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        'scheduling': scheduling ?? const {'type': 'asap'},
        'paymentMethod': paymentMethod,
      }));

  /// A stop as the server models it. The address lives inside `location`.
  static Map<String, dynamic> stop({
    required String type,
    String? address,
    double? lat,
    double? lng,
    String? placeName,
    String? contactName,
    String? contactPhone,
    String? instructions,
    List<Map<String, dynamic>>? items,
  }) =>
      {
        'type': type,
        'location': {
          if (lat != null) 'lat': lat,
          if (lng != null) 'lng': lng,
          if (address != null && address.isNotEmpty) 'address': address,
          if (placeName != null && placeName.isNotEmpty) 'placeName': placeName,
        },
        if (contactName != null || contactPhone != null)
          'contact': {
            'name': contactName ?? '',
            'phone': contactPhone ?? '',
          },
        if (instructions != null && instructions.isNotEmpty)
          'instructions': instructions,
        if (items != null && items.isNotEmpty) 'items': items,
      };

  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> order) async =>
      _map(await _http.post('$_client/orders', body: order));

  Future<List<Map<String, dynamic>>> orders({String? status}) async =>
      _records(await _http.get('$_client/orders',
          queryParams: {if (status != null) 'status': status}));

  Future<Map<String, dynamic>> updateOrder(
          String jobId, Map<String, dynamic> patch) async =>
      _map(await _http.put('$_client/orders/$jobId', body: patch));

  Future<Map<String, dynamic>> cancelOrder(String jobId,
          {String? reason}) async =>
      _map(await _http.put('$_client/orders/$jobId/cancel',
          body: {if (reason != null) 'reason': reason}));

  /// Where the agent is and what stage the job is at. Polled by the track
  /// screen — there is no logistics socket gateway yet.
  Future<Map<String, dynamic>> track(String jobId) async =>
      _map(await _http.get('$_client/orders/$jobId/track'));

  Future<Map<String, dynamic>> paymentIntent(String jobId) async =>
      _map(await _http.post('$_client/orders/$jobId/payment-intent'));

  Future<Map<String, dynamic>> completePayment(String jobId,
          {Map<String, dynamic>? body}) async =>
      _map(await _http.post('$_client/orders/$jobId/complete-payment',
          body: body ?? const {}));

  Future<Map<String, dynamic>> rate(String jobId,
          {required int stars, String? comment}) async =>
      _map(await _http.post('$_client/orders/$jobId/rate', body: {
        'rating': stars,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      }));

  // ── Agent: finding work ─────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> availableJobs() async =>
      _records(await _http.get('$_client/jobs/available'));

  Future<List<Map<String, dynamic>>> agentAvailableJobs(String agentId) async =>
      _records(
          await _http.get('$_ops/agents/$agentId/available-jobs'));

  Future<List<Map<String, dynamic>>> myJobs({String? status}) async =>
      _records(await _http.get('$_client/jobs',
          queryParams: {if (status != null) 'status': status}));

  Future<Map<String, dynamic>> job(String jobId) async =>
      _map(await _http.get('$_client/jobs/$jobId'));

  Future<List<Map<String, dynamic>>> onlineAgents() async =>
      _records(await _http.get('$_ops/agents/online'));

  Future<Map<String, dynamic>> stats() async =>
      _map(await _http.get('$_ops/stats'));

  /// Go online, offline or busy. Dispatch only offers work to an online
  /// agent, so this is what actually puts a driver on duty — reporting a
  /// position alone does not.
  Future<void> setAvailability(String availability) async {
    await _http.put('$_client/availability',
        body: {'availability': availability});
  }

  /// Report position. The one call that makes live tracking work.
  Future<void> updateLocation(
      {required double lat, required double lng, double? heading, double? speed}) async {
    await _http.put('$_client/location', body: {
      'lat': lat,
      'lng': lng,
      if (heading != null) 'heading': heading,
      if (speed != null) 'speed': speed,
    });
  }

  // ── Agent: the job lifecycle ────────────────────────────────────────────
  //
  // offer → accept | reject → assign
  //       → start-pickup  → arrive-pickup  → complete-pickup
  //       → start-dropoff → arrive-dropoff → complete-dropoff
  //       → complete | fail | cancel
  //
  // Each stage is a server call, so the server owns the state machine and the
  // app never advances a job locally.

  Future<Map<String, dynamic>> accept(String jobId) => _stage(jobId, 'accept');
  Future<Map<String, dynamic>> reject(String jobId, {String? reason}) =>
      _stage(jobId, 'reject', body: {if (reason != null) 'reason': reason});

  Future<Map<String, dynamic>> startPickup(String jobId) =>
      _stage(jobId, 'start-pickup');
  Future<Map<String, dynamic>> arrivePickup(String jobId) =>
      _stage(jobId, 'arrive-pickup');
  Future<Map<String, dynamic>> completePickup(String jobId,
          {Map<String, dynamic>? body}) =>
      _stage(jobId, 'complete-pickup', body: body);

  Future<Map<String, dynamic>> startDropoff(String jobId) =>
      _stage(jobId, 'start-dropoff');
  Future<Map<String, dynamic>> arriveDropoff(String jobId) =>
      _stage(jobId, 'arrive-dropoff');
  Future<Map<String, dynamic>> completeDropoff(String jobId,
          {Map<String, dynamic>? body}) =>
      _stage(jobId, 'complete-dropoff', body: body);

  Future<Map<String, dynamic>> complete(String jobId) =>
      _stage(jobId, 'complete');
  Future<Map<String, dynamic>> fail(String jobId, {String? reason}) =>
      _stage(jobId, 'fail', body: {if (reason != null) 'reason': reason});
  Future<Map<String, dynamic>> cancelJob(String jobId, {String? reason}) =>
      _stage(jobId, 'cancel', body: {if (reason != null) 'reason': reason});

  Future<Map<String, dynamic>> _stage(String jobId, String stage,
          {Map<String, dynamic>? body}) async =>
      _map(await _http.put('$_client/jobs/$jobId/$stage', body: body ?? const {}));

  // ── Operator: dispatch ──────────────────────────────────────────────────

  Future<Map<String, dynamic>> assign(String jobId, String agentId) async =>
      _map(await _http.put('$_ops/jobs/$jobId/assign', body: {'agentId': agentId}));

  Future<Map<String, dynamic>> offer(String jobId, List<String> agentIds) async =>
      _map(await _http.put('$_ops/jobs/$jobId/offer', body: {'agentIds': agentIds}));

  Future<Map<String, dynamic>> broadcast(String jobId) async =>
      _map(await _http.put('$_ops/jobs/$jobId/broadcast', body: const {}));

  Future<Map<String, dynamic>> alertAgents(String jobId) async =>
      _map(await _http.post('$_ops/jobs/$jobId/alert-agents', body: const {}));

  Future<Map<String, dynamic>> setPricing(
          String jobId, Map<String, dynamic> pricing) async =>
      _map(await _http.put('$_ops/jobs/$jobId/pricing', body: pricing));

  // ── In-job communication and proof ──────────────────────────────────────

  Future<List<Map<String, dynamic>>> messages(String jobId) async =>
      _records(await _http.get('$_client/jobs/$jobId/messages'));

  Future<Map<String, dynamic>> sendMessage(String jobId, String text) async =>
      _map(await _http.post('$_client/jobs/$jobId/messages', body: {'message': text}));

  Future<void> markMessagesRead(String jobId) async {
    await _http.put('$_client/jobs/$jobId/messages/read', body: const {});
  }

  Future<List<Map<String, dynamic>>> contacts(String jobId) async =>
      _records(await _http.get('$_client/jobs/$jobId/contacts'));

  /// Proof of pickup / delivery.
  Future<Map<String, dynamic>> addImage(
          String jobId, Map<String, dynamic> image) async =>
      _map(await _http.post('$_client/jobs/$jobId/images', body: image));

  Future<List<Map<String, dynamic>>> images(String jobId) async =>
      _records(await _http.get('$_client/jobs/$jobId/images'));

  // ── Issues ──────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> issues(String jobId) async =>
      _records(await _http.get('$_client/jobs/$jobId/issues'));

  Future<Map<String, dynamic>> raiseIssue(
          String jobId, Map<String, dynamic> issue) async =>
      _map(await _http.post('$_client/jobs/$jobId/issues', body: issue));

  Future<Map<String, dynamic>> escalateIssue(String jobId, String issueId) async =>
      _map(await _http.put('$_client/jobs/$jobId/issues/$issueId/escalate',
          body: const {}));

  Future<Map<String, dynamic>> resolveIssue(String jobId, String issueId,
          {String? note}) async =>
      _map(await _http.put('$_client/jobs/$jobId/issues/$issueId/resolve',
          body: {if (note != null) 'note': note}));

  // ── Money ───────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> paymentStatus(String jobId) async =>
      _map(await _http.get('$_client/jobs/$jobId/payment-status'));

  Future<Map<String, dynamic>> processPayment(String jobId,
          {Map<String, dynamic>? body}) async =>
      _map(await _http.post('$_client/jobs/$jobId/process-payment',
          body: body ?? const {}));

  Future<List<Map<String, dynamic>>> payments() async =>
      _records(await _http.get('$_client/payments'));

  Future<List<Map<String, dynamic>>> payouts() async =>
      _records(await _http.get('$_client/payouts'));

  Future<List<Map<String, dynamic>>> payoutMethods() async =>
      _records(await _http.get('$_client/payout-methods'));

  Future<Map<String, dynamic>> addPayoutMethod(
          Map<String, dynamic> method) async =>
      _map(await _http.post('$_client/payout-methods', body: method));

  Future<Map<String, dynamic>> setDefaultPayoutMethod(String methodId) async =>
      _map(await _http.put('$_client/payout-methods/$methodId/default',
          body: const {}));

  Future<void> deletePayoutMethod(String methodId) async {
    await _http.delete('$_client/payout-methods/$methodId');
  }

}

/// A priced quote, or the reason it could not be priced.
class QuoteResult {
  final bool valid;
  final String? quoteId;
  final DateTime? expiresAt;

  /// `{total, basePrice, currency}` as the server returned it.
  final Map<String, dynamic> pricing;

  /// `{distance, duration, routeSource}`.
  final Map<String, dynamic> tracking;

  /// Per-stop problems when [valid] is false: `{stopIndex, errors[]}`.
  final List<Map<String, dynamic>> errors;

  const QuoteResult({
    required this.valid,
    this.quoteId,
    this.expiresAt,
    this.pricing = const {},
    this.tracking = const {},
    this.errors = const [],
  });

  factory QuoteResult.fromJson(Map<String, dynamic> j) {
    final e = j['expiresAt'];
    return QuoteResult(
      valid: j['valid'] != false && j['quoteId'] != null,
      quoteId: j['quoteId']?.toString(),
      expiresAt: e == null ? null : DateTime.tryParse('$e'),
      pricing: j['pricing'] is Map
          ? Map<String, dynamic>.from(j['pricing'])
          : const {},
      tracking: j['tracking'] is Map
          ? Map<String, dynamic>.from(j['tracking'])
          : const {},
      errors: [
        for (final x in (j['errors'] as List? ?? const []))
          if (x is Map) Map<String, dynamic>.from(x),
      ],
    );
  }

  bool get expired =>
      expiresAt != null && DateTime.now().isAfter(expiresAt!);

  num? get total {
    final v = pricing['total'];
    return v is num ? v : num.tryParse('\$v');
  }

  /// The out-of-area reasons, as one readable sentence per stop.
  String get problem {
    if (errors.isEmpty) return "This delivery can't be priced.";
    return errors.map((e) {
      final i = e['stopIndex'];
      final list = (e['errors'] as List? ?? const []).join(', ');
      return i == null ? list : 'Stop \${(i as num).toInt() + 1}: \$list';
    }).join('\n');
  }
}

final logisticsApi = LogisticsApi();
