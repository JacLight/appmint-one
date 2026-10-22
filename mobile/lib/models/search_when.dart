import 'package:intl/intl.dart';

/// What the guest is storing *and for how long* — the one thing that flows from
/// search → listing → checkout so availability is always checked for the same
/// window the guest actually meant.
///
///  • [openEnded] = "right now, today" — drop a car or a bag for an event and
///    grab it later; billed for the actual time held (a nominal window only
///    reserves capacity).
///  • date range = "while I travel" — an explicit start → end, Airbnb-style.
class SearchWhen {
  final bool openEnded;
  final DateTime start;
  final DateTime? end; // required when !openEnded

  const SearchWhen({required this.openEnded, required this.start, this.end});

  factory SearchWhen.nowToday() =>
      SearchWhen(openEnded: true, start: DateTime.now());

  factory SearchWhen.dates(DateTime start, DateTime end) =>
      SearchWhen(openEnded: false, start: start, end: end);

  /// The window's end for a capacity/quote check. Open-ended stays report a
  /// short nominal window (the server settles real duration at pickup).
  DateTime effectiveEnd(Duration nominal) =>
      openEnded ? start.add(nominal) : (end ?? start.add(nominal));

  SearchWhen copyWith({bool? openEnded, DateTime? start, DateTime? end}) =>
      SearchWhen(
        openEnded: openEnded ?? this.openEnded,
        start: start ?? this.start,
        end: end ?? this.end,
      );

  static final _md = DateFormat('MMM d');

  /// Short label for pills/chips: "Today · now" or "Aug 26 – Aug 29".
  String get summary {
    if (openEnded) return 'Today · now';
    final e = end;
    if (e == null) return _md.format(start);
    return '${_md.format(start)} – ${_md.format(e)}';
  }

  int get nights =>
      (end == null) ? 0 : end!.difference(start).inDays.clamp(0, 3650);
}
