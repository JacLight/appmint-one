import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../models/search_when.dart';
import '../../providers/auth_provider.dart';
import '../../providers/checkout_provider.dart';
import '../../providers/custody_provider.dart';
import '../../services/host_service.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import '../social/host_profile_screen.dart';
import 'checkout_screen.dart';

class ListingDetailScreen extends StatefulWidget {
  final StowboHost host;
  final SearchWhen? initialWhen;
  const ListingDetailScreen({super.key, required this.host, this.initialWhen});
  @override
  State<ListingDetailScreen> createState() => _ListingDetailScreenState();
}

class _ListingDetailScreenState extends State<ListingDetailScreen> {
  int _count = 1;
  late DateTime _start;
  late DateTime _endDate; // explicit end when in date-range mode
  late bool _openEnded; // "right now — grab it later", billed for actual time
  bool _booking = false;
  Map<String, dynamic>? _avail; // last availability result
  bool _checking = false;
  int _availSeq = 0;
  List<Map<String, dynamic>> _addOns = []; // catalog for this listing
  final Set<String> _selectedAddOns = {}; // add-on `name`s selected

  // Bookable time model — computed by the SERVER (listingDetail.schedule) and
  // rendered verbatim. The app never invents slots or decides "is this hourly".
  bool _timeOfDay = false;
  List<Map<String, dynamic>> _slots = []; // [{minutes, label}] from the server

  // Server-provided context for the detail page.
  Map<String, dynamic>? _host; // { displayName, avatar, memberSince, listingCount }
  List<StowboHost> _moreFromHost = [];
  List<StowboHost> _nearby = [];

  StowboHost get host => widget.host;
  String get _unit => host.priceUnit; // hour | day | month

  /// A nominal window to reserve capacity when open-ended; the engine settles
  /// the real duration at pickup.
  Duration get _defaultWindow {
    switch (_unit) {
      case 'day':
        return const Duration(days: 1);
      case 'month':
        return const Duration(days: 31);
      default:
        return const Duration(hours: 6);
    }
  }

  /// The window end sent to the server. Open-ended = a nominal capacity window;
  /// date-range = the explicit end the guest picked.
  DateTime get _end =>
      _openEnded ? _start.add(_defaultWindow) : _endDate;

  bool get _bookable =>
      _avail == null || _avail!['sufficient'] == true; // allow until proven full

  @override
  void initState() {
    super.initState();
    // Seed the window from what the guest chose in search, so detail + checkout
    // stay consistent with browse. Default to "right now" for a bare open.
    final w = widget.initialWhen ?? SearchWhen.nowToday();
    _openEnded = w.openEnded;
    _start = w.start;
    _endDate = w.end ?? _start.add(_defaultWindow);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAvail();
      _loadAddOns();
      _loadNearby();
    });
  }

  Future<void> _loadNearby() async {
    try {
      final res = await stowboApi.nearbyListings(host.sk,
          lat: host.lat, lng: host.lng);
      final rows = (res['data'] is List) ? res['data'] as List : const [];
      if (!mounted) return;
      setState(() => _nearby = rows
          .whereType<Map>()
          .map((e) => StowboHost.fromCard(Map<String, dynamic>.from(e)))
          .toList());
    } catch (_) {}
  }

  Future<void> _loadAddOns() async {
    try {
      final detail = await hostService.detail(host.sk);
      final list = (detail['addOns'] is List) ? detail['addOns'] as List : [];
      // The server sends the bookable time model — render it, don't derive it.
      final sched = (detail['schedule'] is Map)
          ? Map<String, dynamic>.from(detail['schedule'])
          : const {};
      final timeOfDay = sched['timeOfDay'] == true;
      final slots = (sched['slots'] is List)
          ? (sched['slots'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : <Map<String, dynamic>>[];
      // Host card + the host's other places, sent with the detail.
      final hostInfo = (detail['host'] is Map)
          ? Map<String, dynamic>.from(detail['host'])
          : null;
      final more = (detail['moreFromHost'] is List)
          ? (detail['moreFromHost'] as List)
              .whereType<Map>()
              .map((e) => StowboHost.fromCard(Map<String, dynamic>.from(e)))
              .toList()
          : <StowboHost>[];
      if (!mounted) return;
      setState(() {
        _addOns = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(
                (e['data'] is Map) ? e['data'] : e))
            .toList();
        _host = hostInfo;
        _moreFromHost = more;
        _timeOfDay = timeOfDay;
        _slots = slots;
        // The LISTING's schedule decides the shape, not a user toggle: a
        // sub-day listing (bag drop, hourly parking) is booked by start time;
        // a multi-day one (storage box priced per day/week/month) by a date
        // range. `timeOfDay` from the server is the switch.
        _openEnded = timeOfDay;
        // Snap the start to the nearest server slot so we only ever send a
        // time the listing actually offers.
        if (_timeOfDay && _slots.isNotEmpty) _start = _snapToServerSlot(_start);
      });
    } catch (_) {}
  }

  /// Snap a time to the closest slot the server offered (never a value the
  /// listing didn't send).
  DateTime _snapToServerSlot(DateTime d) {
    if (_slots.isEmpty) return d;
    final target = d.hour * 60 + d.minute;
    int best = ((_slots.first['minutes'] as num?) ?? 0).toInt();
    int bestDiff = (best - target).abs();
    for (final s in _slots) {
      final m = ((s['minutes'] as num?) ?? 0).toInt();
      final diff = (m - target).abs();
      if (diff < bestDiff) {
        best = m;
        bestDiff = diff;
      }
    }
    final day = DateTime(d.year, d.month, d.day);
    return day.add(Duration(minutes: best));
  }

  List<Map<String, dynamic>> get _selectedAddOnPayload => _addOns
      .where((a) => _selectedAddOns.contains(a['name']?.toString()))
      .map((a) => {
            'name': a['name'],
            'price': a['price'] ?? 0,
            'chargeEvery': a['chargeEvery'] ?? 'once',
            'quantity': 1,
          })
      .toList();

  Future<void> _checkAvail() async {
    final seq = ++_availSeq;
    setState(() => _checking = true);
    try {
      final res = await context.read<CustodyProvider>().checkAvailability(
          host, _start, _end, _count,
          addOns: _selectedAddOnPayload.isEmpty ? null : _selectedAddOnPayload);
      if (mounted && seq == _availSeq) setState(() => _avail = res);
    } catch (_) {
      if (mounted && seq == _availSeq) setState(() => _avail = null);
    }
    if (mounted && seq == _availSeq) setState(() => _checking = false);
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _start,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _start = DateTime(picked.year, picked.month, picked.day, _start.hour,
            _start.minute);
        // Keep the range valid — pickup can't precede drop-off.
        if (!_endDate.isAfter(_start)) {
          _endDate = _start.add(const Duration(days: 1));
        }
      });
      _checkAvail();
    }
  }

  int get _nights => _endDate.difference(_start).inDays.clamp(1, 3650);

  Future<void> _pickEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate.isAfter(_start)
          ? _endDate
          : _start.add(const Duration(days: 1)),
      firstDate: _start.add(const Duration(days: 1)),
      lastDate: _start.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _endDate = DateTime(
          picked.year, picked.month, picked.day, _start.hour, _start.minute));
      _checkAvail();
    }
  }

  /// Start-time picker rendering ONLY the slots the server sent (label + minutes
  /// from listingDetail.schedule). No free-typing, no client-invented grid.
  Future<void> _pickStartSlot() async {
    if (_slots.isEmpty) return;
    final current = _start.hour * 60 + _start.minute;
    final picked = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: SColors.paper,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: SSpace.md),
            Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                    color: SColors.line,
                    borderRadius: BorderRadius.circular(2))),
            const Padding(
              padding: EdgeInsets.all(SSpace.lg),
              child: Text('Start time',
                  style:
                      TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: _slots.map((s) {
                  final m = ((s['minutes'] as num?) ?? 0).toInt();
                  final label = (s['label'] ?? _fmtMinutes(m)).toString();
                  final sel = m == current;
                  return ListTile(
                    dense: true,
                    title: Text(label,
                        style: TextStyle(
                            fontWeight:
                                sel ? FontWeight.w700 : FontWeight.w500,
                            color: sel ? SColors.clay2 : SColors.ink)),
                    trailing: sel
                        ? const Icon(Icons.check_rounded, color: SColors.clay)
                        : null,
                    onTap: () => Navigator.pop(context, m),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
    if (picked != null) {
      setState(() => _start = DateTime(_start.year, _start.month, _start.day)
          .add(Duration(minutes: picked)));
      _checkAvail();
    }
  }

  String _fmtMinutes(int m) {
    final day = DateTime(_start.year, _start.month, _start.day)
        .add(Duration(minutes: m));
    return _fmtTime(day);
  }

  /// The server's price quote for the current window + add-ons, if returned.
  Map<String, dynamic>? get _quote =>
      (_avail?['quote'] is Map) ? _avail!['quote'] as Map<String, dynamic> : null;

  /// What the guest actually pays for this line (fees + tax included). The
  /// server computes it; the app only displays it. Falls back to subtotal for
  /// an older server that hasn't got the fee/tax fields yet.
  double? get _quoteTotal {
    final q = _quote;
    final v = q?['total'] ?? q?['subtotal'];
    return v is num ? v.toDouble() : null;
  }

  /// Labelled rate breakdown (band by band) — rendered verbatim, never
  /// recomputed from a rate × duration.
  List<Map<String, dynamic>> get _rateLines => (_quote?['rateLines'] is List)
      ? (_quote!['rateLines'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList()
      : const [];

  double? get _addOnTotalQ {
    final v = _quote?['addOnTotal'];
    return (v is num && v > 0) ? v.toDouble() : null;
  }

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  String _fmtTime(DateTime d) {
    final t = TimeOfDay.fromDateTime(d);
    final h = t.hourOfPeriod == 0 ? 12 : t.hourOfPeriod;
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m ${t.period == DayPeriod.am ? 'AM' : 'PM'}';
  }

  Future<void> _book() async {
    final user = context.read<AuthProvider>().user;
    if (user == null) return;
    // Hand off to the server-driven checkout: it saves the cart + progress so
    // the guest can resume on any device, holds capacity, then charges.
    final item = context.read<CheckoutProvider>().lineFor(
          host,
          start: _start,
          end: _end,
          quantity: _count,
          addOns: _selectedAddOnPayload.isEmpty ? null : _selectedAddOnPayload,
        );
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CheckoutScreen(
          items: [item],
          title: host.name,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 240,
            pinned: true,
            backgroundColor: SColors.green,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              background: _Gallery(images: host.photoUrls),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(SSpace.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(host.name,
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: SSpace.sm),
                  Row(children: [
                    const Icon(Icons.place_outlined,
                        size: 16, color: SColors.muted),
                    const SizedBox(width: 4),
                    Expanded(
                        child: Text(
                            host.address.isEmpty ? 'Address on booking' : host.address,
                            style: const TextStyle(color: SColors.muted))),
                  ]),
                  const SizedBox(height: SSpace.lg),
                  Wrap(spacing: SSpace.sm, runSpacing: SSpace.sm, children: [
                    _fact(Icons.sell_outlined, host.kindLabel),
                    if (host.hours.isNotEmpty)
                      _fact(Icons.schedule_rounded, host.hours),
                    _fact(Icons.inventory_2_outlined,
                        '${host.capacity} spaces'),
                  ]),
                  const SizedBox(height: SSpace.md),
                  SCard(
                    padding: const EdgeInsets.symmetric(
                        horizontal: SSpace.lg, vertical: SSpace.md),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => HostProfileScreen(host: host)),
                    ),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: SColors.greenSoft,
                        child: Text(
                            host.name.isNotEmpty
                                ? host.name[0].toUpperCase()
                                : '?',
                            style: const TextStyle(
                                color: SColors.green,
                                fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(width: SSpace.md),
                      Expanded(
                        child: Text('View host profile',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600)),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: SColors.faint),
                    ]),
                  ),
                  if (host.description.isNotEmpty) ...[
                    const SizedBox(height: SSpace.xl),
                    Text('About', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: SSpace.sm),
                    Text(host.description,
                        style: const TextStyle(
                            color: SColors.ink2, height: 1.5)),
                  ],
                  const SizedBox(height: SSpace.xl),
                  SCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('How many items?',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15)),
                        const SizedBox(height: SSpace.md),
                        Row(
                          children: [
                            _StepBtn(
                                icon: Icons.remove_rounded,
                                onTap: _count > 1
                                    ? () {
                                        setState(() => _count--);
                                        _checkAvail();
                                      }
                                    : null),
                            Expanded(
                              child: Center(
                                child: Text('$_count',
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineMedium),
                              ),
                            ),
                            _StepBtn(
                                icon: Icons.add_rounded,
                                onTap: () {
                                  setState(() => _count++);
                                  _checkAvail();
                                }),
                          ],
                        ),
                        const Divider(height: SSpace.xl * 1.4),
                        const Text('When',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15)),
                        const SizedBox(height: SSpace.md),
                        // Shape is driven by the listing's own schedule
                        // (`timeOfDay` from the server): a sub-day listing is
                        // booked by start date + time; a multi-day one by a
                        // date range.
                        if (_timeOfDay)
                          Row(
                            children: [
                              Expanded(
                                child: _PickerField(
                                  icon: Icons.event_rounded,
                                  label: 'Start date',
                                  value: _fmtDate(_start),
                                  onTap: _pickStartDate,
                                ),
                              ),
                              const SizedBox(width: SSpace.sm),
                              Expanded(
                                child: _PickerField(
                                  icon: Icons.schedule_rounded,
                                  label: 'Start time',
                                  value: _fmtTime(_start),
                                  onTap: _pickStartSlot,
                                ),
                              ),
                            ],
                          )
                        else ...[
                          // Travel storage: explicit start → end (Airbnb-style).
                          Row(
                            children: [
                              Expanded(
                                child: _PickerField(
                                  icon: Icons.flight_takeoff_rounded,
                                  label: 'Drop off',
                                  value: _fmtDate(_start),
                                  onTap: _pickStartDate,
                                ),
                              ),
                              const SizedBox(width: SSpace.sm),
                              Expanded(
                                child: _PickerField(
                                  icon: Icons.flight_land_rounded,
                                  label: 'Pick up',
                                  value: _fmtDate(_endDate),
                                  onTap: _pickEndDate,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text('${_nights} day${_nights == 1 ? '' : 's'}',
                              style: const TextStyle(
                                  color: SColors.muted, fontSize: 12.5)),
                        ],
                        if (_addOns.isNotEmpty) ...[
                          const Divider(height: SSpace.xl * 1.4),
                          const Text('Add-ons',
                              style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 15)),
                          const SizedBox(height: SSpace.sm),
                          Wrap(
                            spacing: SSpace.sm,
                            runSpacing: SSpace.sm,
                            children: _addOns.map((a) {
                              final name = a['name']?.toString() ?? '';
                              final title =
                                  (a['title'] ?? name).toString();
                              final price =
                                  (a['price'] as num?)?.toDouble() ?? 0;
                              final sel = _selectedAddOns.contains(name);
                              return FilterChip(
                                label: Text(price > 0
                                    ? '$title · ${money(price)}'
                                    : title),
                                selected: sel,
                                onSelected: (v) {
                                  setState(() => v
                                      ? _selectedAddOns.add(name)
                                      : _selectedAddOns.remove(name));
                                  _checkAvail();
                                },
                                selectedColor: SColors.claySoft,
                                checkmarkColor: SColors.clay2,
                              );
                            }).toList(),
                          ),
                        ],
                        const Divider(height: SSpace.xl * 1.4),
                        // Server-computed rate breakdown, band by band —
                        // rendered verbatim, never derived.
                        for (final r in _rateLines) ...[
                          _row((r['label'] ?? '').toString(),
                              money(((r['amount'] as num?) ?? 0).toDouble())),
                          const SizedBox(height: 6),
                        ],
                        if (_addOnTotalQ != null) ...[
                          _row('Add-ons', money(_addOnTotalQ!)),
                          const SizedBox(height: 6),
                        ],
                        _row(
                            'Total',
                            _checking
                                ? '…'
                                : _quoteTotal != null
                                    ? money(_quoteTotal!)
                                    : '—',
                            bold: true),
                        const SizedBox(height: SSpace.sm),
                        _AvailabilityLine(
                            checking: _checking, avail: _avail, count: _count),
                      ],
                    ),
                  ),
                  const SizedBox(height: SSpace.xl),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: (_booking || !_bookable) ? null : _book,
                      child: _booking
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2.4))
                          : Text(_bookable
                              ? 'Reserve $_count item${_count > 1 ? 's' : ''}'
                              : 'Not available for this window'),
                    ),
                  ),
                  const SizedBox(height: SSpace.sm),
                  const Center(
                    child: Text('Review payment details at checkout',
                        style: TextStyle(color: SColors.muted, fontSize: 13)),
                  ),
                  if (_host != null) ...[
                    const SizedBox(height: SSpace.xl),
                    _hostCard(_host!),
                  ],
                  _listingRow('More from this host', _moreFromHost),
                  _listingRow('Nearby', _nearby),
                  const SizedBox(height: SSpace.xl),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hostCard(Map<String, dynamic> h) {
    final name = (h['displayName'] ?? 'Host').toString();
    final avatar = (h['avatar'] ?? '').toString();
    final count = (h['listingCount'] as num?)?.toInt();
    final since = DateTime.tryParse((h['memberSince'] ?? '').toString());
    return SCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: SColors.greenSoft,
            backgroundImage: avatar.isNotEmpty ? NetworkImage(avatar) : null,
            child: avatar.isEmpty
                ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: const TextStyle(
                        color: SColors.green, fontWeight: FontWeight.w700))
                : null,
          ),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hosted by $name',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
                Text(
                    [
                      if (count != null)
                        '$count listing${count == 1 ? '' : 's'}',
                      if (since != null) 'since ${since.year}',
                    ].join(' · '),
                    style:
                        const TextStyle(color: SColors.muted, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// A horizontal strip of listing cards (more-from-host / nearby). Renders
  /// nothing when the server returned none.
  Widget _listingRow(String title, List<StowboHost> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: SSpace.xl),
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: SSpace.md),
        SizedBox(
          height: 176,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: SSpace.md),
            itemBuilder: (_, i) => _miniCard(items[i]),
          ),
        ),
      ],
    );
  }

  Widget _miniCard(StowboHost h) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => ListingDetailScreen(
                host: h, initialWhen: widget.initialWhen)),
      ),
      child: SizedBox(
        width: 168,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(SRadius.md),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: h.photoUrl != null && h.photoUrl!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: h.photoUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) =>
                            Container(color: SColors.paper2),
                        errorWidget: (_, __, ___) => _miniPh())
                    : _miniPh(),
              ),
            ),
            const SizedBox(height: 6),
            Text(h.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13.5)),
            Text(h.kindLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: SColors.muted, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }

  Widget _miniPh() => Container(
        color: SColors.greenSoft,
        child: const Center(
            child: Icon(Icons.inventory_2_rounded,
                color: SColors.green, size: 32)),
      );

  Widget _fact(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
            color: SColors.card,
            borderRadius: BorderRadius.circular(SRadius.pill),
            border: Border.all(color: SColors.line, width: 1.3)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: SColors.ink2),
          const SizedBox(width: 6),
          Text(text,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: SColors.ink2)),
        ]),
      );

  Widget _row(String l, String r, {bool bold = false}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(l, style: const TextStyle(color: SColors.muted)),
          Text(r,
              style: TextStyle(
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                  fontSize: bold ? 16 : 14)),
        ],
      );
}

/// A tappable field showing a label + current value (date / time), styled to
/// match the brand. Opens a picker on tap.
class _PickerField extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  const _PickerField({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line, width: 1.3),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: SColors.clay),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 11)),
                  Text(value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Swipeable gallery of ALL the listing's photos, with page dots. Falls back to
/// a placeholder only when the host uploaded nothing.
class _Gallery extends StatefulWidget {
  final List<String> images;
  const _Gallery({required this.images});
  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final images = widget.images;
    if (images.isEmpty) {
      return Container(
        color: SColors.green,
        child: const Center(
            child: Icon(Icons.inventory_2_rounded,
                color: SColors.lime, size: 64)),
      );
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          controller: _controller,
          itemCount: images.length,
          onPageChanged: (i) => setState(() => _page = i),
          itemBuilder: (_, i) => CachedNetworkImage(
            imageUrl: images[i],
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(color: SColors.paper2),
            errorWidget: (_, __, ___) => Container(
              color: SColors.green,
              child: const Center(
                  child: Icon(Icons.broken_image_outlined,
                      color: SColors.lime, size: 48)),
            ),
          ),
        ),
        if (images.length > 1)
          Positioned(
            bottom: 12,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(images.length, (i) {
                final active = i == _page;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: active ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: active ? Colors.white : Colors.white54,
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
          ),
      ],
    );
  }
}

class _AvailabilityLine extends StatelessWidget {
  final bool checking;
  final Map<String, dynamic>? avail;
  final int count;
  const _AvailabilityLine(
      {required this.checking, required this.avail, required this.count});

  @override
  Widget build(BuildContext context) {
    if (checking && avail == null) {
      return const Row(children: [
        SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
                strokeWidth: 2, color: SColors.muted)),
        SizedBox(width: 8),
        Text('Checking availability…',
            style: TextStyle(color: SColors.muted, fontSize: 13)),
      ]);
    }
    if (avail == null) {
      return const Text(
        'You only pay for the time your items are held. Final charge at pickup.',
        style: TextStyle(color: SColors.faint, fontSize: 12.5),
      );
    }
    final available = (avail!['available'] is num)
        ? (avail!['available'] as num).toInt()
        : 0;
    final ok = avail!['sufficient'] == true;
    return Row(children: [
      Icon(ok ? Icons.check_circle_rounded : Icons.error_outline_rounded,
          size: 16, color: ok ? SColors.green : SColors.danger),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          ok
              ? '$available available for this window'
              : available <= 0
                  ? 'Fully booked for this window'
                  : 'Only $available left — reduce items or change the window',
          style: TextStyle(
              color: ok ? SColors.green2 : SColors.danger,
              fontSize: 13,
              fontWeight: FontWeight.w600),
        ),
      ),
    ]);
  }
}

class _StepBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _StepBtn({required this.icon, this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: onTap == null ? SColors.line2 : SColors.claySoft,
      borderRadius: BorderRadius.circular(SRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(SRadius.md),
        onTap: onTap,
        child: SizedBox(
          width: 52,
          height: 52,
          child: Icon(icon,
              color: onTap == null ? SColors.faint : SColors.clay2),
        ),
      ),
    );
  }
}
