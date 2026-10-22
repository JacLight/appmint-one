/// How fast a request has to be answered, and how fast fixed.
///
/// The clock is real: it runs on the record's own server timestamps. The
/// targets are the business's policy, declared here because a target that
/// lives in the app can be argued with — a tenant reads "response due in 40
/// minutes" and a manager reads the same number off the same record.
///
/// Where this must go next: the targets belong on the org as config so Studio,
/// web and mobile cannot disagree, and a breach has to raise a notification
/// server-side rather than only going red on a screen somebody has open. That
/// is written up in specs/05-property-leasing/README.md; until then this is
/// the single place the policy is stated, not seven screens' worth of guesses.
class SlaTarget {
  /// Acknowledge: somebody has taken it.
  final Duration respond;

  /// Done: the work is finished.
  final Duration resolve;
  final String label;
  final String meaning;

  const SlaTarget({
    required this.respond,
    required this.resolve,
    required this.label,
    required this.meaning,
  });
}

/// Habitability first. "No heat in January" and "a cupboard door is loose" are
/// not the same request, and a queue that treats them alike is how a building
/// ends up in court.
abstract final class SlaPolicy {
  static const Map<String, SlaTarget> targets = {
    'urgent': SlaTarget(
      respond: Duration(hours: 1),
      resolve: Duration(hours: 24),
      label: 'Emergency',
      meaning: 'No heat, no water, flooding, gas, fire, no way to lock up',
    ),
    'high': SlaTarget(
      respond: Duration(hours: 4),
      resolve: Duration(days: 3),
      label: 'Urgent',
      meaning: 'One appliance down, a leak that is contained, no hot water',
    ),
    'medium': SlaTarget(
      respond: Duration(hours: 24),
      resolve: Duration(days: 7),
      label: 'Routine',
      meaning: 'Something is broken but the home still works',
    ),
    'low': SlaTarget(
      respond: Duration(days: 2),
      resolve: Duration(days: 14),
      label: 'When you can',
      meaning: 'Cosmetic, or it can wait for the next visit',
    ),
  };

  static SlaTarget forPriority(String? priority) =>
      targets[(priority ?? 'medium').toLowerCase().trim()] ??
      targets['medium']!;

  static const List<String> priorities = ['urgent', 'high', 'medium', 'low'];

  /// A request that has been answered is past its response target; one that is
  /// finished is past both.
  static const Set<String> _answered = {
    'open',
    'pending',
    'inprogress',
    'blocked',
    'done',
    'canceled',
  };
  static const Set<String> _closed = {'done', 'canceled'};

  static bool answered(String? status) =>
      _answered.contains((status ?? '').toLowerCase().trim());
  static bool closed(String? status) =>
      _closed.contains((status ?? '').toLowerCase().trim());
}

/// What a request's clock says right now. One object so the resident's card
/// and the manager's queue cannot describe the same ticket differently.
class SlaClock {
  final SlaTarget target;

  /// Which target is running: response, resolution, or neither (closed).
  final bool onResponse;
  final bool finished;

  /// When the running target falls due. Null when the record carries no
  /// usable timestamp — in which case nothing is claimed about it.
  final DateTime? due;
  final DateTime? opened;

  const SlaClock({
    required this.target,
    required this.onResponse,
    required this.finished,
    this.due,
    this.opened,
  });

  static DateTime? _date(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v.toLocal();
    return DateTime.tryParse('$v')?.toLocal();
  }

  /// Reads a request record as the server returns it.
  factory SlaClock.of(Map<String, dynamic> request) {
    final target = SlaPolicy.forPriority('${request['priority'] ?? ''}');
    final status = '${request['status'] ?? ''}';
    final opened = _date(request['createdate'] ?? request['createdAt']);
    final finished = SlaPolicy.closed(status);
    final onResponse = !SlaPolicy.answered(status);

    DateTime? due;
    if (opened != null && !finished) {
      due = opened.add(onResponse ? target.respond : target.resolve);
    }
    return SlaClock(
      target: target,
      onResponse: onResponse,
      finished: finished,
      due: due,
      opened: opened,
    );
  }

  Duration? get remaining {
    final d = due;
    if (d == null) return null;
    return d.difference(DateTime.now());
  }

  bool get breached {
    final r = remaining;
    return r != null && r.isNegative;
  }

  /// True in the last fifth of the window — the point at which a queue should
  /// start shouting rather than report a breach after the fact.
  bool get closeToBreach {
    final r = remaining;
    if (r == null || r.isNegative) return false;
    final window = onResponse ? target.respond : target.resolve;
    return r.inSeconds <= window.inSeconds ~/ 5;
  }

  String get what => onResponse ? 'Response' : 'Fix';

  /// "Response due in 40m", "Fix overdue by 2d", "Resolved".
  String get line {
    if (finished) return 'Closed';
    final r = remaining;
    if (r == null) return '$what target ${_short(onResponse ? target.respond : target.resolve)}';
    if (r.isNegative) return '$what overdue by ${_short(-r)}';
    return '$what due in ${_short(r)}';
  }

  static String _short(Duration d) {
    if (d.inDays >= 1) {
      final h = d.inHours % 24;
      return h == 0 ? '${d.inDays}d' : '${d.inDays}d ${h}h';
    }
    if (d.inHours >= 1) {
      final m = d.inMinutes % 60;
      return m == 0 ? '${d.inHours}h' : '${d.inHours}h ${m}m';
    }
    if (d.inMinutes >= 1) return '${d.inMinutes}m';
    return 'moments';
  }

  /// Sort key for the manager's queue: breached first, then nearest due, then
  /// anything with no clock, then closed.
  int get rank {
    if (finished) return 3;
    final r = remaining;
    if (r == null) return 2;
    return r.isNegative ? 0 : 1;
  }
}
