import 'package:flutter/foundation.dart';

import '../config/setup.dart';
import '../config/sla_policy.dart';
import '../services/payment_service.dart';
import '../services/property_api.dart';
import '../services/stripe_service.dart';

/// The resident's side: where I live, what I owe, what I have asked for, what
/// the building has told me.
class TenancyProvider extends ChangeNotifier {
  final PropertyApi _api = propertyApi;

  List<Map<String, dynamic>> _tenancies = const [];
  List<Map<String, dynamic>> _requests = const [];
  List<Map<String, dynamic>> _notices = const [];
  List<Map<String, dynamic>> _applications = const [];
  int _unread = 0;

  bool _loading = false;
  String? _error;

  /// Reads that failed while the screen still has something to show. Kept
  /// per-section so a notices outage does not hide the rent.
  final Map<String, String> _partial = {};

  List<Map<String, dynamic>> get tenancies => _tenancies;
  List<Map<String, dynamic>> get requests => _requests;
  List<Map<String, dynamic>> get notices => _notices;
  List<Map<String, dynamic>> get applications => _applications;
  int get unreadNotices => _unread;
  bool get loading => _loading;
  String? get error => _error;
  String? partialError(String section) => _partial[section];

  /// The tenancy being lived in now: the one that has not ended, else the
  /// most recent. A resident with two is a resident with two homes, and the
  /// home screen says which it is showing.
  Map<String, dynamic>? get current {
    if (_tenancies.isEmpty) return null;
    final now = DateTime.now();
    for (final t in _tenancies) {
      final end = DateTime.tryParse('${t['endDate'] ?? t['end'] ?? ''}');
      final status = '${t['status'] ?? ''}'.toLowerCase();
      if (status == 'cancelled' || status == 'canceled') continue;
      if (end == null || end.isAfter(now)) return t;
    }
    return _tenancies.first;
  }

  /// The building this resident lives in, by listing name.
  String get _myBuilding {
    final home = current;
    if (home == null) return '';
    final items = home['items'];
    if (items is List) {
      for (final i in items) {
        if (i is Map) {
          final name = '${i['listing'] ?? ''}'.trim();
          if (name.isNotEmpty) return name;
        }
      }
    }
    return '${home['listing'] ?? ''}'.trim();
  }

  /// Open requests, worst clock first — the same order the manager sees.
  List<Map<String, dynamic>> get openRequests {
    final open = [
      for (final r in _requests)
        if (!SlaPolicy.closed('${r['status'] ?? ''}')) r,
    ];
    open.sort(_byClock);
    return open;
  }

  List<Map<String, dynamic>> get closedRequests => [
        for (final r in _requests)
          if (SlaPolicy.closed('${r['status'] ?? ''}')) r,
      ];

  static int _byClock(Map<String, dynamic> a, Map<String, dynamic> b) {
    final ca = SlaClock.of(a), cb = SlaClock.of(b);
    final byRank = ca.rank.compareTo(cb.rank);
    if (byRank != 0) return byRank;
    final ra = ca.remaining, rb = cb.remaining;
    if (ra == null || rb == null) return 0;
    return ra.compareTo(rb);
  }

  Future<void> load() async {
    _loading = true;
    _error = null;
    _partial.clear();
    notifyListeners();

    // Four independent reads. One failing must not blank the other three —
    // a resident whose notices are down still needs to pay rent.
    try {
      _tenancies = await _api.myTenancies();
    } catch (e) {
      _partial['tenancy'] = _say(e);
    }
    try {
      _requests = await _api.requests();
    } catch (e) {
      _partial['requests'] = _say(e);
    }
    try {
      final inbox = await _api.noticeInbox();
      final raw = inbox['notices'];
      final all = raw is List
          ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : <Map<String, dynamic>>[];
      // A notice posted to one building must not read as everyone's. The
      // server sends the lot — `notice/inbox` filters by site, and does not
      // know about `listing` yet — so the filter is here. Known limit, written
      // down in specs/05-property-leasing/README.md: when a notice ever
      // carries something that is not for every resident, the scope has to
      // become the server's.
      final mine = _myBuilding;
      _notices = mine.isEmpty
          ? all
          : [
              for (final n in all)
                if ('${n['listing'] ?? ''}'.isEmpty ||
                    '${n['listing']}' == mine)
                  n,
            ];
      final u = inbox['unread'];
      _unread = u is num ? u.toInt() : int.tryParse('$u') ?? 0;
    } catch (e) {
      _partial['notices'] = _say(e);
    }
    try {
      _applications = await _api.myApplications();
    } catch (e) {
      _partial['applications'] = _say(e);
    }

    // Everything failed: that is one problem, not four, and it is almost
    // always the connection or the credential.
    if (_partial.length == 4) _error = _partial.values.first;

    _loading = false;
    notifyListeners();
  }

  Future<String?> raiseRequest({
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
  }) async {
    try {
      await _api.createRequest(
        title: title,
        description: description,
        priority: priority,
        reportedBy: reportedBy,
        reportedByEmail: reportedByEmail,
        reportedByPhone: reportedByPhone,
        unit: unit,
        building: building,
        mayEnter: mayEnter,
        access: access,
      );
      try {
        _requests = await _api.requests();
        notifyListeners();
      } catch (_) {}
      return null;
    } catch (e) {
      return _say(e);
    }
  }

  Future<String?> acknowledge(String noticeId) async {
    try {
      await _api.acknowledgeNotice(noticeId);
      // Mark it here too, so the list answers immediately instead of waiting
      // on a round trip to tell the resident what they just did.
      _notices = [
        for (final n in _notices)
          if ('${n['id'] ?? n['sk'] ?? ''}' == noticeId)
            {
              ...n,
              'viewer': {
                ...(n['viewer'] is Map ? Map<String, dynamic>.from(n['viewer']) : {}),
                'status': 'accepted',
                'read': true,
              },
            }
          else
            n,
      ];
      if (_unread > 0) _unread--;
      notifyListeners();
      return null;
    } catch (e) {
      return _say(e);
    }
  }

  /// Pay what is owed on a tenancy: the same intent → sheet → settle path the
  /// rest of the app uses, so rent cannot drift from how everything else is
  /// paid. Returns the amount taken, or null when the sheet was dismissed.
  bool _paying = false;
  bool get paying => _paying;

  Future<double?> payRent({String? email}) async {
    final home = current;
    if (home == null || kIsWeb) return null;
    final summary = home['paymentSummary'];
    final bal = summary is Map ? summary['balance'] : null;
    final amount = bal is num ? bal.toDouble() : 0.0;
    if (amount <= 0.004) return null;
    final id = '${home['sk'] ?? home['name'] ?? ''}';
    if (id.isEmpty) return null;

    _paying = true;
    _error = null;
    notifyListeners();
    try {
      await StripeService.initialize();
      final intent = await paymentService.createPaymentIntent(
        amount: amount,
        currency: '${summary is Map ? summary['currency'] ?? 'usd' : 'usd'}'
            .toLowerCase(),
        referenceId: id,
        email: email,
      );
      final clientSecret =
          '${intent['clientSecret'] ?? intent['client_secret'] ?? ''}';
      if (clientSecret.isEmpty) throw Exception('Payment setup failed');
      final pk = '${intent['publishableKey'] ?? ''}';
      if (pk.isNotEmpty) await StripeService.setPublishableKey(pk);
      final ok = await StripeService.presentPaymentSheet(
        clientSecret: clientSecret,
        merchantDisplayName: CurrentSetup.brand.name,
      );
      if (!ok) {
        _paying = false;
        notifyListeners();
        return null;
      }
      final intentId = clientSecret.contains('_secret')
          ? clientSecret.split('_secret').first
          : clientSecret;
      await _api.payTenancy(id, {'paymentIntentId': intentId});
      await load();
      _paying = false;
      notifyListeners();
      return amount;
    } catch (e) {
      final msg = '$e';
      _paying = false;
      if (msg.toLowerCase().contains('cancel')) {
        notifyListeners();
        return null;
      }
      _error = _say(e);
      notifyListeners();
      return null;
    }
  }

  Future<String?> submitApplication(Map<String, dynamic> answers) async {
    try {
      await _api.submitApplication(answers);
      try {
        _applications = await _api.myApplications();
        notifyListeners();
      } catch (_) {}
      return null;
    } catch (e) {
      return _say(e);
    }
  }

  String _say(Object e) => e.toString().replaceAll('Exception: ', '');
}
