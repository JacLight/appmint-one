import 'http_client.dart';

/// The learning API — `/client/content-studio` for learners,
/// `/content-studio` for instructors.
///
/// Every path is a controller decorator in
/// `appengine/src/content-studio/content-studio-client.controller.ts` or
/// `content-studio.controller.ts`. Nothing here is invented.
///
/// Shape of a learner's journey: enroll on a course, walk its items, report
/// progress per item, answer the quiz items, and have the submission reviewed.
class LmsApi {
  static final LmsApi _instance = LmsApi._();
  factory LmsApi() => _instance;
  LmsApi._();

  final AppengineHttpClient _http = appengineHttpClient;

  static const _learner = '/client/content-studio';
  static const _admin = '/content-studio';

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : <String, dynamic>{};

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

  // ── Learner ─────────────────────────────────────────────────────────────

  /// Everything published that anyone may enrol on.
  ///
  /// Read through the site's own published-content route rather than a
  /// catalogue endpoint of its own: a course is a `post`, and this is how
  /// published posts are read for a site already. A caller who is not staff
  /// gets the public view of them.
  ///
  /// `data.course` is what marks a post as something people enrol in — the
  /// post model says so — so the filter is here rather than in a query only
  /// this app would use.
  Future<List<Map<String, dynamic>>> catalog({String? keyword}) async {
    final rows = _records(await _http.get('/site/page-data/post'));
    final want = (keyword ?? '').trim().toLowerCase();

    return [
      for (final row in rows)
        if (_isCourse(row) && (want.isEmpty || _matches(row, want)))
          _courseCard(row),
    ];
  }

  static bool _isCourse(Map<String, dynamic> row) {
    final data = row['data'];
    final d = data is Map ? data : row;
    return d['course'] != null;
  }

  static bool _matches(Map<String, dynamic> row, String want) {
    final data = row['data'];
    final d = data is Map ? data : row;
    return '${d['title'] ?? ''} ${d['summary'] ?? ''}'
        .toLowerCase()
        .contains(want);
  }

  /// Card facts only — the full outline comes from opening the course.
  static Map<String, dynamic> _courseCard(Map<String, dynamic> row) {
    final data = row['data'];
    final d = data is Map ? Map<String, dynamic>.from(data) : row;
    final pages = d['pages'];
    return {
      'id': '${row['sk'] ?? d['sk'] ?? ''}',
      'slug': d['slug'],
      'title': d['title'],
      'summary': d['summary'],
      'coverImage': d['coverImage'],
      'steps': pages is List ? pages.length : 0,
      'access': d['authenticationType'] ?? 'open',
    };
  }

  /// The courses this person is enrolled on, with their progress.
  Future<List<Map<String, dynamic>>> myCourses() async =>
      _records(await _http.get('$_learner/mine'));

  /// One course with its items. `course` is the course id or slug.
  Future<Map<String, dynamic>> course(String course) async =>
      _map(await _http.get('$_learner/$course'));

  /// What a course looks like before enrolling.
  Future<Map<String, dynamic>> preview(String course) async =>
      _map(await _http.get('$_learner/$course/preview'));

  Future<Map<String, dynamic>> enroll(String course,
          {Map<String, dynamic>? body}) async =>
      _map(await _http.post('$_learner/$course/enroll', body: body ?? const {}));

  /// One item — a lesson, a video, a quiz.
  Future<Map<String, dynamic>> item(String course, String itemId) async =>
      _map(await _http.get('$_learner/$course/items/$itemId'));

  /// Report progress through an item. The server owns completion; the app
  /// never decides locally that a lesson is done.
  Future<Map<String, dynamic>> reportProgress(String course, String itemId,
          {Map<String, dynamic>? body}) async =>
      _map(await _http.post('$_learner/$course/items/$itemId/progress',
          body: body ?? const {}));

  /// Submit an answer to a quiz or assessment item.
  Future<Map<String, dynamic>> answer(
          String course, String itemId, Map<String, dynamic> answer) async =>
      _map(await _http.post('$_learner/$course/items/$itemId/answer',
          body: answer));

  // ── Instructor / operator ───────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> enrollments(String course) async =>
      _records(await _http.get('$_admin/$course/enrollments'));

  Future<Map<String, dynamic>> enrollment(String id) async =>
      _map(await _http.get('$_admin/enrollments/$id'));

  Future<Map<String, dynamic>> addEnrollment(
          String course, Map<String, dynamic> body) async =>
      _map(await _http.post('$_admin/$course/enrollments', body: body));

  Future<Map<String, dynamic>> withdraw(String enrollmentId,
          {String? reason}) async =>
      _map(await _http.post('$_admin/enrollments/$enrollmentId/withdraw',
          body: {if (reason != null) 'reason': reason}));

  Future<Map<String, dynamic>> invite(
          String course, Map<String, dynamic> body) async =>
      _map(await _http.post('$_admin/$course/invite', body: body));

  /// Work waiting to be graded, across courses or for one course.
  Future<List<Map<String, dynamic>>> reviewQueue({String? course}) async =>
      _records(await _http
          .get(course == null ? '$_admin/review' : '$_admin/$course/review'));

  /// Grade one submitted item on one enrollment.
  Future<Map<String, dynamic>> review(
          String enrollmentId, String itemId, Map<String, dynamic> verdict) async =>
      _map(await _http.post('$_admin/enrollments/$enrollmentId/review/$itemId',
          body: verdict));

  /// Open or close a cohort — a scheduled run of the course.
  Future<Map<String, dynamic>> schedule(
          String course, Map<String, dynamic> body) async =>
      _map(await _http.post('$_admin/$course/schedule', body: body));

  Future<Map<String, dynamic>> unschedule(String course,
          {Map<String, dynamic>? body}) async =>
      _map(await _http.post('$_admin/$course/unschedule',
          body: body ?? const {}));

  /// A shareable key that lets someone preview a course without enrolling.
  Future<Map<String, dynamic>> previewKey(String course) async =>
      _map(await _http.post('$_admin/$course/preview-key', body: const {}));
}

final lmsApi = LmsApi();
