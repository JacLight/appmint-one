import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../models/search_when.dart';
import '../../providers/checkout_provider.dart';
import '../../providers/discovery_provider.dart';
import '../../services/address_service.dart';
import '../../services/location_service.dart';
import '../../widgets/google_map_view.dart';
import '../../widgets/stowbo_widgets.dart';
import 'checkout_screen.dart';
import 'listing_detail_screen.dart';

class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});
  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  bool _map = false;
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final disc = context.watch<DiscoveryProvider>();
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Header: compact search + inline toggle, then filter chips ─
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.xl, SSpace.md, SSpace.xl, SSpace.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _SearchBar(
                          controller: _search,
                          onChanged: (q) =>
                              context.read<DiscoveryProvider>().setQuery(q),
                          onClear: () {
                            _search.clear();
                            context.read<DiscoveryProvider>().setQuery('');
                          },
                        ),
                      ),
                      const SizedBox(width: SSpace.sm),
                      _ViewToggle(
                        map: _map,
                        onChanged: (m) => setState(() => _map = m),
                      ),
                    ],
                  ),
                  const SizedBox(height: SSpace.sm),
                  Row(children: [
                    Expanded(
                      child: _WhenBar(
                        when: disc.when,
                        onChanged: (w) =>
                            context.read<DiscoveryProvider>().setWhen(w),
                      ),
                    ),
                    const SizedBox(width: SSpace.sm),
                    _WhereBar(disc: disc),
                  ]),
                  const SizedBox(height: SSpace.sm),
                  _KindFilter(
                    selected: disc.kinds,
                    onToggle: (k) =>
                        context.read<DiscoveryProvider>().toggleKind(k),
                    onClear: () =>
                        context.read<DiscoveryProvider>().clearKinds(),
                  ),
                  const _ResumeBanner(),
                ],
              ),
            ),
            // ── Body: list or map ───────────────────────────────────────
            Expanded(
              // Map mode always renders the map (centered on the guest) even
              // with zero matching spots — only the list shows an empty state.
              child: _map
                  ? _MapView(
                      hosts: disc.hosts,
                      userLat: disc.centerLat ?? disc.userLat,
                      userLng: disc.centerLng ?? disc.userLng,
                    )
                  : disc.loading
                      ? const Center(
                          child:
                              CircularProgressIndicator(color: SColors.clay))
                      : disc.hosts.isEmpty
                          ? _EmptyBrowse(disc: disc)
                          : RefreshIndicator(
                              color: SColors.clay,
                              onRefresh: () =>
                                  context.read<DiscoveryProvider>().load(),
                              child: ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                    SSpace.xl, SSpace.sm, SSpace.xl, 96),
                                itemCount: disc.hosts.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: SSpace.md),
                                itemBuilder: (_, i) => _HostCard(
                                  host: disc.hosts[i],
                                  distanceMeters:
                                      disc.distanceTo(disc.hosts[i]),
                                ),
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  const _SearchBar(
      {required this.controller,
      required this.onChanged,
      required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.pill),
        border: Border.all(color: SColors.line, width: 1.2),
        boxShadow: SShadow.soft,
      ),
      padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, color: SColors.muted, size: 22),
          const SizedBox(width: SSpace.sm),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              cursorColor: SColors.clay,
              decoration: const InputDecoration(
                hintText: 'Search spots, areas, types…',
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                contentPadding: EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          if (controller.text.isNotEmpty)
            GestureDetector(
              onTap: onClear,
              child: const Icon(Icons.close_rounded,
                  color: SColors.muted, size: 20),
            ),
        ],
      ),
    );
  }
}

/// The "when" search field — the hybrid switch between "now/today" (event, car,
/// bag) and an Airbnb-style date range (travel storage). The chosen window is
/// carried into listing detail + checkout.
class _WhenBar extends StatelessWidget {
  final SearchWhen when;
  final ValueChanged<SearchWhen> onChanged;
  const _WhenBar({required this.when, required this.onChanged});

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<SearchWhen>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _WhenSheet(initial: when),
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _open(context),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.lg, vertical: 13),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.pill),
          border: Border.all(color: SColors.line, width: 1.2),
        ),
        child: Row(
          children: [
            Icon(when.openEnded
                ? Icons.bolt_rounded
                : Icons.date_range_rounded,
                size: 19, color: SColors.clay),
            const SizedBox(width: SSpace.sm),
            Text(when.openEnded ? 'Store now' : 'Storing while away',
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13.5)),
            const SizedBox(width: 6),
            Expanded(
              child: Text('· ${when.summary}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: SColors.muted, fontSize: 13.5)),
            ),
            const Icon(Icons.expand_more_rounded, color: SColors.muted),
          ],
        ),
      ),
    );
  }
}

/// The "where" chip — the search center + distance. Defaults to the guest's own
/// location (nearest 20 mi); tap to widen the distance, turn it off, or move the
/// center to another area.
class _WhereBar extends StatelessWidget {
  final DiscoveryProvider disc;
  const _WhereBar({required this.disc});

  String get _label {
    if (!disc.hasCenter) return disc.locating ? 'Locating…' : 'Anywhere';
    final r = disc.radiusMiles;
    return '${disc.centerLabel} · ${r == null ? 'Any' : '${r.toInt()} mi'}';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        builder: (_) => _WhereSheet(disc: disc),
      ),
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: SSpace.md, vertical: 13),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.pill),
          border: Border.all(color: SColors.line, width: 1.2),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(
              disc.locating
                  ? Icons.location_searching_rounded
                  : Icons.place_rounded,
              size: 18,
              color: SColors.clay),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 130),
            child: Text(_label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          ),
          const Icon(Icons.expand_more_rounded, color: SColors.muted, size: 20),
        ]),
      ),
    );
  }
}

class _WhereSheet extends StatefulWidget {
  final DiscoveryProvider disc;
  const _WhereSheet({required this.disc});
  @override
  State<_WhereSheet> createState() => _WhereSheetState();
}

class _WhereSheetState extends State<_WhereSheet> {
  final _addr = TextEditingController();
  List<AddressPrediction> _preds = [];
  Timer? _debounce;
  bool _searching = false;

  DiscoveryProvider get disc => widget.disc;

  void _onType(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (q.trim().length < 3) {
        if (mounted) setState(() => _preds = []);
        return;
      }
      setState(() => _searching = true);
      final p = await addressService.autocomplete(q);
      if (mounted) setState(() {
        _preds = p;
        _searching = false;
      });
    });
  }

  Future<void> _pick(AddressPrediction p) async {
    final d = await addressService.placeDetails(p.placeId);
    double? toD(dynamic v) => (v is num) ? v.toDouble() : null;
    final loc = (d?['location'] is Map) ? d!['location'] as Map : const {};
    final lat = toD(d?['lat']) ?? toD(d?['latitude']) ?? toD(loc['lat']);
    final lng = toD(d?['lng']) ?? toD(d?['longitude']) ?? toD(loc['lng']);
    if (lat != null && lng != null) {
      disc.setCenter(lat, lng, p.description.split(',').first.trim());
    }
    if (mounted) Navigator.pop(context);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _addr.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const radii = <double?>[5, 10, 20, 50, null];
    return Container(
      padding: EdgeInsets.fromLTRB(SSpace.xl, SSpace.lg, SSpace.xl,
          SSpace.xl + MediaQuery.of(context).viewInsets.bottom),
      decoration: const BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Where to look', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: SSpace.md),
          InkWell(
            onTap: () async {
              Navigator.pop(context);
              await disc.useMyLocation();
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                Icon(
                    disc.centerIsDevice && disc.hasCenter
                        ? Icons.my_location_rounded
                        : Icons.near_me_rounded,
                    color: SColors.clay),
                const SizedBox(width: SSpace.sm),
                const Text('Use my location',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ]),
            ),
          ),
          if (disc.locFailure != null) ...[
            const SizedBox(height: 4),
            Text(_locHint(disc.locFailure!),
                style: const TextStyle(color: SColors.danger, fontSize: 12.5)),
          ],
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _addr,
            onChanged: _onType,
            decoration: const InputDecoration(
                hintText: 'Search a city or address',
                prefixIcon: Icon(Icons.search_rounded)),
          ),
          if (_searching)
            const Padding(
                padding: EdgeInsets.only(top: 8),
                child: LinearProgressIndicator(color: SColors.clay)),
          ..._preds.take(5).map((p) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.place_outlined, size: 18),
                title: Text(p.description,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                onTap: () => _pick(p),
              )),
          const SizedBox(height: SSpace.md),
          const Text('DISTANCE',
              style: TextStyle(
                  color: SColors.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1)),
          const SizedBox(height: SSpace.sm),
          Wrap(
            spacing: SSpace.sm,
            runSpacing: SSpace.sm,
            children: radii.map((r) {
              final sel = disc.radiusMiles == r;
              return ChoiceChip(
                label: Text(r == null ? 'Any distance' : '${r.toInt()} mi'),
                selected: sel,
                selectedColor: SColors.claySoft,
                onSelected: (_) {
                  disc.setRadiusMiles(r);
                  setState(() {});
                },
              );
            }).toList(),
          ),
          const SizedBox(height: SSpace.sm),
        ],
      ),
    );
  }

  String _locHint(LocationFailure f) {
    switch (f) {
      case LocationFailure.denied:
      case LocationFailure.deniedForever:
        return 'Location permission is off — search an area instead.';
      case LocationFailure.serviceDisabled:
        return 'Location services are off — turn them on or search an area.';
      case LocationFailure.error:
        return "Couldn't get your location — search an area instead.";
    }
  }
}

/// Empty state that knows WHY it is empty — a distance filter hiding everything
/// gets a one-tap "show any distance", not just "clear filters".
class _EmptyBrowse extends StatelessWidget {
  final DiscoveryProvider disc;
  const _EmptyBrowse({required this.disc});
  @override
  Widget build(BuildContext context) {
    final radiusOn = disc.radiusMiles != null && disc.hasCenter;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SSpace.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(radiusOn ? Icons.location_off_rounded : Icons.search_off_rounded,
                size: 48, color: SColors.faint),
            const SizedBox(height: SSpace.md),
            Text(
                radiusOn
                    ? 'Nothing within ${disc.radiusMiles!.toInt()} mi'
                    : 'No spots match',
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(
                radiusOn
                    ? 'Nothing nearby for this search. Widen the distance or pick another area.'
                    : 'Try a different search or clear the filters.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: SColors.muted)),
            if (radiusOn) ...[
              const SizedBox(height: SSpace.lg),
              ElevatedButton.icon(
                onPressed: () => disc.setRadiusMiles(null),
                style:
                    ElevatedButton.styleFrom(backgroundColor: SColors.clay),
                icon: const Icon(Icons.travel_explore_rounded),
                label: const Text('Show any distance'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WhenSheet extends StatefulWidget {
  final SearchWhen initial;
  const _WhenSheet({required this.initial});
  @override
  State<_WhenSheet> createState() => _WhenSheetState();
}

class _WhenSheetState extends State<_WhenSheet> {
  late bool _openEnded = widget.initial.openEnded;
  late DateTime _start = widget.initial.start;
  late DateTime? _end = widget.initial.end;

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
      initialDateRange: (_end != null && _end!.isAfter(_start))
          ? DateTimeRange(start: _start, end: _end!)
          : DateTimeRange(
              start: now, end: now.add(const Duration(days: 2))),
    );
    if (range != null) {
      setState(() {
        _openEnded = false;
        _start = range.start;
        _end = range.end;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: SColors.paper,
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      padding: const EdgeInsets.all(SSpace.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                    color: SColors.line,
                    borderRadius: BorderRadius.circular(2))),
          ),
          const SizedBox(height: SSpace.lg),
          Text('When do you need it?',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: SSpace.lg),
          _option(
            icon: Icons.bolt_rounded,
            title: 'Right now',
            subtitle: 'Drop a car or bag today, grab it later — pay for the time you keep it.',
            active: _openEnded,
            onTap: () => setState(() {
              _openEnded = true;
              _start = DateTime.now();
            }),
          ),
          const SizedBox(height: SSpace.sm),
          _option(
            icon: Icons.date_range_rounded,
            title: _end == null || _openEnded
                ? 'Pick dates'
                : SearchWhen.dates(_start, _end!).summary,
            subtitle: 'Storing while you travel — choose a start and end date.',
            active: !_openEnded,
            onTap: _pickRange,
          ),
          const SizedBox(height: SSpace.xl),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(
                context,
                _openEnded
                    ? SearchWhen.nowToday()
                    : SearchWhen.dates(
                        _start, _end ?? _start.add(const Duration(days: 1))),
              );
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  Widget _option({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: active ? SColors.claySoft : SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: active ? SColors.clay : SColors.line, width: 1.4),
        ),
        child: Row(
          children: [
            Icon(icon, color: active ? SColors.clay2 : SColors.ink2),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: active ? SColors.clay2 : SColors.ink)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 12.5)),
                ],
              ),
            ),
            if (active)
              const Icon(Icons.check_circle_rounded, color: SColors.clay),
          ],
        ),
      ),
    );
  }
}

/// Shows when the server reports an unfinished purchase for this customer.
/// Tapping resumes it (the server drives which step they land on).
class _ResumeBanner extends StatelessWidget {
  const _ResumeBanner();

  @override
  Widget build(BuildContext context) {
    final cp = context.watch<CheckoutProvider>();
    final s = cp.state;
    if (s == null) return const SizedBox.shrink();
    final total = s.quote.total;
    return Padding(
      padding: const EdgeInsets.only(top: SSpace.sm),
      child: GestureDetector(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => const CheckoutScreen(resume: true)),
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: SSpace.lg, vertical: SSpace.md),
          decoration: BoxDecoration(
            color: SColors.claySoft,
            borderRadius: BorderRadius.circular(SRadius.md),
            border: Border.all(color: SColors.clay, width: 1.2),
          ),
          child: Row(
            children: [
              const Icon(Icons.shopping_bag_rounded,
                  color: SColors.clay2, size: 20),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.hasLiveHold ? 'Finish paying' : 'Resume checkout',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: SColors.clay2,
                            fontSize: 14)),
                    Text(
                        '${s.quote.lines.length} item${s.quote.lines.length == 1 ? '' : 's'} · ${money(total)}',
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 12.5)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: SColors.clay2),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact circular button that swaps between list and map views — mirrors
/// Uber's trailing pill so the search row stays one line.
class _ViewToggle extends StatelessWidget {
  final bool map;
  final ValueChanged<bool> onChanged;
  const _ViewToggle({required this.map, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!map),
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: SColors.ink,
          shape: BoxShape.circle,
          boxShadow: SShadow.soft,
        ),
        child: Icon(map ? Icons.view_list_rounded : Icons.map_rounded,
            color: Colors.white, size: 22),
      ),
    );
  }
}

/// Multi-select storage-type filter. "All" clears the set; each type is an
/// independent checkbox chip (tap to add/remove). Sized so descenders never
/// clip.
class _KindFilter extends StatelessWidget {
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final VoidCallback onClear;
  const _KindFilter(
      {required this.selected,
      required this.onToggle,
      required this.onClear});

  @override
  Widget build(BuildContext context) {
    final kinds = StowboHost.kinds;
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: kinds.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: SSpace.sm),
        itemBuilder: (_, i) {
          if (i == 0) {
            return _Chip(
              label: 'All',
              active: selected.isEmpty,
              onTap: onClear,
            );
          }
          final k = kinds[i - 1];
          final active = selected.contains(k);
          return _Chip(
            label: k,
            active: active,
            onTap: () => onToggle(k),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Chip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? SColors.ink : SColors.card,
          borderRadius: BorderRadius.circular(SRadius.pill),
          border: Border.all(
              color: active ? SColors.ink : SColors.line, width: 1.4),
        ),
        child: Text(
          label,
          style: TextStyle(
              color: active ? Colors.white : SColors.ink2,
              fontWeight: FontWeight.w600,
              fontSize: 13.5),
        ),
      ),
    );
  }
}

// ── Map view ──────────────────────────────────────────────────────────────
class _MapView extends StatefulWidget {
  final List<StowboHost> hosts;
  final double? userLat;
  final double? userLng;
  const _MapView({required this.hosts, this.userLat, this.userLng});
  @override
  State<_MapView> createState() => _MapViewState();
}

class _MapViewState extends State<_MapView> {
  StowboHost? _selected;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        GoogleMapView(
          hosts: widget.hosts,
          userLat: widget.userLat,
          userLng: widget.userLng,
          onSelect: (h) => setState(() => _selected = h),
        ),
        if (_selected != null)
          Positioned(
            left: SSpace.lg,
            right: SSpace.lg,
            bottom: SSpace.lg,
            child: _MapCard(host: _selected!),
          ),
      ],
    );
  }
}

class _MapCard extends StatelessWidget {
  final StowboHost host;
  const _MapCard({required this.host});
  @override
  Widget build(BuildContext context) {
    return SCard(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => ListingDetailScreen(
                host: host,
                initialWhen: context.read<DiscoveryProvider>().when)),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: const Icon(Icons.inventory_2_rounded,
                color: SColors.green),
          ),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(host.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
                Text('${host.kindLabel} · ${host.priceLabel.isEmpty ? 'See price' : host.priceLabel}',
                    style: const TextStyle(
                        color: SColors.muted, fontSize: 13)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: SColors.faint),
        ],
      ),
    );
  }
}

// ── List card ───────────────────────────────────────────────────────────────
class _HostCard extends StatelessWidget {
  final StowboHost host;
  final double? distanceMeters;
  const _HostCard({required this.host, this.distanceMeters});

  String get _distanceLabel {
    final m = distanceMeters;
    if (m == null) return '';
    if (m < 1000) return '${m.round()} m';
    final km = m / 1000;
    return '${km.toStringAsFixed(km < 10 ? 1 : 0)} km';
  }

  @override
  Widget build(BuildContext context) {
    return SCard(
      padding: EdgeInsets.zero,
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => ListingDetailScreen(
                host: host,
                initialWhen: context.read<DiscoveryProvider>().when)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: host.photoUrl != null && host.photoUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: host.photoUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: SColors.paper2),
                      errorWidget: (_, __, ___) => _ph(),
                    )
                  : _ph(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(SSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                        child: Text(host.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleLarge)),
                    if (host.rating != null) ...[
                      const Icon(Icons.star_rounded,
                          size: 16, color: SColors.amber),
                      const SizedBox(width: 2),
                      Text(host.rating!.toStringAsFixed(1),
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13)),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    _pill(host.kindLabel),
                    const SizedBox(width: SSpace.sm),
                    if (_distanceLabel.isNotEmpty) ...[
                      const Icon(Icons.near_me_rounded,
                          size: 13, color: SColors.clay),
                      const SizedBox(width: 3),
                      Text(_distanceLabel,
                          style: const TextStyle(
                              color: SColors.clay2,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(width: SSpace.sm),
                    ],
                    Flexible(
                      child: Text(
                        host.address.isEmpty ? '—' : host.address,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: SColors.muted, fontSize: 13),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SSpace.sm),
                // The host's own rate wording ("Free", "$3 / hour", "$18/day
                // cap"), or the exact total when the search has dates.
                Text(
                  host.priceLabel.isEmpty ? 'See price' : host.priceLabel,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: SColors.ink,
                      fontSize: 16),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _ph() => Container(
        color: SColors.greenSoft,
        child: const Center(
            child: Icon(Icons.inventory_2_rounded,
                color: SColors.green, size: 40)),
      );

  Widget _pill(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
            color: SColors.greenSoft,
            borderRadius: BorderRadius.circular(SRadius.pill)),
        child: Text(text,
            style: const TextStyle(
                color: SColors.green2,
                fontSize: 11.5,
                fontWeight: FontWeight.w600)),
      );
}
