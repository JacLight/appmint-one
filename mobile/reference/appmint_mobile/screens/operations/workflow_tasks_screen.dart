import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/haho_theme.dart';
import '../../providers/operations_provider.dart';
import '../../providers/location_provider.dart';
import '../../models/kitchen_ticket.dart';
import '../../services/http_client.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/location_picker.dart';

/// Operator's workflow task screen — generic KDS-equivalent that works for
/// any vertical (kitchen prep, lab, exam-prep, application processing,
/// service bay, etc).
///
/// 1. Operator picks a workflow definition from the dropdown.
/// 2. Tasks load filtered to status in (new, pending, inprogress).
/// 3. Each task card renders task.data.payload.* (free-form) plus stage
///    info (stageId + dueDate countdown). Operator advances or completes.
class WorkflowTasksScreen extends StatefulWidget {
  final bool kitchenMode;
  const WorkflowTasksScreen({super.key, this.kitchenMode = false});

  @override
  State<WorkflowTasksScreen> createState() => _WorkflowTasksScreenState();
}

/// Keep the kitchen's workflow/location separate from the generic task screen.
class KitchenDisplayScreen extends StatelessWidget {
  const KitchenDisplayScreen({super.key});
  @override
  Widget build(BuildContext context) => ChangeNotifierProvider(
    create: (_) => OperationsProvider(kitchenOnly: true),
    child: const WorkflowTasksScreen(kitchenMode: true),
  );
}

class _WorkflowTasksScreenState extends State<WorkflowTasksScreen> {
  // Station/KDS filter — 'all' or a specific prep station (KITCHEN/BAR/…).
  String _station = 'all';
  LocationProvider? _locations;
  OperationsProvider? _ops;
  String _stationKey = '';

  Future<void> _locationChanged() async {
    if (!mounted) return;
    final location = _locations!.businessLocationName;
    final key = 'kitchen_station:${appengineHttpClient.orgId}:$location';
    if (_stationKey == key) return;
    _stationKey = key;
    _ops!.setKitchenLocation(location);
    final prefs = await SharedPreferences.getInstance();
    if (!mounted || _stationKey != key) return;
    setState(
      () => _station =
          prefs.getString(key) == null || prefs.getString(key) == 'all'
          ? 'all'
          : normalizePrepStation(prefs.getString(key)),
    );
  }

  Future<void> _selectStation(String station) async {
    setState(() => _station = station);
    if (!widget.kitchenMode) return;
    final key = _stationKey;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, station);
  }

  Future<void> _refresh() async {
    final ops = _ops;
    if (ops == null || ops.loadingTasks || ops.busy) return;
    if (ops.activeWorkflowId.isEmpty) {
      await ops.loadWorkflows();
    } else {
      await ops.loadTasks();
    }
  }

  @override
  void dispose() {
    _locations?.removeListener(_locationChanged);
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _ops = context.read<OperationsProvider>();
      if (widget.kitchenMode) {
        _locations = context.read<LocationProvider>();
        _locations!.addListener(_locationChanged);
        _locationChanged();
      }
      _ops!.loadWorkflows();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AutoRefresh(
      interval: const Duration(seconds: 3),
      onRefresh: _refresh,
      child: Scaffold(
        backgroundColor: HaHoColors.background,
        appBar: AppBar(
          title: widget.kitchenMode
              ? const LocationAppBarTitle(title: 'Prep')
              // The Home app is "Pipelines": the screen says the same.
              : const Text('Pipelines'),
          centerTitle: false,
          backgroundColor: HaHoColors.background,
          elevation: 0,
          actions: [
            Consumer<OperationsProvider>(
              builder: (_, ops, __) => IconButton(
                icon: ops.loadingTasks
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
                tooltip: 'Refresh tickets',
                onPressed: ops.loadingTasks ? null : _refresh,
              ),
            ),
          ],
        ),
        body: Consumer<OperationsProvider>(
          builder: (context, ops, _) {
            return Column(
              children: [
                if (widget.kitchenMode)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    child: Text(
                      _locations?.businessLocationName.isEmpty ?? true
                          ? 'Choose a location to show its prep tickets.'
                          : ops.lastTaskRefresh == null
                          ? 'Connecting to prep…'
                          : 'Refreshes every 3 seconds · Updated ${TimeOfDay.fromDateTime(ops.lastTaskRefresh!).format(context)}',
                    ),
                  ),
                if (ops.loadingTasks)
                  const LinearProgressIndicator(minHeight: 2),
                if (ops.error != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      'Could not update the board. Displayed tickets may be out of date. ${ops.error}',
                      style: const TextStyle(color: HaHoColors.error),
                    ),
                  ),
                if (!widget.kitchenMode)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      HaHoSpacing.lg,
                      HaHoSpacing.sm,
                      HaHoSpacing.lg,
                      HaHoSpacing.sm,
                    ),
                    child: DropdownButtonFormField<String>(
                      value: ops.activeWorkflowId.isEmpty
                          ? null
                          : ops.activeWorkflowId,
                      decoration: InputDecoration(
                        labelText: 'Workflow',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(HaHoRadius.md),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: HaHoSpacing.md,
                          vertical: 0,
                        ),
                      ),
                      hint: Text(
                        ops.workflows.isEmpty ? 'Loading…' : 'Pick a workflow',
                      ),
                      items: ops.workflows.map((wf) {
                        final data = wf['data'] is Map ? wf['data'] as Map : wf;
                        final sk = (wf['sk'] ?? data['sk'] ?? '').toString();
                        final title = (data['title'] ?? data['name'] ?? sk)
                            .toString();
                        return DropdownMenuItem(
                          value: sk,
                          child: Text(title, overflow: TextOverflow.ellipsis),
                        );
                      }).toList(),
                      onChanged: (v) {
                        if (v != null) ops.setActiveWorkflow(v);
                      },
                    ),
                  ),
                // Station / KDS filter — appears only when tasks route to stations.
                Builder(
                  builder: (_) {
                    final stations = <String>{...ops.kitchenStations};
                    for (final t in ops.tasks) {
                      stations.addAll(taskStations(t));
                    }
                    if (_station != 'all') stations.add(_station);
                    // Station chips belong to prep boards. A pipeline whose
                    // tickets carry no station (pickup, tickets, approvals)
                    // showed a meaningless "All stations · Unassigned" row.
                    if (stations.isEmpty ||
                        (!widget.kitchenMode &&
                            stations.every((s) => s == 'NONE'))) {
                      return const SizedBox.shrink();
                    }
                    final ordered = stations.toList()..sort();
                    // A station display must keep its filter when the queue empties.
                    return SizedBox(
                      height: 40,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: HaHoSpacing.lg,
                        ),
                        children: [
                          for (final s in ['all', ...ordered])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(
                                  s == 'all'
                                      ? 'All stations'
                                      : s == 'NONE'
                                      ? 'Unassigned'
                                      : s,
                                ),
                                selected: _station == s,
                                onSelected: (_) => _selectStation(s),
                                selectedColor: HaHoColors.primary.withValues(
                                  alpha: 0.15,
                                ),
                                labelStyle: HaHoTextStyles.bodySmall.copyWith(
                                  color: _station == s
                                      ? HaHoColors.primary
                                      : HaHoColors.textGray,
                                  fontWeight: FontWeight.w600,
                                ),
                                backgroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                    HaHoRadius.pill,
                                  ),
                                  side: BorderSide(
                                    color: _station == s
                                        ? HaHoColors.primary
                                        : HaHoColors.border,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
                Expanded(
                  child: ops.workflows.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(HaHoSpacing.xxxl),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.account_tree_outlined,
                                  size: 48,
                                  color: HaHoColors.textGray,
                                ),
                                const SizedBox(height: HaHoSpacing.md),
                                Text(
                                  widget.kitchenMode
                                      ? 'No prep pipeline configured'
                                      : 'No workflows configured',
                                  style: HaHoTextStyles.body.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                ),
                                const SizedBox(height: HaHoSpacing.xs),
                                Text(
                                  widget.kitchenMode
                                      ? 'Configure a prep workflow and routing for your products.'
                                      : 'Create one in admin under Workflows.',
                                  style: HaHoTextStyles.caption.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        )
                      : ops.tasks.isEmpty && !ops.loadingTasks
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(HaHoSpacing.xxxl),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.task_alt,
                                  size: 48,
                                  color: HaHoColors.success,
                                ),
                                const SizedBox(height: HaHoSpacing.md),
                                Text(
                                  'No active tasks in this workflow',
                                  style: HaHoTextStyles.body.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                ),
                                const SizedBox(height: HaHoSpacing.xs),
                                Text(
                                  'Tasks appear here when items are fired from POS or created via API.',
                                  style: HaHoTextStyles.caption.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: ops.loadTasks,
                          child: _TasksByStage(
                            workflowId: ops.activeWorkflowId,
                            station: _station,
                          ),
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TasksByStage extends StatelessWidget {
  final String workflowId;
  final String station;
  const _TasksByStage({required this.workflowId, this.station = 'all'});

  @override
  Widget build(BuildContext context) {
    return Consumer<OperationsProvider>(
      builder: (context, ops, _) {
        // Group tasks by stageId, honoring the station/KDS filter.
        final byStage = <int, List<Map<String, dynamic>>>{};
        for (final t in ops.tasks) {
          if (station != 'all' && !taskStations(t).contains(station)) continue;
          final data = t['data'] is Map ? t['data'] as Map : t;
          final stage = (data['stageId'] is num)
              ? (data['stageId'] as num).toInt()
              : 0;
          byStage.putIfAbsent(stage, () => []).add(t);
        }
        if (byStage.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(HaHoSpacing.xxxl),
              child: Text(
                'No tickets for this station',
                style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
              ),
            ),
          );
        }
        final stages = byStage.keys.toList()..sort();

        // Look up workflow definition for stage names
        final wf = ops.workflows.firstWhere((w) {
          final d = w['data'] is Map ? w['data'] as Map : w;
          return (w['sk'] ?? d['sk']).toString() == workflowId;
        }, orElse: () => <String, dynamic>{});
        final wfData = wf.isEmpty
            ? <String, dynamic>{}
            : (wf['data'] is Map
                  ? Map<String, dynamic>.from(wf['data'] as Map)
                  : wf);
        final stageDefs =
            (wfData['stages'] is List ? wfData['stages'] as List : <dynamic>[])
                .whereType<Map>()
                .toList();

        String stageName(int id) {
          for (final s in stageDefs) {
            final sid = s['id'];
            if ((sid is num ? sid.toInt() : int.tryParse('$sid') ?? -1) == id) {
              return (s['name'] ?? 'Stage $id').toString();
            }
          }
          // A task's stageId is the stage's position. Definitions with named
          // stage ids ('placed', 'preparing', …) showed "Stage 0", "Stage 1".
          if (id >= 0 && id < stageDefs.length) {
            final name = (stageDefs[id]['name'] ?? '').toString();
            if (name.isNotEmpty) return name;
          }
          return 'Stage $id';
        }

        Widget stageSection(int stage) {
          final tasks = byStage[stage] ?? const <Map<String, dynamic>>[];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  HaHoSpacing.sm,
                  HaHoSpacing.lg,
                  HaHoSpacing.sm,
                  HaHoSpacing.sm,
                ),
                child: Row(
                  children: [
                    Text(
                      '${stageName(stage)} · ${tasks.length}',
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              ...tasks.map(
                (t) => _TaskCard(
                  task: t,
                  stageName: stageName(stage),
                  kitchenMode: ops.kitchenOnly,
                ),
              ),
              if (tasks.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'No tickets',
                    style: TextStyle(color: HaHoColors.textGray),
                  ),
                ),
            ],
          );
        }

        return LayoutBuilder(
          builder: (context, constraints) {
            if (ops.kitchenOnly && constraints.maxWidth >= 800) {
              final boardStages = <int>{...stages};
              for (final definition in stageDefs) {
                final id = int.tryParse('${definition['id']}');
                if (id != null) boardStages.add(id);
              }
              final ordered = boardStages.toList()..sort();
              final width = (constraints.maxWidth / ordered.length).clamp(
                320.0,
                420.0,
              );
              return ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final stage in ordered)
                    SizedBox(
                      width: width,
                      child: ListView(
                        padding: const EdgeInsets.all(8),
                        children: [stageSection(stage)],
                      ),
                    ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                HaHoSpacing.md,
                0,
                HaHoSpacing.md,
                HaHoSpacing.lg,
              ),
              children: [for (final stage in stages) stageSection(stage)],
            );
          },
        );
      },
    );
  }
}

/// Workflow task card — ported from React `ModernWorkflowTask` so the same
/// fields show up: tier badge, customer, items, preferences chips, notes,
/// time-at-stage, due countdown, ETA, sk hash, and a slate "Advance" button
/// (not orange — orange Advance was a mobile-only invention).
class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final String stageName;
  final bool kitchenMode;
  const _TaskCard({
    required this.task,
    required this.stageName,
    this.kitchenMode = false,
  });

  static const _slateBg = Color(0xFF1F2937);
  static const _amberInk = Color(0xFFB45309);
  static const _blueInk = Color(0xFF2563EB);

  @override
  Widget build(BuildContext context) {
    final ops = context.read<OperationsProvider>();
    final taskId = (task['sk'] ?? '').toString();
    final data = task['data'] is Map
        ? Map<String, dynamic>.from(task['data'] as Map)
        : task;
    final payload = data['payload'] is Map
        ? Map<String, dynamic>.from(data['payload'] as Map)
        : <String, dynamic>{};
    final customer = payload['customer'] is Map
        ? Map<String, dynamic>.from(payload['customer'] as Map)
        : <String, dynamic>{};
    final owner = task['owner'] is Map
        ? Map<String, dynamic>.from(task['owner'] as Map)
        : <String, dynamic>{};
    final assignTo =
        (data['assignTo'] is List ? data['assignTo'] as List : <dynamic>[])
            .map((e) => e.toString())
            .toList();
    final dueDate = data['dueDate']?.toString();
    final status = (data['status'] ?? 'new').toString();
    final isDone = status == 'done' || status == 'approved';
    final tier = data['escalationTier'] is num
        ? (data['escalationTier'] as num).toInt()
        : 0;
    final history = data['history'] is List
        ? data['history'] as List
        : const [];
    final enteredAt = history.isNotEmpty && history.last is Map
        ? (history.last as Map)['modified']?.toString()
        : task['createdate']?.toString();

    // Headline: alias > orderNumber > customer.name > owner.name > title
    final headline =
        [
              payload['alias'],
              payload['orderNumber'],
              customer['name'],
              owner['name'],
              data['title'],
            ]
            .firstWhere(
              (v) => v != null && v.toString().trim().isNotEmpty,
              orElse: () => 'Untitled task',
            )
            .toString();

    final items = payload['items'] is List
        ? payload['items'] as List
        : const [];
    final preferences = payload['preferences'] is Map
        ? Map<String, dynamic>.from(payload['preferences'] as Map)
        : <String, dynamic>{};
    final note =
        [payload['notes'], payload['specialInstructions'], data['note']]
            .firstWhere(
              (v) => v != null && v.toString().trim().isNotEmpty,
              orElse: () => '',
            )
            .toString();
    // Prep tasks also store a generated text summary. The item list above
    // already renders that information; retain genuinely separate notes.
    final itemSummary = items
        .whereType<Map>()
        .map((item) {
          final options = item['options'] is List
              ? item['options'] as List
              : const [];
          final modifiers = options
              .whereType<Map>()
              .where((o) => (o['name'] ?? o['attrName']) != 'prepStation')
              .map(
                (o) => [o['value'], o['label'], o['name']].firstWhere(
                  (v) => v != null && v.toString().isNotEmpty,
                  orElse: () => '',
                ),
              )
              .where((v) => v.toString().isNotEmpty)
              .join(', ');
          final instructions = item['specialInstructions']?.toString() ?? '';
          return '${item['quantity']}× ${item['name']}'
              '${modifiers.isEmpty ? '' : ' ($modifiers)'}'
              '${instructions.isEmpty ? '' : ' — $instructions'}';
        })
        .join('; ');

    final overdue =
        dueDate != null &&
        (DateTime.tryParse(dueDate)?.isBefore(DateTime.now()) ?? false) &&
        !isDone;

    // Border + tinted bg matches React tone rules:
    //   tier 2+ → red,  tier 1 → amber,  overdue → red, done → muted, else gray
    final Color borderColor;
    final Color? bgTint;
    if (tier >= 2) {
      borderColor = const Color(0xFFFCA5A5);
      bgTint = const Color(0xFFFEF2F2);
    } else if (overdue) {
      borderColor = const Color(0xFFFECACA);
      bgTint = const Color(0xFFFEF7F7);
    } else if (tier == 1) {
      borderColor = const Color(0xFFFDE68A);
      bgTint = null;
    } else {
      borderColor = HaHoColors.border;
      bgTint = null;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.sm),
      decoration: BoxDecoration(
        color: bgTint ?? Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: borderColor),
      ),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row: status icon · headline + subline · tier · menu ──
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(_statusIcon(status), color: _statusTone(status), size: 16),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      headline,
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                        color: isDone
                            ? HaHoColors.textGray
                            : HaHoColors.textDark,
                        decoration: isDone ? TextDecoration.lineThrough : null,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (_subline(payload, headline).isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 2,
                          children: _subline(payload, headline),
                        ),
                      ),
                    if (kitchenMode && payload['station'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          normalizePrepStation(payload['station']),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF16776B),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (tier > 0)
                Container(
                  margin: const EdgeInsets.only(left: 4),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: tier >= 2
                        ? const Color(0xFFFEE2E2)
                        : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(HaHoRadius.sm),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.warning_amber,
                        color: tier >= 2 ? const Color(0xFFB91C1C) : _amberInk,
                        size: 10,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        'tier $tier',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: tier >= 2
                              ? const Color(0xFFB91C1C)
                              : _amberInk,
                        ),
                      ),
                    ],
                  ),
                ),
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints.tightFor(
                  width: 28,
                  height: 28,
                ),
                icon: const Icon(
                  Icons.more_horiz,
                  size: 18,
                  color: HaHoColors.textGray,
                ),
                onPressed: () => _showActions(context, ops, taskId),
              ),
            ],
          ),

          // ── Customer line (if present) ──
          if (customer['name'] != null ||
              customer['phone'] != null ||
              customer['email'] != null) ...[
            const SizedBox(height: HaHoSpacing.sm),
            Row(
              children: [
                const Icon(
                  Icons.person_outline,
                  size: 12,
                  color: HaHoColors.textGray,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    [
                      customer['name'] ??
                          customer['email'] ??
                          customer['phone'],
                      if (customer['phone'] != null && customer['name'] != null)
                        customer['phone'],
                    ].where((e) => e != null).join(' · '),
                    style: HaHoTextStyles.caption.copyWith(
                      color: HaHoColors.textDark,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],

          // ── Items list (kitchen ticket / pickup ticket / etc.) ──
          if (items.isNotEmpty) ...[
            const SizedBox(height: HaHoSpacing.sm),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(HaHoRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.inventory_2_outlined,
                        size: 11,
                        color: HaHoColors.textGray,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${items.length} ${items.length == 1 ? 'item' : 'items'}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: HaHoColors.textGray,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ],
                  ),
                  ...items.map((it) => _itemRow(it)),
                ],
              ),
            ),
          ],

          // ── Preferences chips ──
          if (preferences.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: preferences.entries
                  .where((e) => e.value != false && e.value != null)
                  .take(6)
                  .map(
                    (e) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(HaHoRadius.sm),
                      ),
                      child: Text(
                        e.value == true ? e.key : '${e.key}: ${e.value}',
                        style: TextStyle(
                          fontSize: 10,
                          color: HaHoColors.textGray,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],

          // ── Notes / special instructions ──
          if (note.isNotEmpty && (!kitchenMode || note != itemSummary)) ...[
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.sticky_note_2_outlined,
                  size: 11,
                  color: _amberInk,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    '"$note"',
                    style: TextStyle(
                      fontSize: kitchenMode ? 14 : 11,
                      color: _amberInk,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ],
            ),
          ],

          // ── Footer: meta + advance ──
          const SizedBox(height: HaHoSpacing.sm),
          const Divider(height: 1, color: HaHoColors.border),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (assignTo.isNotEmpty)
                      _meta(
                        Icons.person_outline,
                        assignTo.length > 1
                            ? '${assignTo.first} +${assignTo.length - 1}'
                            : assignTo.first,
                        HaHoColors.textGray,
                      ),
                    if (enteredAt != null)
                      _meta(
                        Icons.timer_outlined,
                        '${_fmtDuration(DateTime.now().difference(DateTime.parse(enteredAt)).inMilliseconds)} here',
                        HaHoColors.textDark,
                      ),
                    if (!isDone && dueDate != null)
                      _meta(
                        Icons.calendar_today_outlined,
                        _fmtCountdown(dueDate),
                        overdue ? const Color(0xFFDC2626) : HaHoColors.textGray,
                      ),
                    if (isDone)
                      _meta(
                        Icons.check_circle_outline,
                        'done',
                        const Color(0xFF059669),
                      ),
                  ],
                ),
              ),
              if (!isDone)
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _slateBg,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    minimumSize: const Size(64, 48),
                    textStyle: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onPressed: ops.busy ? null : () => ops.advanceTask(taskId),
                  icon: const Icon(Icons.arrow_forward, size: 12),
                  label: const Text('Advance'),
                ),
              const SizedBox(width: 6),
              Text(
                '#${taskId.length > 6 ? taskId.substring(taskId.length - 6) : taskId}',
                style: HaHoTextStyles.caption.copyWith(
                  fontSize: 10,
                  color: HaHoColors.border,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _subline(Map<String, dynamic> payload, [String headline = '']) {
    final parts = <Widget>[];
    // The table's key ("table-4") repeats a headline that already names it ("Table 4").
    String key(String v) => v.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    final sp = (payload['servicePointId'] ?? '').toString();
    if (sp.isNotEmpty && !key(headline).contains(key(sp))) {
      parts.add(
        _pill(Icons.place_outlined, payload['servicePointId'].toString()),
      );
    }
    if (payload['partySize'] != null) {
      parts.add(
        _pill(Icons.people_outline, 'party of ${payload['partySize']}'),
      );
    }
    if ((payload['course'] ?? '').toString().isNotEmpty) {
      parts.add(_pill(null, 'course: ${payload['course']}'));
    }
    if ((payload['seat'] ?? '').toString().isNotEmpty) {
      parts.add(_pill(null, 'seat: ${payload['seat']}'));
    }
    if ((payload['source'] ?? '').toString().isNotEmpty) {
      parts.add(
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(HaHoRadius.sm),
          ),
          child: Text(
            payload['source'].toString().toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: HaHoColors.textGray,
              letterSpacing: 0.6,
            ),
          ),
        ),
      );
    }
    return parts;
  }

  Widget _pill(IconData? icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 10, color: HaHoColors.textGray),
          const SizedBox(width: 2),
        ],
        Text(
          text,
          style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
        ),
      ],
    );
  }

  Widget _meta(IconData icon, String text, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 10, color: color),
        const SizedBox(width: 3),
        // A long assignee email overflowed the footer row (debug stripe).
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10,
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Widget _itemRow(dynamic it) {
    if (it is! Map) return const SizedBox.shrink();
    final qty = it['quantity'] ?? 1;
    final name = (it['name'] ?? it['sku'] ?? '').toString();
    // Modifiers can arrive as `options` or as `picks` (ConfigPick shape) —
    // read both so a cook never misses "no onions".
    final opts = it['options'] is List
        ? (it['options'] as List)
        : (it['picks'] is List ? (it['picks'] as List) : const []);
    final special = (it['specialInstructions'] ?? '').toString();
    // Per-guest lines: the seat leads (the runner knows who gets the plate),
    // the course follows the name.
    final seat = (it['seat'] ?? '').toString();
    final course = (it['course'] ?? '').toString();
    final optStr = opts
        .whereType<Map>()
        .where((o) => (o['name'] ?? o['attrName']) != 'prepStation')
        .map((o) => (o['label'] ?? o['value'] ?? '').toString())
        .where((s) => s.isNotEmpty)
        .join(' · ');
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: RichText(
        text: TextSpan(
          style: TextStyle(
            fontSize: kitchenMode ? 16 : 11,
            color: const Color(0xFF334155),
          ),
          children: [
            TextSpan(
              text: '${qty}×  ',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: HaHoColors.textDark,
                fontFamily: 'monospace',
              ),
            ),
            if (seat.isNotEmpty)
              TextSpan(
                text: 'Seat $seat  ',
                style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8)),
              ),
            TextSpan(text: name),
            if (course.isNotEmpty)
              TextSpan(
                text: ' · ${course[0].toUpperCase()}${course.substring(1)}',
                style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF7C3AED)),
              ),
            if (optStr.isNotEmpty)
              TextSpan(
                text: ' · $optStr',
                style: const TextStyle(color: HaHoColors.textGray),
              ),
            if (special.isNotEmpty)
              TextSpan(
                text: '  "$special"',
                style: const TextStyle(
                  color: _amberInk,
                  fontStyle: FontStyle.italic,
                ),
              ),
          ],
        ),
      ),
    );
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'pending':
      case 'inprogress':
        return Icons.access_time;
      case 'blocked':
      case 'rejected':
        return Icons.error_outline;
      case 'done':
      case 'approved':
        return Icons.check_circle_outline;
      case 'canceled':
        return Icons.cancel_outlined;
      default:
        return Icons.circle_outlined;
    }
  }

  Color _statusTone(String status) {
    switch (status) {
      case 'pending':
        return const Color(0xFFCA8A04);
      case 'inprogress':
        return _blueInk;
      case 'blocked':
      case 'rejected':
        return const Color(0xFFDC2626);
      case 'done':
      case 'approved':
        return const Color(0xFF059669);
      case 'canceled':
        return HaHoColors.textGray;
      default:
        return HaHoColors.textGray;
    }
  }

  String _fmtDuration(int ms) {
    if (ms < 0) ms = 0;
    if (ms < 60000) return '${(ms / 1000).round()}s';
    final min = (ms / 60000).round();
    if (min < 60) return '${min}m';
    final hr = (min / 60).round();
    if (hr < 24) return '${hr}h';
    return '${(hr / 24).round()}d';
  }

  String _fmtCountdown(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    final ms = d.difference(DateTime.now()).inMilliseconds;
    final overdue = ms < 0;
    final min = (ms.abs() / 60000).round();
    if (min < 60) return overdue ? '${min}m late' : '${min}m left';
    final hr = (min / 60).round();
    return overdue ? '${hr}h late' : '${hr}h left';
  }

  void _showActions(
    BuildContext context,
    OperationsProvider ops,
    String taskId,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            HaHoSpacing.lg,
            HaHoSpacing.md,
            HaHoSpacing.lg,
            MediaQuery.of(sheetContext).padding.bottom + HaHoSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(
                  Icons.check_circle_outline,
                  color: HaHoColors.success,
                ),
                title: const Text(
                  'Mark done',
                  style: TextStyle(color: HaHoColors.success),
                ),
                subtitle: const Text('Finish this ticket'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  await ops.completeTask(taskId);
                },
              ),
              ListTile(
                leading: const Icon(Icons.note_add_outlined),
                title: const Text('Add note'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _showNoteSheet(context, ops, taskId);
                },
              ),
              ListTile(
                leading: const Icon(Icons.snooze),
                title: const Text('Snooze SLA'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _showSnoozeSheet(context, ops, taskId);
                },
              ),
              ListTile(
                leading: const Icon(
                  Icons.warning_amber,
                  color: HaHoColors.warning,
                ),
                title: const Text('Escalate now'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: const Text('Escalate task'),
                      content: const Text(
                        'Escalate this task to the next tier now?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          style: TextButton.styleFrom(
                            foregroundColor: HaHoColors.warning,
                          ),
                          child: const Text('Escalate'),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true) {
                    await ops.escalateTaskNow(taskId);
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.person_add),
                title: const Text('Reassign'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _showReassignSheet(context, ops, taskId);
                },
              ),
              ListTile(
                leading: const Icon(
                  Icons.cancel_outlined,
                  color: HaHoColors.error,
                ),
                title: const Text(
                  'Cancel task',
                  style: TextStyle(color: HaHoColors.error),
                ),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  await ops.cancelTask(taskId);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showNoteSheet(
    BuildContext context,
    OperationsProvider ops,
    String taskId,
  ) {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            HaHoSpacing.lg,
            HaHoSpacing.md,
            HaHoSpacing.lg,
            MediaQuery.of(sheetContext).viewInsets.bottom + HaHoSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Add note', style: HaHoTextStyles.h3),
              const SizedBox(height: HaHoSpacing.md),
              TextField(
                controller: controller,
                autofocus: true,
                maxLines: 3,
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
              const SizedBox(height: HaHoSpacing.md),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final note = controller.text.trim();
                    if (note.isEmpty) return;
                    Navigator.pop(sheetContext);
                    await ops.addTaskNote(taskId, note);
                  },
                  child: const Text('Save'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSnoozeSheet(
    BuildContext context,
    OperationsProvider ops,
    String taskId,
  ) {
    final customController = TextEditingController();
    int? selectedPreset = 15;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (statefulContext, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                HaHoSpacing.lg,
                HaHoSpacing.md,
                HaHoSpacing.lg,
                MediaQuery.of(sheetContext).viewInsets.bottom + HaHoSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Snooze SLA', style: HaHoTextStyles.h3),
                  const SizedBox(height: HaHoSpacing.sm),
                  Text(
                    'Pause SLA timers for this task. Pick a preset or enter a custom duration.',
                    style: HaHoTextStyles.caption,
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  Wrap(
                    spacing: HaHoSpacing.sm,
                    runSpacing: HaHoSpacing.sm,
                    children: [5, 15, 30, 60].map((m) {
                      final isSelected = selectedPreset == m;
                      return ChoiceChip(
                        label: Text('$m min'),
                        selected: isSelected,
                        selectedColor: HaHoColors.primary,
                        labelStyle: TextStyle(
                          color: isSelected
                              ? HaHoColors.textLight
                              : HaHoColors.textDark,
                          fontWeight: FontWeight.w600,
                        ),
                        onSelected: (sel) {
                          setSheetState(() {
                            selectedPreset = sel ? m : null;
                            if (sel) customController.clear();
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  TextField(
                    controller: customController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Custom (minutes)',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (v) {
                      if (v.isNotEmpty && selectedPreset != null) {
                        setSheetState(() => selectedPreset = null);
                      }
                    },
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final custom = int.tryParse(
                          customController.text.trim(),
                        );
                        final minutes = custom ?? selectedPreset;
                        if (minutes == null || minutes <= 0) return;
                        Navigator.pop(sheetContext);
                        await ops.snoozeTask(taskId, minutes);
                      },
                      child: const Text('Save'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showReassignSheet(
    BuildContext context,
    OperationsProvider ops,
    String taskId,
  ) {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            HaHoSpacing.lg,
            HaHoSpacing.md,
            HaHoSpacing.lg,
            MediaQuery.of(sheetContext).viewInsets.bottom + HaHoSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Reassign task', style: HaHoTextStyles.h3),
              const SizedBox(height: HaHoSpacing.sm),
              Text(
                'Comma-separated emails. Replaces the current assignee list.',
                style: HaHoTextStyles.caption,
              ),
              const SizedBox(height: HaHoSpacing.md),
              TextField(
                controller: controller,
                autofocus: true,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Assign to',
                  hintText: 'alice@x.com, bob@x.com',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: HaHoSpacing.md),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final raw = controller.text.trim();
                    if (raw.isEmpty) return;
                    final list = raw
                        .split(',')
                        .map((s) => s.trim())
                        .where((s) => s.isNotEmpty)
                        .toList();
                    if (list.isEmpty) return;
                    Navigator.pop(sheetContext);
                    await ops.reassignTask(taskId, list);
                  },
                  child: const Text('Save'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
