import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import 'booking_dashboard_screen.dart';
import 'host_addons_screen.dart';
import 'host_fees_screen.dart';
import 'host_units_screen.dart';
import 'host_reserve_screen.dart';

/// A space's 360° management view — the occupancy calendar (per unit + per day),
/// its bookings, and quick access to units. The grid is server-computed.
class SpaceDashboardScreen extends StatefulWidget {
  final StowboHost host;
  const SpaceDashboardScreen({super.key, required this.host});
  @override
  State<SpaceDashboardScreen> createState() => _SpaceDashboardScreenState();
}

class _SpaceDashboardScreenState extends State<SpaceDashboardScreen> {
  final _api = stowboApi;
  Map<String, dynamic>? _cal;
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = true;
  String? _error;

  late String _status = widget.host.status;
  bool get _paused => _status == 'paused' || _status == 'inactive';

  // The calendar window — movable, not a fixed "next 28 days".
  static const int _days = 14;
  late DateTime _from = _startOfToday();
  static DateTime _startOfToday() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  static const double _cellH = 38;
  static const double _cellW = 40;
  static const double _labelW = 96;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.hostCalendar(widget.host.sk,
            from: _from.toIso8601String(), days: _days),
        _api.hostListingBookings(widget.host.sk),
      ]);
      _cal = results[0] as Map<String, dynamic>;
      _bookings = results[1] as List<Map<String, dynamic>>;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _onListingAction(String action) async {
    switch (action) {
      case 'edit':
        await _editListing();
        break;
      case 'toggle':
        await _togglePause();
        break;
      case 'delete':
        await _deleteListing();
        break;
    }
  }

  Future<void> _togglePause() async {
    final next = _paused ? 'active' : 'paused';
    try {
      await _api.setListingStatus(widget.host.sk, next);
      if (!mounted) return;
      setState(() => _status = next);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(next == 'paused'
              ? 'Listing paused — no new bookings'
              : 'Listing active'),
          backgroundColor: SColors.green));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: SColors.danger));
      }
    }
  }

  Future<void> _deleteListing() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Delete this listing?'),
        content: Text(
            '“${widget.host.name}” will be removed. This can\'t be undone. '
            'Bookings in progress will block the delete.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete',
                  style: TextStyle(color: SColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.deleteListing(widget.host.sk);
      if (!mounted) return;
      Navigator.pop(context, true); // back to the listings list (it reloads)
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Listing deleted'), backgroundColor: SColors.green));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: SColors.danger));
      }
    }
  }

  /// Compact edit of the fields a host changes most — title, rate, capacity,
  /// access hours. Persists via updateListing (PUT).
  Future<void> _editListing() async {
    final name = TextEditingController(text: widget.host.name);
    final rate = TextEditingController(
        text: widget.host.ratePerHour > 0
            ? widget.host.ratePerHour.toStringAsFixed(2)
            : '');
    final cap = TextEditingController(text: '${widget.host.capacity}');
    final hours = TextEditingController(text: widget.host.hours);
    String? err;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.fromLTRB(SSpace.xl, SSpace.xl, SSpace.xl,
              SSpace.xl + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Edit listing', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: SSpace.md),
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Name')),
              const SizedBox(height: SSpace.sm),
              Row(children: [
                Expanded(
                  // A band-priced listing ("$4 / day per item", "$20 / week")
                  // is priced by its rate schedule; the flat legacy price is
                  // ignored by the quote engine, so don't offer to edit it.
                  child: widget.host.hasRateBands
                      ? TextField(
                          enabled: false,
                          controller: TextEditingController(
                              text: widget.host.priceLabel),
                          decoration: const InputDecoration(
                              labelText: 'Rate (from rate schedule)'))
                      : TextField(
                          controller: rate,
                          keyboardType:
                              const TextInputType.numberWithOptions(
                                  decimal: true),
                          decoration: InputDecoration(
                              labelText: 'Rate / ${widget.host.priceUnit}',
                              prefixText: '\$ ')),
                ),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: TextField(
                      controller: cap,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Capacity')),
                ),
              ]),
              const SizedBox(height: SSpace.sm),
              TextField(
                  controller: hours,
                  decoration:
                      const InputDecoration(labelText: 'Access hours')),
              if (err != null) ...[
                const SizedBox(height: SSpace.sm),
                Text(err!,
                    style:
                        const TextStyle(color: SColors.danger, fontSize: 13)),
              ],
              const SizedBox(height: SSpace.lg),
              ElevatedButton(
                onPressed: () {
                  if (name.text.trim().isEmpty) {
                    setS(() => err = 'Name can\'t be empty.');
                    return;
                  }
                  Navigator.pop(ctx, true);
                },
                child: const Text('Save'),
              ),
            ],
          ),
        ),
      ),
    );
    if (ok != true) return;
    final patch = <String, dynamic>{
      'title': name.text.trim(),
      'name': name.text.trim(),
      if (!widget.host.hasRateBands &&
          double.tryParse(rate.text.trim()) != null)
        'price': double.parse(rate.text.trim()),
      if (int.tryParse(cap.text.trim()) != null)
        'capacity': int.parse(cap.text.trim()),
      'accessHours': hours.text.trim(),
    };
    try {
      await _api.updateListing(widget.host.sk, patch);
      if (!mounted) return;
      await _load();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Listing updated'), backgroundColor: SColors.green));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: SColors.danger));
      }
    }
  }

  List _byUnit() => (_cal?['byUnit'] is List) ? _cal!['byUnit'] as List : const [];
  List _capacityByDay() =>
      (_cal?['capacityByDay'] is List) ? _cal!['capacityByDay'] as List : const [];

  Color _stateColor(String s) {
    switch (s) {
      case 'booked':
        return SColors.clay;
      case 'stored':
        return SColors.green;
      case 'overdue':
        return SColors.danger;
      case 'blocked':
        return SColors.ink2;
      default:
        return SColors.paper2; // free
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'space_reserve',
        onPressed: () async {
          final made = await Navigator.push<bool>(
            context,
            MaterialPageRoute(
                builder: (_) =>
                    HostReserveScreen(initialListing: widget.host.sk)),
          );
          if (made == true) _load();
        },
        backgroundColor: SColors.clay,
        icon: const Icon(Icons.event_available_rounded, color: Colors.white),
        label: const Text('Reserve',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      appBar: AppBar(
        title: Text(widget.host.name),
        actions: [
          IconButton(
              tooltip: 'Units',
              icon: const Icon(Icons.grid_view_rounded),
              onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) =>
                            HostUnitsScreen(host: widget.host)),
                  )),
          IconButton(
              tooltip: 'Add-ons',
              icon: const Icon(Icons.extension_rounded),
              onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) =>
                            HostAddonsScreen(host: widget.host)),
                  )),
          IconButton(
              tooltip: 'Fees',
              icon: const Icon(Icons.receipt_long_rounded),
              onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => HostFeesScreen(host: widget.host)),
                  )),
          IconButton(
              icon: const Icon(Icons.refresh_rounded), onPressed: _load),
          PopupMenuButton<String>(
            tooltip: 'Listing actions',
            onSelected: _onListingAction,
            itemBuilder: (_) => [
              const PopupMenuItem(
                  value: 'edit', child: Text('Edit details')),
              PopupMenuItem(
                  value: 'toggle',
                  child: Text(_paused ? 'Activate listing' : 'Pause listing')),
              const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete listing',
                      style: TextStyle(color: SColors.danger))),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : _cal == null
              ? EmptyState(
                  icon: Icons.event_busy_rounded,
                  title: "Couldn't load calendar",
                  subtitle: _error,
                  action: OutlinedButton(
                      onPressed: _load, child: const Text('Retry')))
              : RefreshIndicator(
                  color: SColors.clay,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(SSpace.lg),
                    children: [
                      _overview(),
                      const SizedBox(height: SSpace.lg),
                      _calendarHeader(),
                      const SizedBox(height: SSpace.sm),
                      _calendar(),
                      const SizedBox(height: SSpace.md),
                      _legend(),
                      const SizedBox(height: SSpace.xl),
                      SectionLabel('Bookings · ${_bookings.length}'),
                      ..._bookings.map(_bookingRow),
                      const SizedBox(height: SSpace.xxl),
                    ],
                  ),
                ),
    );
  }

  Widget _overview() {
    final h = widget.host;
    final cap = (_cal?['capacity'] as num?)?.toInt() ?? h.capacity;
    // Live occupancy — the number the operator kept looking for. Today's row is
    // the first in the window (window starts at today).
    final capDays = _capacityByDay();
    final today = capDays.isNotEmpty ? (capDays.first as Map) : const {};
    final usedToday = (today['used'] as num?)?.toInt() ?? 0;
    final capToday = (today['capacity'] as num?)?.toInt() ?? cap;
    final frac = capToday > 0 ? (usedToday / capToday).clamp(0.0, 1.0) : 0.0;
    final full = capToday > 0 && usedToday >= capToday;
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Paused is a state the operator must be able to SEE, not just a
          // flipped menu label.
          if (_paused) ...[
            const PausedTag(full: true),
            const SizedBox(height: SSpace.md),
          ],
          Row(children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                  color: SColors.greenSoft,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: const Icon(Icons.storefront_rounded, color: SColors.green),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(h.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  Text('${h.kind} · cap $cap · ${h.priceLabel}',
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 13)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: SSpace.md),
          // In custody today, live.
          Row(children: [
            Text('$usedToday',
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                    color: full ? SColors.danger : SColors.clay)),
            Text(' / $capToday in custody ${_dayLabel()}',
                style: const TextStyle(color: SColors.muted, fontSize: 13)),
            const Spacer(),
            Text('${(frac * 100).round()}%',
                style: const TextStyle(
                    color: SColors.faint,
                    fontWeight: FontWeight.w700,
                    fontSize: 12)),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: frac,
              minHeight: 8,
              backgroundColor: SColors.paper2,
              color: full ? SColors.danger : SColors.clay,
            ),
          ),
        ],
      ),
    );
  }

  static const _mo = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  /// The big number tracks the window's first day — say which day that is.
  String _dayLabel() => _from == _startOfToday()
      ? 'today'
      : 'on ${_mo[_from.month]} ${_from.day}';

  // ── window header: move the range, jump back to today ──────────────────────
  Widget _calendarHeader() {
    final end = _from.add(const Duration(days: _days - 1));
    const mo = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final label =
        '${mo[_from.month]} ${_from.day} – ${mo[end.month]} ${end.day}';
    final isToday = _from == _startOfToday();
    return Row(children: [
      const Text('OCCUPANCY',
          style: TextStyle(
              color: SColors.faint,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8)),
      const Spacer(),
      IconButton(
        visualDensity: VisualDensity.compact,
        tooltip: 'Earlier',
        icon: const Icon(Icons.chevron_left_rounded, size: 22),
        onPressed: () => _shiftWindow(-_days),
      ),
      GestureDetector(
        onTap: _pickFrom,
        child: Text(label,
            style: const TextStyle(
                fontWeight: FontWeight.w700, fontSize: 13)),
      ),
      IconButton(
        visualDensity: VisualDensity.compact,
        tooltip: 'Later',
        icon: const Icon(Icons.chevron_right_rounded, size: 22),
        onPressed: () => _shiftWindow(_days),
      ),
      if (!isToday)
        TextButton(
          onPressed: () {
            setState(() => _from = _startOfToday());
            _load();
          },
          style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.sm),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap),
          child: const Text('Today'),
        ),
    ]);
  }

  void _shiftWindow(int deltaDays) {
    setState(() => _from = _from.add(Duration(days: deltaDays)));
    _load();
  }

  Future<void> _pickFrom() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _from,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() => _from = DateTime(picked.year, picked.month, picked.day));
    _load();
  }

  /// Tap a day → the bookings occupying it. The number was dead before.
  void _showDay(String? iso) {
    final day = DateTime.tryParse(iso ?? '')?.toLocal();
    if (day == null) return;
    final dayStart = DateTime(day.year, day.month, day.day);
    final dayEnd = dayStart.add(const Duration(days: 1));
    bool covers(Map line) {
      final s = DateTime.tryParse('${line['startDate'] ?? ''}');
      if (s == null || !s.toLocal().isBefore(dayEnd)) return false;
      final e = DateTime.tryParse('${line['endDate'] ?? ''}');
      if (e == null) return true; // open stay
      return !e.toLocal().isBefore(dayStart);
    }

    final matches = _bookings.where((rec) {
      final data = (rec['data'] is Map) ? rec['data'] as Map : rec;
      final items = (data['items'] is List) ? data['items'] as List : const [];
      final status = (data['status'] ?? '').toString();
      if (['cancelled', 'settled'].contains(status)) return false;
      return items.any((l) => l is Map && covers(l));
    }).toList();

    const mo = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    showModalBottomSheet(
      context: context,
      backgroundColor: SColors.paper,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${mo[day.month]} ${day.day} · ${matches.length} '
                  '${matches.length == 1 ? 'booking' : 'bookings'}',
                  style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.md),
              if (matches.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: SSpace.lg),
                  child: Text('Nothing in custody this day.',
                      style: TextStyle(color: SColors.muted)),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 380),
                  child: ListView(
                    shrinkWrap: true,
                    children: matches.map((rec) {
                      final data =
                          (rec['data'] is Map) ? rec['data'] as Map : rec;
                      final ref = (data['name'] ?? '').toString();
                      final who = (data['customer'] ?? '').toString();
                      final status = (data['status'] ?? '').toString();
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('#$ref',
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                            [who, status.replaceAll('_', ' ')]
                                .where((s) => s.isNotEmpty)
                                .join(' · '),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing:
                            const Icon(Icons.chevron_right_rounded, size: 20),
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => BookingDashboardScreen(
                                    bookingId: rec['sk'].toString())),
                          );
                        },
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // ── the calendar grid ─────────────────────────────────────────────────────
  Widget _calendar() {
    final units = _byUnit();
    final capDays = _capacityByDay();
    // Header dates come from capacityByDay (always present) or first unit row.
    final List<String?> dates = capDays.isNotEmpty
        ? capDays.map((d) => (d as Map)['date']?.toString()).toList()
        : (units.isNotEmpty
            ? ((units.first as Map)['days'] as List)
                .map((d) => (d as Map)['date']?.toString())
                .toList()
            : const <String?>[]);
    if (dates.isEmpty) {
      return const Text('No calendar data.',
          style: TextStyle(color: SColors.muted));
    }

    Widget dayHeaderCell(String? iso) {
      final dt = DateTime.tryParse(iso ?? '')?.toLocal();
      return SizedBox(
        width: _cellW,
        height: _cellH,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(dt == null ? '' : _wd(dt.weekday),
                  style: const TextStyle(color: SColors.faint, fontSize: 9)),
              Text(dt == null ? '' : '${dt.day}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 12)),
            ],
          ),
        ),
      );
    }

    Widget labelCell(String text, {bool header = false}) => Container(
          width: _labelW,
          height: _cellH,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: SSpace.sm),
          child: Text(text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontWeight: header ? FontWeight.w400 : FontWeight.w600,
                  fontSize: 12,
                  color: header ? SColors.faint : SColors.ink)),
        );

    // rows: either per-unit, or a single "Capacity" row
    final List<Widget> labelColumn = [labelCell('', header: true)];
    final List<Widget> gridRows = [
      Row(children: [for (final d in dates) dayHeaderCell(d)])
    ];

    if (units.isNotEmpty) {
      for (final u in units) {
        final um = u as Map;
        labelColumn.add(labelCell(
            (um['unitNumber'] ?? um['name'] ?? 'Unit').toString()));
        final days = (um['days'] as List?) ?? const [];
        gridRows.add(Row(
          children: days.map((d) {
            final dm = d as Map;
            final state = (dm['state'] ?? 'free').toString();
            final booking = dm['booking']?.toString();
            return _cell(state, booking);
          }).toList(),
        ));
      }
    } else {
      // no units → one capacity row (used / capacity per day)
      labelColumn.add(labelCell('Capacity'));
      gridRows.add(Row(
        children: capDays.map((d) {
          final dm = d as Map;
          final used = (dm['used'] as num?)?.toInt() ?? 0;
          final capacity = (dm['capacity'] as num?)?.toInt() ?? 0;
          final blocked = (dm['state'] ?? '') == 'blocked';
          final full = capacity > 0 && used >= capacity;
          return GestureDetector(
            onTap: () => _showDay(dm['date']?.toString()),
            child: Container(
              width: _cellW,
              height: _cellH,
              margin: const EdgeInsets.all(1),
              decoration: BoxDecoration(
                color: blocked
                    ? SColors.ink2
                    : used == 0
                        ? SColors.paper2
                        : (full ? SColors.danger : SColors.clay)
                            .withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(6),
              ),
              alignment: Alignment.center,
              child: Text(used == 0 ? '' : '$used',
                  style: TextStyle(
                      color: used == 0 ? SColors.faint : Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 11)),
            ),
          );
        }).toList(),
      ));
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(children: labelColumn),
          Column(children: gridRows),
        ],
      ),
    );
  }

  Widget _cell(String state, String? booking) {
    final cell = Container(
      width: _cellW,
      height: _cellH,
      margin: const EdgeInsets.all(1),
      decoration: BoxDecoration(
        color: _stateColor(state),
        borderRadius: BorderRadius.circular(6),
      ),
    );
    if (booking == null || booking.isEmpty) return cell;
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => BookingDashboardScreen(bookingId: booking)),
      ),
      child: cell,
    );
  }

  Widget _legend() {
    Widget item(String label, Color c) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                  color: c, borderRadius: BorderRadius.circular(3))),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(color: SColors.muted, fontSize: 12)),
        ]);
    return Wrap(spacing: SSpace.md, runSpacing: SSpace.sm, children: [
      item('Free', SColors.paper2),
      item('Booked', SColors.clay),
      item('Stored', SColors.green),
      item('Overdue', SColors.danger),
      item('Blocked', SColors.ink2),
    ]);
  }

  Widget _bookingRow(Map<String, dynamic> rec) {
    final data = (rec['data'] is Map) ? rec['data'] as Map : rec;
    final ref = (data['name'] ?? '').toString();
    final customer = (data['customer'] ?? '').toString();
    final status = (data['status'] ?? '').toString();
    // Money state from the record (paymentStatus + total). A $0 total with no
    // end is a metered/open stay; a $0 total otherwise is free.
    final ps = (data['paymentStatus'] ?? '').toString();
    final total = double.tryParse('${data['total']}') ?? 0;
    final firstEnd = (data['items'] is List && (data['items'] as List).isNotEmpty)
        ? (data['items'] as List).first['endDate']
        : data['endDate'];
    final payState = ps == 'paid'
        ? 'paid'
        : ps == 'partial'
            ? 'partial'
            : total > 0.01
                ? 'unpaid'
                : (firstEnd == null ? 'metered' : 'free');
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.lg, vertical: SSpace.md),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) =>
                  BookingDashboardScreen(bookingId: rec['sk'].toString())),
        ),
        child: Row(children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('#$ref',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(customer,
                    style:
                        const TextStyle(color: SColors.muted, fontSize: 13)),
              ],
            ),
          ),
          payStatePill(payState),
          const SizedBox(width: SSpace.sm),
          Text(status.replaceAll('_', ' '),
              style: const TextStyle(
                  color: SColors.ink2,
                  fontWeight: FontWeight.w600,
                  fontSize: 12)),
        ]),
      ),
    );
  }

  String _wd(int weekday) =>
      const ['', 'M', 'T', 'W', 'T', 'F', 'S', 'S'][weekday];
}
