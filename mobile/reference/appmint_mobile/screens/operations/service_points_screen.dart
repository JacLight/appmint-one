import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../providers/checkin_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/operations_provider.dart';
import '../../widgets/location_picker.dart';
import '../../widgets/auto_refresh.dart';
import 'floor_plan_screen.dart';
import 'service_point_form_sheet.dart';

/// Service Points operator screen.
///
/// Lists every service point at the venue, color-coded by status. Long-press
/// a tile to mark it dirty / clear / blocked. Tap an occupied tile to see
/// its current reservation. Filter chips at top scope by kind (table / room /
/// bay / chair / counter / etc — free-form values from data.kind).
///
/// The hierarchy (parentName recursion: floor → section → table → seat) is
/// surfaced via a "Group by parent" toggle. Default is flat list ordered
/// by sortOrder.
///
/// AppBar exposes a Grid / Floor-plan toggle. Filters apply only to the grid
/// view (the floor plan shows all positioned SPs).
class ServicePointsScreen extends StatefulWidget {
  final String businessLocationId;
  const ServicePointsScreen({super.key, this.businessLocationId = ''});

  @override
  State<ServicePointsScreen> createState() => _ServicePointsScreenState();
}

class _ServicePointsScreenState extends State<ServicePointsScreen> {
  String _kindFilter = '';
  String _statusFilter = '';
  String _viewMode = 'grid'; // 'grid' | 'plan'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loc = context.read<LocationProvider>();
      final ops = context.read<OperationsProvider>();
      // businessLocationId on records points to location.data.name (slug),
      // not the location's sk — so we read businessLocationName here.
      final venue = widget.businessLocationId.isNotEmpty
          ? widget.businessLocationId
          : loc.businessLocationName;
      // The floor is read fresh on every visit: the provider keeps the last
      // list, which showed a table as it was before a check closed.
      ops.setBusinessLocation(venue).then((_) {
        if (mounted) ops.loadServicePoints();
      });
      // The waitlist and table holds, so a free table can seat the next party.
      final checkin = context.read<CheckinProvider>();
      checkin.setBusinessLocation(venue).then((_) {
        if (mounted) checkin.refresh();
      });
      loc.addListener(_onLocationChanged);
    });
  }

  void _onLocationChanged() {
    if (!mounted) return;
    final loc = context.read<LocationProvider>();
    final ops = context.read<OperationsProvider>();
    if (widget.businessLocationId.isEmpty) {
      ops.setBusinessLocation(loc.businessLocationName);
    }
  }

  @override
  void dispose() {
    try {
      Provider.of<LocationProvider>(
        context,
        listen: false,
      ).removeListener(_onLocationChanged);
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AutoRefresh(
      onRefresh: () async {
        final ops = context.read<OperationsProvider>();
        if (!ops.busy && !ops.loadingServicePoints)
          await ops.loadServicePoints();
      },
      child: Scaffold(
        backgroundColor: HaHoColors.background,
        appBar: AppBar(
          centerTitle: false,
          title: const LocationAppBarTitle(title: 'Tables'),
          backgroundColor: HaHoColors.background,
          elevation: 0,
          actions: [
            const SizedBox(width: HaHoSpacing.xs),
            IconButton(
              tooltip: 'Grid view',
              icon: Icon(
                Icons.grid_view,
                color: _viewMode == 'grid'
                    ? HaHoColors.primary
                    : HaHoColors.textGray,
              ),
              onPressed: () => setState(() => _viewMode = 'grid'),
            ),
            IconButton(
              tooltip: 'Floor plan',
              icon: Icon(
                Icons.map_outlined,
                color: _viewMode == 'plan'
                    ? HaHoColors.primary
                    : HaHoColors.textGray,
              ),
              onPressed: () => setState(() => _viewMode = 'plan'),
            ),
            Consumer<OperationsProvider>(
              builder: (_, ops, __) => IconButton(
                icon: ops.loadingServicePoints
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
                onPressed: ops.loadingServicePoints
                    ? null
                    : ops.loadServicePoints,
              ),
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton(
          backgroundColor: HaHoColors.primary,
          foregroundColor: Colors.white,
          tooltip: 'New service point',
          onPressed: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.white,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (_) => const ServicePointFormSheet(),
          ),
          child: const Icon(Icons.add),
        ),
        body: Consumer<OperationsProvider>(
          builder: (context, ops, _) {
            final all = ops.servicePoints;
            // Distinct kinds for the filter row
            final kinds = <String>{
              for (final sp in all)
                if ((sp.kind ?? '').isNotEmpty) sp.kind!,
            }.toList()..sort();

            // Apply filters (only used by the grid view; floor plan ignores)
            var list = all.where((sp) => sp.isActive).toList();
            if (_kindFilter.isNotEmpty) {
              list = list.where((sp) => sp.kind == _kindFilter).toList();
            }
            if (_statusFilter.isNotEmpty) {
              list = list.where((sp) => sp.status == _statusFilter).toList();
            }
            list.sort((a, b) {
              final ao = a.sortOrder ?? 999;
              final bo = b.sortOrder ?? 999;
              if (ao != bo) return ao.compareTo(bo);
              return a.displayLabel.compareTo(b.displayLabel);
            });

            return Column(
              children: [
                // Status filter row — all seven backend statuses + "All". Scrolls
                // horizontally on narrow screens so every option fits. Colors
                // serve as indicators (dot on the left); the selected state uses
                // a dark fill so contrast stays readable regardless of tone.
                SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: HaHoSpacing.lg,
                      vertical: HaHoSpacing.sm,
                    ),
                    children: [
                      _StatusPill(
                        label: 'All',
                        count: all.length,
                        color: HaHoColors.textGray,
                        selected: _statusFilter.isEmpty,
                        onTap: () => setState(() => _statusFilter = ''),
                      ),
                      for (final s in const [
                        ('available', 'Available', _Tone.green),
                        ('occupied', 'Occupied', _Tone.coral),
                        ('reserved', 'Reserved', _Tone.purple),
                        ('dirty', 'Needs cleaning', _Tone.amber),
                        ('blocked', 'Blocked', _Tone.red),
                        ('closed', 'Closed', _Tone.slate),
                      ])
                        _StatusPill(
                          label: s.$2,
                          count: all.where((sp) => sp.status == s.$1).length,
                          color: _toneColor(s.$3),
                          selected: _statusFilter == s.$1,
                          onTap: () => setState(
                            () => _statusFilter = _statusFilter == s.$1
                                ? ''
                                : s.$1,
                          ),
                        ),
                    ],
                  ),
                ),
                // Kind filter chips: only when there is more than one kind to pick
                if (kinds.length > 1)
                  SizedBox(
                    height: 40,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: HaHoSpacing.lg,
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: const Text('All kinds'),
                            selected: _kindFilter.isEmpty,
                            onSelected: (_) => setState(() => _kindFilter = ''),
                          ),
                        ),
                        ...kinds.map(
                          (k) => Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(k.isEmpty ? k : k[0].toUpperCase() + k.substring(1)),
                              selected: _kindFilter == k,
                              onSelected: (sel) =>
                                  setState(() => _kindFilter = sel ? k : ''),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: HaHoSpacing.sm),
                Expanded(
                  child: _viewMode == 'plan'
                      ? const FloorPlanScreen()
                      : (list.isEmpty
                            ? Center(
                                child: Text(
                                  all.isEmpty
                                      ? 'No service points configured'
                                      : 'No spots match',
                                  style: HaHoTextStyles.body.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                ),
                              )
                            : RefreshIndicator(
                                onRefresh: ops.loadServicePoints,
                                child: LayoutBuilder(
                                  builder: (context, c) {
                                    // Keep occupied-table details readable on phones.
                                    final cols = ((c.maxWidth - 32) / 170)
                                        .floor()
                                        .clamp(1, 6);
                                    return GridView.builder(
                                      padding: const EdgeInsets.fromLTRB(
                                        HaHoSpacing.lg,
                                        0,
                                        HaHoSpacing.lg,
                                        HaHoSpacing.lg,
                                      ),
                                      gridDelegate:
                                          SliverGridDelegateWithFixedCrossAxisCount(
                                            crossAxisCount: cols,
                                            mainAxisSpacing: 8,
                                            crossAxisSpacing: 8,
                                            mainAxisExtent:
                                                144 *
                                                MediaQuery.textScalerOf(context)
                                                    .scale(1),
                                          ),
                                      itemCount: list.length,
                                      itemBuilder: (_, i) =>
                                          ServicePointTile(sp: list[i]),
                                    );
                                  },
                                ),
                              )),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Color tone tokens for the status filter row. Each tone has a clearly
/// distinct hue; the actual color is computed from this rather than reusing
/// HaHo brand colors so we don't end up with red-on-red or yellow-on-yellow.
enum _Tone { green, coral, purple, amber, red, slate }

Color _toneColor(_Tone t) {
  switch (t) {
    case _Tone.green:
      return const Color(0xFF10B981); // emerald
    case _Tone.coral:
      return const Color(0xFFEF4444); // for occupied (real "in-use")
    case _Tone.purple:
      return const Color(0xFF8B5CF6); // reserved
    case _Tone.amber:
      return const Color(0xFFF59E0B); // dirty
    case _Tone.red:
      return const Color(0xFFDC2626); // blocked
    case _Tone.slate:
      return const Color(0xFF64748B); // closed
  }
}

class _StatusPill extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool selected;
  final VoidCallback onTap;
  const _StatusPill({
    required this.label,
    required this.count,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // Unselected: white pill with colored dot (always readable).
    // Selected:  dark slate fill, white text, colored dot — same readable
    //            color contrast regardless of which tone the chip uses.
    final fg = selected ? Colors.white : HaHoColors.textDark;
    final bg = selected ? const Color(0xFF1F2937) : Colors.white;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HaHoRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
            border: Border.all(
              color: selected ? bg : HaHoColors.border,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: fg,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? Colors.white.withValues(alpha: 0.85)
                      : HaHoColors.textGray,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
