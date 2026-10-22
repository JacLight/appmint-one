import 'http_client.dart';

/// Buildings, units, leases, applications, requests and notices.
///
/// Nothing here is new backend: a building is a `stowbo_listing` (a tree, so a
/// building holds apartments and an apartment holds rooms), an apartment with a
/// door number is a `stowbo_unit`, a tenancy is a long-dated booking of one, a
/// repair is a `ticket`, an application is a CRM form submission, and a notice
/// is a `site_notice`. Every path below is a route that exists today — see
/// specs/05-property-leasing/README.md for the line numbers it was read from.
class PropertyApi {
  static final PropertyApi _instance = PropertyApi._();
  factory PropertyApi() => _instance;
  PropertyApi._();

  final AppengineHttpClient _http = appengineHttpClient;

  static const _client = '/client/stowbo';
  static const _host = '/client/stowbo/host';
  static const _me = '/client-data';
  static const _notice = '/notice';

  /// The CRM form a setup uses for its leasing application. The form itself is
  /// authored once in Studio; the app only submits to it, so changing the
  /// questions never ships an app build.
  static const applicationForm = 'rental-application';

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : <String, dynamic>{};

  /// A record as the server stores it — `{sk, data: {...}, createdate}` — read
  /// as one flat map, with the envelope's id and dates kept. Screens that had
  /// to know which fields live inside `data` would break the first time a
  /// collection was read through a different endpoint.
  Map<String, dynamic> _flat(dynamic r) {
    if (r is! Map) return <String, dynamic>{};
    final row = Map<String, dynamic>.from(r);
    final data = row['data'];
    if (data is! Map) return row;
    // Envelope first, then the record over it: anything the server attached
    // beside `data` — `paymentSummary` on a tenancy, for one — has to survive,
    // and dropping it is how a rent card ends up with nothing to show.
    final flat = <String, dynamic>{...row}..remove('data');
    flat.addAll(Map<String, dynamic>.from(data));
    for (final k in ['sk', 'pk', 'createdate', 'modifydate', 'datatype']) {
      if (row[k] != null) flat[k] = row[k];
    }
    return flat;
  }

  List<Map<String, dynamic>> _records(dynamic r) {
    dynamic list;
    if (r is List) {
      list = r;
    } else if (r is Map) {
      list = r['data'] ??
          r['items'] ??
          r['results'] ??
          r['rows'] ??
          r['listings'] ??
          r['units'] ??
          r['tickets'] ??
          r['notices'] ??
          r['bookings'] ??
          [];
    }
    if (list is! List) return [];
    return list.whereType<Map>().map(_flat).toList();
  }

  // ── Showcase: what is on offer ──────────────────────────────────────────
  //
  // The same browse a guest uses. Without dates it is a catalogue read, which
  // is exactly what touring apartments is.

  Future<List<Map<String, dynamic>>> browse({
    String? keyword,
    String? city,
    String? spaceType,
    double? lat,
    double? lng,
    double? radiusKm,
    int page = 1,
    int pageSize = 30,
  }) async =>
      _records(await _http.get('$_client/listings', queryParams: {
        'page': '$page',
        'pageSize': '$pageSize',
        if (keyword != null && keyword.isNotEmpty) 'keyword': keyword,
        if (city != null && city.isNotEmpty) 'city': city,
        if (spaceType != null && spaceType.isNotEmpty) 'spaceType': spaceType,
        if (lat != null) 'lat': '$lat',
        if (lng != null) 'lng': '$lng',
        if (radiusKm != null) 'radiusKm': '$radiusKm',
      }));

  Future<Map<String, dynamic>> listing(String id) async =>
      _flat(await _http.get('$_client/listings/$id'));

  Future<List<Map<String, dynamic>>> nearby(String id) async =>
      _records(await _http.get('$_client/listings/$id/nearby'));

  // ── Manager: the portfolio ──────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> portfolio() async =>
      _records(await _http.get('$_host/listings'));

  Future<Map<String, dynamic>> portfolioItem(String id) async =>
      _flat(await _http.get('$_host/listings/$id'));

  Future<List<Map<String, dynamic>>> units({String? listing}) async =>
      _records(await _http.get('$_host/units', queryParams: {
        if (listing != null && listing.isNotEmpty) 'listing': listing,
      }));

  Future<Map<String, dynamic>> updateUnit(
          String id, Map<String, dynamic> body) async =>
      _map(await _http.put('$_host/units/$id', body: body));

  Future<Map<String, dynamic>> occupancyNow(String listingId) async =>
      _map(await _http.get('$_host/listings/$listingId/occupancy-now'));

  /// The manager's day: arrivals, departures, overdue, open requests.
  Future<Map<String, dynamic>> today() async =>
      _map(await _http.get('$_host/today'));

  /// Tenancies on one building.
  Future<List<Map<String, dynamic>>> buildingTenancies(String listingId) async =>
      _records(await _http.get('$_host/listings/$listingId/bookings'));

  /// Every tenancy this manager holds — the lease book.
  Future<List<Map<String, dynamic>>> allTenancies({String? status}) async =>
      _records(await _http.get('$_host/bookings', queryParams: {
        if (status != null && status.isNotEmpty) 'status': status,
      }));

  /// Applications waiting on a decision.
  ///
  /// The staff list of form submissions, filtered to the application form.
  /// There is no host-scoped version of this and there should not be: a
  /// property manager IS the business, so they sign in as staff and read what
  /// staff read. Scoping to their own buildings is a filter on the rows, not
  /// a second API.
  Future<List<Map<String, dynamic>>> hostApplications({String? status}) async =>
      _records(await _http.get('/crm/forms/submissions', queryParams: {
        'formId': applicationForm,
        'pageSize': '100',
        if (status != null && status.isNotEmpty) 'status': status,
      }));

  /// Approve, decline or screen an application.
  ///
  /// A partial update on the submission itself — the decision, who made it and
  /// when. A decline carries its reason, because that is the part that gets
  /// asked about later.
  Future<Map<String, dynamic>> decideApplication(
    String id,
    String decision, {
    String reason = '',
  }) async =>
      _map(await _http.post('/repository/update-partial/form_submission/$id',
          body: {
            'data.status': decision,
            'data.decision': decision,
            if (reason.isNotEmpty) 'data.decisionReason': reason,
            'data.decidedAt': DateTime.now().toIso8601String(),
          }));

  /// Every request raised, as staff see them.
  ///
  /// `client-data/tickets` is the resident's own; this is the whole queue.
  /// Rows are filtered to the manager's buildings in the app, on the
  /// `building` and `unit` the resident's app sends with each one.
  Future<List<Map<String, dynamic>>> hostRequests({String? status}) async =>
      _records(await _http.get('/crm/tickets/list', queryParams: {
        'pageSize': '100',
        if (status != null && status.isNotEmpty) 'status': status,
      }));

  /// Move a request on: pick up, start, block, close, assign.
  Future<Map<String, dynamic>> hostUpdateRequest(
    String id, {
    String? status,
    String? assignTo,
    String? resolutionSummary,
  }) async =>
      _map(await _http.post('/crm/tickets/update', body: {
        'sk': id,
        'data': {
          if (status != null) 'status': status,
          if (assignTo != null) 'assignTo': assignTo,
          if (resolutionSummary != null)
            'resolution': {'summary': resolutionSummary},
        },
      }));

  /// Notices this organization has posted.
  Future<List<Map<String, dynamic>>> hostAnnouncements() async =>
      _records(await _http.post('/repository/search/site_notice', body: {
        'query': {},
        'options': {'pageSize': 100, 'sort': 'createdate', 'sortType': -1},
      }));

  /// Post a notice.
  ///
  /// A plain record create — `site_notice` is what the resident feed reads,
  /// so a notice posted here is the same object the web console posts.
  /// `listing` scopes it to one building and the app filters on it; making
  /// that scope authoritative means teaching `notice.query` about it.
  Future<Map<String, dynamic>> announce(Map<String, dynamic> body) async =>
      _map(await _http.post('/repository/create', body: {
        'datatype': 'site_notice',
        'isNew': true,
        'data': body,
      }));

  // ── Resident: my tenancy ────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> myTenancies() async =>
      _records(await _http.get('$_client/bookings'));

  Future<Map<String, dynamic>> tenancy(String id) async =>
      _flat(await _http.get('$_client/bookings/$id'));

  /// What this tenancy owes right now, from the booking's own ledger.
  Future<Map<String, dynamic>> tenancyTimeline(String id) async =>
      _map(await _http.get('$_client/bookings/$id/timeline'));

  Future<Map<String, dynamic>> payTenancy(
          String id, Map<String, dynamic> body) async =>
      _map(await _http.post('$_client/bookings/$id/settle-payment', body: body));

  Future<List<Map<String, dynamic>>> paymentMethods() async =>
      _records(await _http.get('$_me/payment-methods'));

  // ── Requests (repairs) ──────────────────────────────────────────────────
  //
  // `ticket`: new | open | pending | inprogress | blocked | done | canceled,
  // priority low | medium | high | urgent. The SLA clock is computed from
  // these plus the record's own dates — see config/sla_policy.dart.

  Future<List<Map<String, dynamic>>> requests({String? status}) async =>
      _records(await _http.get('$_me/tickets', queryParams: {
        'enrich': 'true',
        if (status != null && status.isNotEmpty) 'status': status,
      }));

  Future<Map<String, dynamic>> request(String ticketNumber) async {
    final r = await _http.get('$_me/tickets/$ticketNumber');
    // The endpoint answers with the same shape as the list, filtered to one.
    final rows = _records(r);
    if (rows.isNotEmpty) return rows.first;
    return _flat(r);
  }

  Future<Map<String, dynamic>> createRequest({
    required String title,
    required String description,
    required String priority,
    required String reportedBy,
    required String reportedByEmail,
    String? reportedByPhone,
    String? unit,
    String? building,
    bool mayEnter = false,
    String? access,
  }) async =>
      _map(await _http.post('$_me/tickets', body: {
        'title': title,
        'description': description,
        'priority': priority,
        'status': 'new',
        'channel': 'mobile',
        'reportedBy': reportedBy,
        'reportedByEmail': reportedByEmail,
        if (reportedByPhone != null && reportedByPhone.isNotEmpty)
          'reportedByPhone': reportedByPhone,
        // Where the work is. A repair ticket with no door number is a phone
        // call waiting to happen.
        if (unit != null && unit.isNotEmpty) 'unit': unit,
        if (building != null && building.isNotEmpty) 'building': building,
        'mayEnter': mayEnter,
        if (access != null && access.isNotEmpty) 'access': access,
      }));

  Future<Map<String, dynamic>> updateRequest(Map<String, dynamic> body) async =>
      _map(await _http.put('$_me/tickets', body: body));

  // ── Notices ─────────────────────────────────────────────────────────────
  //
  // The inbox reports suppression instead of applying it, so a notice can be
  // read again after it was dealt with — which is what a noticeboard is.

  Future<Map<String, dynamic>> noticeInbox() async =>
      _map(await _http.get('$_notice/inbox'));

  Future<void> noticeSeen(String id) async {
    await _http.post('$_notice/$id/display', body: const {});
  }

  /// "I have read this" — the one thing a building notice needs and a banner
  /// does not.
  Future<void> acknowledgeNotice(String id) async {
    await _http.post('$_notice/$id/accept', body: const {});
  }

  Future<void> dismissNotice(String id) async {
    await _http.post('$_notice/$id/dismiss', body: const {});
  }

  // ── Applications ────────────────────────────────────────────────────────

  /// The form definition, so the app shows the questions this business asks.
  Future<Map<String, dynamic>> applicationFormDefinition(
          {String form = applicationForm}) async =>
      _map(await _http.get('/client/forms/$form'));

  Future<Map<String, dynamic>> submitApplication(
          Map<String, dynamic> answers, {String form = applicationForm}) async =>
      _map(await _http.post('/client/forms/$form/submit', body: answers));

  /// What I have applied for, and anything still waiting on my signature.
  Future<List<Map<String, dynamic>>> myApplications() async =>
      _records(await _http.get('$_me/forms'));
}

final propertyApi = PropertyApi();
