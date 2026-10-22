import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../models/pos_order_model.dart';
import '../../models/operations_reservation_model.dart';
import '../../providers/location_provider.dart';
import '../../providers/operations_provider.dart';
import '../../providers/pos_device_settings.dart';
import '../../services/pos_service.dart';
import '../../widgets/location_picker.dart';
import '../pos/pos_screen.dart';

/// Mobile port of `business-made/.../operations/Tabs.tsx` — operator's
/// at-a-glance view of every tab in the room, grouped by where it lives
/// (section/table), the card on file, or the guest's name. Status filter
/// chips narrow to "needs attention" / "ready" / "paid", matching the
/// React page exactly.
///
/// Endpoints (same as React):
///   GET /storefront/pos/tabs?businessLocationId=…     (open)
///   GET /storefront/pos/tabs/closed?businessLocationId=…  (closed)
///
/// Service points are pulled from OperationsProvider.servicePoints (already
/// scoped to the active location) and used to resolve `servicePointId →
/// parentName (section)` for the group-by-location view.
class TabsScreen extends StatefulWidget {
  const TabsScreen({super.key});

  @override
  State<TabsScreen> createState() => _TabsScreenState();
}

enum _StatusFilter { all, open, partial, paid, hasReady, hasOverdue }

enum _View { open, closed }

class _TabsScreenState extends State<TabsScreen> {
  _StatusFilter _statusFilter = _StatusFilter.all;
  _View _view = _View.open;
  String _q = '';
  final _searchController = TextEditingController();

  List<PosOrder> _data = const [];
  bool _loading = true;
  bool _refreshing = false;
  int _request = 0;
  String? _error;
  Timer? _pollTimer;
  LocationProvider? _locProvider;
  String _lastLocId = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _locProvider = context.read<LocationProvider>();
      _lastLocId = _locProvider!.businessLocationName;
      _locProvider!.addListener(_onLocChanged);
      _refresh();
      // Service points need to be loaded to resolve sections — piggy-back
      // on OperationsProvider which the workspace's other screens use.
      context.read<OperationsProvider>().setBusinessLocation(_lastLocId);
    });
  }

  void _onLocChanged() {
    if (!mounted) return;
    final newId = _locProvider?.businessLocationName ?? '';
    if (newId == _lastLocId) return;
    _lastLocId = newId;
    _refresh();
    context.read<OperationsProvider>().setBusinessLocation(newId);
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _searchController.dispose();
    _locProvider?.removeListener(_onLocChanged);
    super.dispose();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    // Servers need kitchen-ready and payment changes while viewing open tabs.
    if (_view != _View.open) return;
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted ||
          _refreshing ||
          !(ModalRoute.of(context)?.isCurrent ?? true))
        return;
      final state = WidgetsBinding.instance.lifecycleState;
      if (state != null && state != AppLifecycleState.resumed) return;
      _refresh(silent: true);
    });
  }

  Future<void> _refresh({bool silent = false}) async {
    final request = ++_request;
    _refreshing = true;
    setState(() {
      _loading = !silent;
      _error = null;
    });
    try {
      final loc = context.read<LocationProvider>().businessLocationName;
      final list = _view == _View.closed
          ? await posService.listClosedTabs(
              businessLocationId: loc.isEmpty ? null : loc,
            )
          : await posService.listOpenTabs(
              businessLocationId: loc.isEmpty ? null : loc,
            );
      if (!mounted || request != _request) return;
      setState(() {
        _data = list;
        _loading = false;
      });
      _startPolling();
    } catch (e) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    } finally {
      if (request == _request) _refreshing = false;
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────

  bool _hasReady(PosOrder o) {
    for (final it in o.productItems) {
      final task = it.task;
      if (task == null) continue;
      final stage = (task['stageName'] ?? '').toString().toLowerCase();
      final status = (task['status'] ?? '').toString();
      if (stage == 'ready' || (status == 'done' && stage != 'delivered'))
        return true;
    }
    return false;
  }

  bool _hasOverdue(PosOrder o) {
    final now = DateTime.now();
    for (final it in o.productItems) {
      final task = it.task;
      if (task == null) continue;
      final due = task['dueDate'];
      if (due == null) continue;
      final dt = DateTime.tryParse(due.toString());
      if (dt != null && dt.isBefore(now) && (task['status'] ?? '') != 'done') {
        return true;
      }
    }
    return false;
  }

  _Counts _counts() {
    var open = 0, partial = 0, paid = 0, ready = 0, overdue = 0;
    for (final o in _data) {
      final p = o.amountPaid;
      final t = o.displayTotal;
      if (p >= t && t > 0) {
        paid++;
      } else if (p > 0) {
        partial++;
      } else {
        open++;
      }
      if (_hasReady(o)) ready++;
      if (_hasOverdue(o)) overdue++;
    }
    return _Counts(_data.length, open, partial, paid, ready, overdue);
  }

  List<PosOrder> _filteredList() {
    final q = _q.trim().toLowerCase();
    return _data.where((o) {
      // Status bucket
      if (_statusFilter != _StatusFilter.all) {
        final t = o.displayTotal;
        final p = o.amountPaid;
        final isPaid = p >= t && t > 0;
        final isPartial = p > 0 && p < t;
        switch (_statusFilter) {
          case _StatusFilter.all:
            break;
          case _StatusFilter.open:
            if (isPaid || isPartial) return false;
            break;
          case _StatusFilter.partial:
            if (!isPartial) return false;
            break;
          case _StatusFilter.paid:
            if (!isPaid) return false;
            break;
          case _StatusFilter.hasReady:
            if (!_hasReady(o)) return false;
            break;
          case _StatusFilter.hasOverdue:
            if (!_hasOverdue(o)) return false;
            break;
        }
      }

      if (q.isEmpty) return true;
      // One search box, every field. Operator types whatever they remember —
      // a name, a card last-4, the table number, the section, the alias —
      // and we match across all of them.
      final haystack = [
        o.customerName,
        o.alias,
        o.cardLast4,
        o.servicePointId,
        o.email,
        o.phone,
        o.number,
        o.tabLabel,
      ].whereType<String>().join(' ').toLowerCase();
      return haystack.contains(q);
    }).toList();
  }

  /// Group tabs by section (parent of the service point). Walk-ups —
  /// tabs with no SP — fall into their own bucket. Search filters across
  /// every field, no separate "mode" axis.
  Map<String, List<PosOrder>> _grouped(
    List<PosOrder> list,
    Map<String, ServicePoint> spByName,
  ) {
    final out = <String, List<PosOrder>>{};
    for (final o in list) {
      final spId = o.servicePointId;
      final sec = spId == null
          ? 'Walk-up'
          : (spByName[spId]?.parentName ?? spId);
      final label = spByName[sec]?.displayName ?? sec;
      (out[label] ??= []).add(o);
    }
    return out;
  }

  // ─── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final counts = _counts();
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        centerTitle: false,
        title: const LocationAppBarTitle(title: 'Open checks'),
        backgroundColor: HaHoColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
            onPressed: _loading ? null : _refresh,
            tooltip: 'Refresh',
          ),
          if (_view == _View.open)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'New tab',
              onPressed: () => _goToPos(null),
            ),
        ],
      ),
      body: Column(
        children: [
          // Open / Closed view toggle
          Padding(
            padding: const EdgeInsets.fromLTRB(
              HaHoSpacing.lg,
              HaHoSpacing.sm,
              HaHoSpacing.lg,
              0,
            ),
            child: SegmentedButton<_View>(
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: const Color(0xFF16776B),
                selectedForegroundColor: Colors.white,
                foregroundColor: const Color(0xFF192C36),
                side: const BorderSide(color: Color(0xFFDFE6E5)),
                textStyle: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              segments: const [
                ButtonSegment(
                  value: _View.open,
                  label: Text('Open'),
                  icon: Icon(Icons.shopping_bag_outlined),
                ),
                ButtonSegment(
                  value: _View.closed,
                  label: Text('Closed'),
                  icon: Icon(Icons.archive_outlined),
                ),
              ],
              selected: {_view},
              onSelectionChanged: (s) {
                setState(() {
                  _view = s.first;
                  _q = '';
                  _searchController.clear();
                  _statusFilter = _StatusFilter.all;
                });
                _refresh();
              },
              showSelectedIcon: false,
            ),
          ),
          // Status filter chips with counts
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: HaHoSpacing.lg,
                vertical: HaHoSpacing.sm,
              ),
              children: [
                _statusChip(
                  _StatusFilter.all,
                  'All',
                  counts.all,
                  HaHoColors.textGray,
                ),
                const SizedBox(width: 4),
                _statusChip(
                  _StatusFilter.open,
                  'Open',
                  counts.open,
                  HaHoColors.textGray,
                ),
                const SizedBox(width: 4),
                _statusChip(
                  _StatusFilter.partial,
                  'Partial',
                  counts.partial,
                  HaHoColors.warning,
                ),
                const SizedBox(width: 4),
                _statusChip(
                  _StatusFilter.paid,
                  'Paid',
                  counts.paid,
                  HaHoColors.success,
                ),
                const SizedBox(width: 4),
                _statusChip(
                  _StatusFilter.hasReady,
                  'Ready',
                  counts.ready,
                  HaHoColors.success,
                ),
                const SizedBox(width: 4),
                _statusChip(
                  _StatusFilter.hasOverdue,
                  'Overdue',
                  counts.overdue,
                  HaHoColors.error,
                ),
              ],
            ),
          ),
          // Universal search — matches name / alias / card / section / phone /
          // email / number / tab label. One box, no mode pickers.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              HaHoSpacing.lg,
              0,
              HaHoSpacing.lg,
              HaHoSpacing.sm,
            ),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search tabs',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _q.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _q = '');
                        },
                      ),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(HaHoRadius.lg),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (v) => setState(() => _q = v),
            ),
          ),
          // Body
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _statusChip(_StatusFilter f, String label, int count, Color tone) {
    final selected = _statusFilter == f;
    final fg = selected ? Colors.white : HaHoColors.textDark;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => setState(() => _statusFilter = f),
        borderRadius: BorderRadius.circular(HaHoRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? tone : Colors.white,
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
            border: Border.all(
              color: selected ? tone : HaHoColors.border,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
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

  Widget _buildBody() {
    if (_loading && _data.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(HaHoSpacing.xxxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: HaHoColors.error,
              ),
              const SizedBox(height: HaHoSpacing.md),
              Text(
                _error!,
                style: HaHoTextStyles.body.copyWith(color: HaHoColors.error),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: HaHoSpacing.lg),
              ElevatedButton(onPressed: _refresh, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    final list = _filteredList();
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(HaHoSpacing.xxxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _view == _View.closed
                    ? Icons.archive_outlined
                    : Icons.receipt_long_outlined,
                size: 48,
                color: HaHoColors.textGray,
              ),
              const SizedBox(height: HaHoSpacing.md),
              Text(
                _view == _View.closed ? 'No closed tabs' : 'No open tabs',
                style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
              ),
              const SizedBox(height: HaHoSpacing.xs),
              Text(
                _view == _View.closed
                    ? 'Tabs that have been settled, cancelled, refunded, or returned will appear here.'
                    : 'Open one from POS — order first, settle after service.',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
                textAlign: TextAlign.center,
              ),
              if (_view == _View.open) ...[
                const SizedBox(height: HaHoSpacing.lg),
                ElevatedButton.icon(
                  onPressed: () => _goToPos(null),
                  icon: const Icon(Icons.add),
                  label: const Text('Go to POS'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Consumer<OperationsProvider>(
      builder: (context, ops, _) {
        final spByName = <String, ServicePoint>{};
        for (final sp in ops.servicePoints) {
          if (sp.name.isNotEmpty) spByName[sp.name] = sp;
        }
        final grouped = _grouped(list, spByName);

        return LayoutBuilder(
          builder: (context, constraints) {
            // Responsive column count to match the React breakpoints:
            //   ≥1280 → 3 cols, ≥768 → 2 cols, else 1 col
            final w = constraints.maxWidth;
            final cols = w >= 1280
                ? 3
                : w >= 768
                ? 2
                : 1;
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  HaHoSpacing.lg,
                  HaHoSpacing.sm,
                  HaHoSpacing.lg,
                  HaHoSpacing.xxxl,
                ),
                children: [
                  // End of shift: what the closed checks took today.
                  if (_view == _View.closed) _TodayTotals(tabs: _data),
                  ...grouped.entries.map((entry) {
                  final label = entry.key;
                  final tabs = entry.value;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          0,
                          HaHoSpacing.lg,
                          0,
                          HaHoSpacing.sm,
                        ),
                        child: Row(
                          children: [
                            Text(
                              label.toUpperCase(),
                              style: HaHoTextStyles.caption.copyWith(
                                fontWeight: FontWeight.w700,
                                color: HaHoColors.textGray,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              '${tabs.length} ${tabs.length == 1 ? 'tab' : 'tabs'}',
                              style: HaHoTextStyles.caption.copyWith(
                                color: HaHoColors.textGray,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Wrap(
                        spacing: HaHoSpacing.sm,
                        runSpacing: HaHoSpacing.sm,
                        children: [
                          for (final tab in tabs)
                            SizedBox(
                              width:
                                  (w -
                                      2 * HaHoSpacing.lg -
                                      (cols - 1) * HaHoSpacing.sm) /
                                  cols,
                              child: _TabCard(
                                order: tab,
                                spByName: spByName,
                                onOpen: () => _goToPos(tab),
                                onSettle: () => _goToPos(tab, settle: true),
                                onClose: () => _closeCheck(tab),
                              ),
                            ),
                        ],
                      ),
                    ],
                  );
                }),
                ],
              ),
            );
          },
        );
      },
    );
  }

  /// A paid check closes from the list: the server checks the balance and that
  /// every ticket is done, then marks the table for cleaning.
  Future<void> _closeCheck(PosOrder tab) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await posService.closeTab(tab.sk);
      messenger.showSnackBar(SnackBar(
        content: Text((tab.servicePointId ?? '').isEmpty
            ? '${tab.displayLabel} closed.'
            // Another check at the same table (split by seat) keeps the party seated.
            : _data.any((o) => o.sk != tab.sk && o.servicePointId == tab.servicePointId)
                ? '${tab.displayLabel} closed. The table stays seated for its other check.'
                : '${tab.displayLabel} closed. The table is marked for cleaning.'),
      ));
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(e.toString().replaceFirst('Exception: ', '')),
        backgroundColor: HaHoColors.error,
      ));
    }
    if (mounted) await _refresh();
  }

  void _goToPos(PosOrder? tab, {bool settle = false}) {
    // Deep-link into POS — mirrors React's `Link to=/operations/pos?tab=:sk&action=settle`.
    // Passing initialTabSk causes PosScreen to focus that tab's cart on
    // first paint; settle=true also auto-pushes the Checkout screen.
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PosScreen(
          businessLocationId: '',
          initialTabSk: tab?.sk,
          initialAction: settle ? 'settle' : null,
        ),
      ),
    ).then((_) {
      // Back from the till: show what was just paid or sent, not the list
      // as it was before (a settled check still offered Settle).
      if (mounted) _refresh();
    });
  }
}

class _Counts {
  final int all, open, partial, paid, ready, overdue;
  _Counts(
    this.all,
    this.open,
    this.partial,
    this.paid,
    this.ready,
    this.overdue,
  );
}

class _TabCard extends StatelessWidget {
  final PosOrder order;
  final Map<String, ServicePoint> spByName;
  final VoidCallback onOpen;
  final VoidCallback onSettle;
  final VoidCallback? onClose;

  const _TabCard({
    required this.order,
    required this.spByName,
    required this.onOpen,
    required this.onSettle,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final items = order.productItems;
    final itemCount = items.length;
    final total = order.displayTotal;
    final paid = order.amountPaid;
    final remaining = (total - paid).clamp(0, double.infinity);
    final isPaid = paid >= total && total > 0;
    final isPartial = paid > 0 && paid < total;

    final ready = items.where((it) {
      final task = it.task;
      if (task == null) return false;
      final stage = (task['stageName'] ?? '').toString().toLowerCase();
      final status = (task['status'] ?? '').toString();
      return stage == 'ready' || (status == 'done' && stage != 'delivered');
    }).length;
    final overdue = items.where((it) {
      final task = it.task;
      if (task == null) return false;
      final due = task['dueDate'];
      if (due == null) return false;
      final dt = DateTime.tryParse(due.toString());
      return dt != null &&
          dt.isBefore(DateTime.now()) &&
          (task['status'] ?? '') != 'done';
    }).length;

    final spId = order.servicePointId;
    final spDisplay = spId == null
        ? null
        : (spByName[spId]?.displayName ?? spId);
    final customerName = order.customerName;

    // Headline = alias > customer name > spot label > "Walk-in"
    final headline = (order.alias?.isNotEmpty == true)
        ? order.alias!
        : (customerName?.isNotEmpty == true)
        ? customerName!
        : spDisplay ?? 'Walk-in';
    final sublineParts = <String>[];
    if ((order.alias?.isNotEmpty == true) &&
        (customerName?.isNotEmpty == true) &&
        customerName != order.alias) {
      sublineParts.add(customerName!);
    }
    // The party the host seated, so the server greets the right table size.
    if (order.partySize != null && order.partySize! > 0) {
      sublineParts.add('party of ${order.partySize}');
    }
    if (spDisplay != null && spDisplay != headline) sublineParts.add(spDisplay);
    if (sublineParts.isEmpty && order.number?.isNotEmpty == true) {
      sublineParts.add('Check #${order.number}');
    }
    final subline = sublineParts.join(' · ');

    final borderColor = isPaid
        ? HaHoColors.border
        : isPartial
        ? HaHoColors.warning
        : ready > 0
        ? HaHoColors.success
        : overdue > 0
        ? HaHoColors.error
        : HaHoColors.border;

    final card = order.cardLast4;

    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(
          color: borderColor,
          width: borderColor == HaHoColors.border ? 1 : 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      headline,
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                        color: isPaid
                            ? HaHoColors.textGray
                            : HaHoColors.textDark,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subline.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          subline,
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.textGray,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    // The booking's special request rides on the check.
                    if ((order.guestNotes ?? '').trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          order.guestNotes!.trim(),
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.textGray,
                            fontStyle: FontStyle.italic,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: HaHoSpacing.sm),
              Text(
                '\$${total.toStringAsFixed(2)}',
                style: HaHoTextStyles.body.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: HaHoSpacing.sm),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              if (isPaid)
                _pill(
                  'PAID · \$${paid.toStringAsFixed(2)}',
                  HaHoColors.success,
                  Icons.check,
                )
              else if (isPartial)
                _pill(
                  'PARTIAL · \$${paid.toStringAsFixed(2)} / \$${total.toStringAsFixed(2)}',
                  HaHoColors.warning,
                  null,
                ),
              if (ready > 0 && !isPaid)
                _pill('$ready READY', HaHoColors.success, null),
              if (overdue > 0)
                _pill('$overdue OVERDUE', HaHoColors.error, null),
              _muted(
                '$itemCount ${itemCount == 1 ? 'item' : 'items'}',
                Icons.shopping_bag_outlined,
              ),
              if (card != null && card.isNotEmpty)
                _muted('•••• $card', Icons.credit_card),
            ],
          ),
          const SizedBox(height: HaHoSpacing.sm),
          const Divider(height: 1, color: HaHoColors.border),
          const SizedBox(height: HaHoSpacing.sm),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton.icon(
                onPressed: onOpen,
                icon: const Icon(Icons.arrow_forward, size: 16),
                label: Text(isPaid ? 'View check' : 'Open'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (isPaid && order.status != 'completed' && onClose != null)
                FilledButton.icon(
                  onPressed: onClose,
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('Close check'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16776B),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              // Nothing to settle on a check the host just opened.
              if (!isPaid && order.productItems.isNotEmpty)
                FilledButton.icon(
                  onPressed: onSettle,
                  icon: const Icon(Icons.receipt_outlined, size: 16),
                  label: Text(
                    isPartial
                        ? 'Settle \$${remaining.toStringAsFixed(2)}'
                        : 'Settle',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16776B),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, Color tone, IconData? icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(HaHoRadius.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: tone),
            const SizedBox(width: 2),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: tone,
            ),
          ),
        ],
      ),
    );
  }

  Widget _muted(String text, IconData icon) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: HaHoColors.textGray),
        const SizedBox(width: 2),
        Text(
          text,
          style: HaHoTextStyles.caption.copyWith(
            color: HaHoColors.textGray,
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}


/// End of shift at this location: today's closed checks, what they took by
/// payment method, tax, tips owed to staff, refunds, and the cash that should
/// be in the drawer. Read from the closed checks' own payment records (the
/// same lines Books posts), on this device's calendar day.
class _TodayTotals extends StatelessWidget {
  final List<PosOrder> tabs;
  const _TodayTotals({required this.tabs});

  static bool _today(dynamic iso) {
    final d = DateTime.tryParse((iso ?? '').toString())?.toLocal();
    final n = DateTime.now();
    return d != null && d.year == n.year && d.month == n.month && d.day == n.day;
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<PosDeviceSettings>();
    num sales = 0, tax = 0, tips = 0, refunds = 0, cashIn = 0, cashOut = 0, deposits = 0;
    var checks = 0;
    final byMethod = <String, num>{};
    for (final t in tabs) {
      var paidToday = false;
      for (final p in t.payments) {
        if (!_today(p['date'] ?? p['at'])) continue;
        final method = (p['method'] ?? 'other').toString().toLowerCase();
        final amt = (p['amount'] as num?) ?? num.tryParse('${p['amount']}') ?? 0;
        final tip = (p['tip'] as num?) ?? num.tryParse('${p['tip']}') ?? 0;
        if (p['isRefund'] == true || amt < 0) {
          refunds += amt.abs();
          if (method == 'cash') cashOut += amt.abs();
          continue;
        }
        if ((p['status'] ?? 'paid').toString() != 'paid') continue;
        paidToday = true;
        tips += tip;
        byMethod[method] = (byMethod[method] ?? 0) + amt + tip;
        if (method == 'cash') cashIn += amt + tip;
      }
      if (paidToday) {
        checks++;
        // A standalone payment (a deposit, a fee) is money taken, not a sale.
        final other = t.productItems
            .where((l) => l.itemType == 'fee')
            .fold<num>(0, (s, l) => s + l.amount);
        sales += t.subtotal - other;
        deposits += other;
        tax += t.tax;
      }
    }
    if (checks == 0 && refunds == 0) return const SizedBox.shrink();
    String m(num v) => '\$${v.toStringAsFixed(2)}';
    Widget row(String k, String v, {bool strong = false, Color? tone}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [
            Expanded(
                child: Text(k,
                    style: (strong ? HaHoTextStyles.body : HaHoTextStyles.bodySmall)
                        .copyWith(fontWeight: strong ? FontWeight.w700 : FontWeight.w500, color: tone ?? HaHoColors.textDark))),
            Text(v,
                style: (strong ? HaHoTextStyles.body : HaHoTextStyles.bodySmall)
                    .copyWith(fontWeight: FontWeight.w700, color: tone ?? HaHoColors.textDark)),
          ]),
        );
    final methods = byMethod.keys.toList()..sort((a, b) => a == 'cash' ? -1 : (b == 'cash' ? 1 : a.compareTo(b)));
    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
      padding: const EdgeInsets.all(HaHoSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: const Color(0xFFDFE6E5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.insights_outlined, size: 20, color: Color(0xFF16776B)),
            const SizedBox(width: 8),
            Text('Today', style: HaHoTextStyles.h3),
            const Spacer(),
            Text('$checks check${checks == 1 ? '' : 's'}',
                style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.textGray)),
          ]),
          const SizedBox(height: HaHoSpacing.sm),
          row('Sales', m(sales)),
          row('Sales tax', m(tax)),
          if (deposits > 0) row('Deposits and other payments', m(deposits)),
          row('Tips owed to staff', m(tips)),
          if (refunds > 0) row('Refunds', '−${m(refunds)}', tone: HaHoColors.error),
          const Divider(height: 18),
          for (final k in methods) row(settings.displayName(k), m(byMethod[k]!)),
          const Divider(height: 18),
          row('Cash taken, after refunds', m(cashIn - cashOut), strong: true, tone: const Color(0xFF16776B)),
        ],
      ),
    );
  }
}
