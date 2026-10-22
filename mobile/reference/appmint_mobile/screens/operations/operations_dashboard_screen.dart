import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/haho_theme.dart';
import '../../providers/operations_dashboard_provider.dart';

/// Manager-facing operations summary. Reads workflow/analytics/wait-times
/// + workflow/escalation/breached + /upcoming and renders SLA health.
class OperationsDashboardScreen extends StatefulWidget {
  const OperationsDashboardScreen({super.key});

  @override
  State<OperationsDashboardScreen> createState() => _OperationsDashboardScreenState();
}

class _OperationsDashboardScreenState extends State<OperationsDashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Provider lives in MultiProvider so it survives navigation; only
    // start polling while THIS screen is mounted.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final dash = context.read<OperationsDashboardProvider>();
      await dash.loadWorkflows();
      if (!mounted) return;
      await dash.refresh();
      if (!mounted) return;
      dash.startAutoRefresh();
    });
  }

  @override
  void dispose() {
    // Stop polling when leaving — provider survives, timer must not.
    context.read<OperationsDashboardProvider>().stopAutoRefresh();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        title: const Text('Operations Dashboard'),
        backgroundColor: HaHoColors.background,
        elevation: 0,
        actions: [
          Consumer<OperationsDashboardProvider>(
            builder: (_, dash, __) => IconButton(
              icon: dash.loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
              onPressed: dash.loading ? null : dash.refresh,
            ),
          ),
        ],
      ),
      body: Consumer<OperationsDashboardProvider>(
        builder: (context, dash, _) {
          return RefreshIndicator(
            onRefresh: dash.refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                HaHoSpacing.lg, HaHoSpacing.md, HaHoSpacing.lg, HaHoSpacing.xxxl,
              ),
              children: [
                _WorkflowFilter(dash: dash),
                const SizedBox(height: HaHoSpacing.lg),
                if (dash.error != null)
                  Container(
                    padding: const EdgeInsets.all(HaHoSpacing.md),
                    margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
                    decoration: BoxDecoration(
                      color: HaHoColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(HaHoRadius.md),
                    ),
                    child: Text(
                      dash.error!,
                      style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.error),
                    ),
                  ),
                _WaitStatsRow(dash: dash),
                const SizedBox(height: HaHoSpacing.md),
                _ActiveCard(dash: dash),
                const SizedBox(height: HaHoSpacing.lg),
                _PerStageCard(dash: dash),
                const SizedBox(height: HaHoSpacing.xl),
                _SectionHeader(
                  label: 'Breached',
                  count: dash.breached.length,
                  color: HaHoColors.error,
                ),
                const SizedBox(height: HaHoSpacing.sm),
                if (dash.breached.isEmpty)
                  _EmptyHint(text: 'No breached tasks', icon: Icons.check_circle_outline)
                else
                  ...dash.breached.map((t) => _TaskRow(task: t, isBreached: true)),
                const SizedBox(height: HaHoSpacing.xl),
                _SectionHeader(
                  label: 'Upcoming breaches',
                  count: dash.upcoming.length,
                  color: HaHoColors.warning,
                ),
                const SizedBox(height: HaHoSpacing.sm),
                if (dash.upcoming.isEmpty)
                  _EmptyHint(text: 'Nothing due soon', icon: Icons.schedule)
                else
                  ...dash.upcoming.map((t) => _TaskRow(task: t, isBreached: false)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _WorkflowFilter extends StatelessWidget {
  final OperationsDashboardProvider dash;
  const _WorkflowFilter({required this.dash});

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: dash.selectedWorkflowId.isEmpty ? null : dash.selectedWorkflowId,
      decoration: InputDecoration(
        labelText: 'Workflow',
        filled: true,
        fillColor: HaHoColors.cardLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(HaHoRadius.md),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(HaHoRadius.md),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: HaHoSpacing.md,
          vertical: 0,
        ),
      ),
      hint: Text(dash.workflows.isEmpty ? 'Loading…' : 'All workflows'),
      isExpanded: true,
      items: [
        const DropdownMenuItem(value: '', child: Text('All workflows')),
        ...dash.workflows.map((wf) {
          final data = wf['data'] is Map ? wf['data'] as Map : wf;
          final sk = (wf['sk'] ?? data['sk'] ?? '').toString();
          final title = (data['title'] ?? data['name'] ?? sk).toString();
          return DropdownMenuItem(
            value: sk,
            child: Text(title, overflow: TextOverflow.ellipsis),
          );
        }),
      ],
      onChanged: (v) => dash.setWorkflow(v ?? ''),
    );
  }
}

class _WaitStatsRow extends StatelessWidget {
  final OperationsDashboardProvider dash;
  const _WaitStatsRow({required this.dash});

  @override
  Widget build(BuildContext context) {
    final stats = dash.waitStats;
    final flow = stats != null && stats['totalFlow'] is Map
        ? Map<String, dynamic>.from(stats['totalFlow'] as Map)
        : null;
    final mean = flow?['mean'];
    final p50 = flow?['p50'];
    final p95 = flow?['p95'];

    return Row(
      children: [
        Expanded(child: _StatTile(label: 'Avg Wait', value: _fmtMs(mean))),
        const SizedBox(width: HaHoSpacing.sm),
        Expanded(child: _StatTile(label: 'P50', value: _fmtMs(p50))),
        const SizedBox(width: HaHoSpacing.sm),
        Expanded(child: _StatTile(label: 'P95', value: _fmtMs(p95))),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  const _StatTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: HaHoTextStyles.h3.copyWith(fontSize: 20),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ActiveCard extends StatelessWidget {
  final OperationsDashboardProvider dash;
  const _ActiveCard({required this.dash});

  @override
  Widget build(BuildContext context) {
    final stats = dash.waitStats;
    final active = stats != null && stats['currentlyActive'] is Map
        ? Map<String, dynamic>.from(stats['currentlyActive'] as Map)
        : null;
    final total = active?['total'];
    final display = total is num ? total.toString() : '—';

    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.lg),
      decoration: BoxDecoration(
        color: HaHoColors.accent.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
      ),
      child: Row(
        children: [
          const Icon(Icons.bolt, color: HaHoColors.accent),
          const SizedBox(width: HaHoSpacing.md),
          Expanded(
            child: Text(
              'Currently Active',
              style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          Text(
            display,
            style: HaHoTextStyles.h3,
          ),
        ],
      ),
    );
  }
}

class _PerStageCard extends StatelessWidget {
  final OperationsDashboardProvider dash;
  const _PerStageCard({required this.dash});

  @override
  Widget build(BuildContext context) {
    final stats = dash.waitStats;
    final perStage = stats != null && stats['perStage'] is List
        ? (stats['perStage'] as List).whereType<Map>().toList()
        : <Map>[];

    if (dash.selectedWorkflowId.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(HaHoSpacing.lg),
        decoration: BoxDecoration(
          color: HaHoColors.cardLight,
          borderRadius: BorderRadius.circular(HaHoRadius.lg),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, color: HaHoColors.textGray, size: 18),
            const SizedBox(width: HaHoSpacing.sm),
            Expanded(
              child: Text(
                'Pick a workflow to see per-stage stats',
                style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.textGray),
              ),
            ),
          ],
        ),
      );
    }

    if (perStage.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(HaHoSpacing.lg),
        decoration: BoxDecoration(
          color: HaHoColors.cardLight,
          borderRadius: BorderRadius.circular(HaHoRadius.lg),
        ),
        child: Text(
          'No per-stage data yet',
          style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.textGray),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              HaHoSpacing.sm, HaHoSpacing.xs, HaHoSpacing.sm, HaHoSpacing.sm,
            ),
            child: Text('Per stage', style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
          ),
          ...perStage.map((s) => _StageRow(
                stage: Map<String, dynamic>.from(s),
                stageName: _stageName(dash, s['stageId']),
              )),
        ],
      ),
    );
  }

  String _stageName(OperationsDashboardProvider dash, dynamic stageId) {
    final id = stageId is num
        ? stageId.toInt()
        : int.tryParse('$stageId') ?? -1;
    final wf = dash.workflows.firstWhere(
      (w) {
        final d = w['data'] is Map ? w['data'] as Map : w;
        return (w['sk'] ?? d['sk']).toString() == dash.selectedWorkflowId;
      },
      orElse: () => <String, dynamic>{},
    );
    if (wf.isEmpty) return 'Stage $id';
    final wfData = wf['data'] is Map ? Map<String, dynamic>.from(wf['data'] as Map) : wf;
    final stageDefs = wfData['stages'] is List ? wfData['stages'] as List : <dynamic>[];
    for (final s in stageDefs) {
      if (s is! Map) continue;
      final sid = s['id'];
      final intSid = sid is num ? sid.toInt() : int.tryParse('$sid') ?? -2;
      if (intSid == id) {
        return (s['name'] ?? 'Stage $id').toString();
      }
    }
    return 'Stage $id';
  }
}

class _StageRow extends StatelessWidget {
  final Map<String, dynamic> stage;
  final String stageName;
  const _StageRow({required this.stage, required this.stageName});

  @override
  Widget build(BuildContext context) {
    final samples = stage['samples'];
    final mean = stage['mean'];
    final p95 = stage['p95'];
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: HaHoSpacing.sm,
        vertical: HaHoSpacing.sm,
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              stageName,
              style: HaHoTextStyles.body,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            child: Text(
              'n=${samples ?? 0}',
              style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
              textAlign: TextAlign.center,
            ),
          ),
          Expanded(
            child: Text(
              _fmtMs(mean),
              style: HaHoTextStyles.bodySmall,
              textAlign: TextAlign.right,
            ),
          ),
          const SizedBox(width: HaHoSpacing.sm),
          Expanded(
            child: Text(
              _fmtMs(p95),
              style: HaHoTextStyles.bodySmall.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _SectionHeader({required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(width: HaHoSpacing.sm),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.sm, vertical: 2),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
          ),
          child: Text(
            count.toString(),
            style: HaHoTextStyles.caption.copyWith(
              color: HaHoColors.textDark,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _EmptyHint extends StatelessWidget {
  final String text;
  final IconData icon;
  const _EmptyHint({required this.text, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.lg),
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
      ),
      child: Row(
        children: [
          Icon(icon, color: HaHoColors.textGray, size: 18),
          const SizedBox(width: HaHoSpacing.sm),
          Text(
            text,
            style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.textGray),
          ),
        ],
      ),
    );
  }
}

class _TaskRow extends StatelessWidget {
  final Map<String, dynamic> task;
  final bool isBreached;
  const _TaskRow({required this.task, required this.isBreached});

  @override
  Widget build(BuildContext context) {
    final data = task['data'] is Map
        ? Map<String, dynamic>.from(task['data'] as Map)
        : Map<String, dynamic>.from(task);
    final sk = (task['sk'] ?? data['sk'] ?? '').toString();
    final title = (data['title'] ?? sk).toString();
    final workflowName = (data['workflowName'] ?? data['workflowTitle'] ?? '').toString();
    final dueDate = data['dueDate']?.toString();

    final accent = isBreached ? HaHoColors.error : HaHoColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.sm),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: accent, width: 1.5),
      ),
      child: InkWell(
        onTap: () => _showTaskDetails(context, data, title),
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        child: Row(
          children: [
            Icon(
              isBreached ? Icons.error_outline : Icons.schedule,
              color: accent,
              size: 20,
            ),
            const SizedBox(width: HaHoSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (workflowName.isNotEmpty)
                    Text(
                      workflowName,
                      style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            const SizedBox(width: HaHoSpacing.sm),
            if (dueDate != null)
              Text(
                _formatDue(dueDate, isBreached),
                style: HaHoTextStyles.caption.copyWith(
                  color: accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showTaskDetails(BuildContext context, Map<String, dynamic> data, String title) {
    showDialog<void>(
      context: context,
      builder: (ctx) {
        final entries = data.entries
            .where((e) => e.value != null && e.value.toString().isNotEmpty)
            .toList();
        return AlertDialog(
          title: Text(title, style: HaHoTextStyles.h3.copyWith(fontSize: 18)),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: entries.length,
              itemBuilder: (_, i) {
                final e = entries[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        e.key,
                        style: HaHoTextStyles.caption
                            .copyWith(color: HaHoColors.textGray, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        e.value.toString(),
                        style: HaHoTextStyles.bodySmall,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
          ],
        );
      },
    );
  }
}

String _formatDue(String iso, bool isBreached) {
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  final ms = d.difference(DateTime.now()).inMilliseconds;
  if (ms < 0) {
    return '${_fmtDuration(-ms)} overdue';
  }
  return 'due in ${_fmtDuration(ms)}';
}

/// Format milliseconds: <60s, <60m, <24h, else days+hours.
String _fmtMs(dynamic raw) {
  if (raw == null) return '—';
  final num? v = raw is num ? raw : num.tryParse(raw.toString());
  if (v == null) return '—';
  return _fmtDuration(v.toInt());
}

String _fmtDuration(int ms) {
  if (ms < 60 * 1000) {
    final s = (ms / 1000).round();
    return '${s}s';
  }
  if (ms < 60 * 60 * 1000) {
    final m = (ms / 60000).round();
    return '${m}m';
  }
  if (ms < 24 * 60 * 60 * 1000) {
    final h = ms ~/ (60 * 60 * 1000);
    final m = ((ms % (60 * 60 * 1000)) / 60000).round();
    return '${h}h ${m}m';
  }
  final d = ms ~/ (24 * 60 * 60 * 1000);
  final h = ((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)).round();
  return '${d}d ${h}h';
}
