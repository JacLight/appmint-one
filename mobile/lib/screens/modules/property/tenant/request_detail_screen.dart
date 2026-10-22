import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/sla_policy.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/tenancy_provider.dart';
import '../../../../services/property_api.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';

/// One request, both sides.
///
/// The resident reads it to find out whether anything is happening; the
/// manager opens the same screen with [asManager] to move it on. One screen
/// because the facts are the same facts, and two would drift.
class RequestDetailScreen extends StatefulWidget {
  final Map<String, dynamic> request;
  final bool asManager;
  const RequestDetailScreen(
      {super.key, required this.request, this.asManager = false});

  @override
  State<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState extends State<RequestDetailScreen> {
  late Map<String, dynamic> _r = widget.request;
  bool _busy = false;
  String? _error;

  String get _number => '${_r['name'] ?? _r['sk'] ?? ''}';

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final n = _number;
    if (n.isEmpty) return;
    try {
      final full = await propertyApi.request(n);
      if (!mounted || full.isEmpty) return;
      setState(() => _r = {..._r, ...full});
    } catch (_) {
      // The row we were handed is still the truth as of the list read.
    }
  }

  Future<void> _setStatus(String status) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Two routes on purpose: the resident's own write refuses a ticket
      // somebody else reported, and the manager's refuses one outside their
      // buildings. Neither side can touch what is not theirs.
      if (widget.asManager) {
        await propertyApi.hostUpdateRequest(
          '${_r['sk'] ?? _number}',
          status: status,
        );
      } else {
        await propertyApi.updateRequest({
          'sk': _r['sk'],
          'name': _number,
          'status': status,
        });
      }
      if (!mounted) return;
      setState(() {
        _r = {..._r, 'status': status};
        _busy = false;
      });
      // Keep the lists the two sides read in step with what just happened.
      if (mounted) context.read<TenancyProvider>().load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '$e'.replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final clock = SlaClock.of(_r);
    final status = '${_r['status'] ?? ''}';
    final title = '${_r['title'] ?? 'Request'}';
    final description = '${_r['description'] ?? ''}'.trim();
    final unit = '${_r['unit'] ?? ''}'.trim();
    final who = '${_r['reportedBy'] ?? ''}'.trim();
    final phone = '${_r['reportedByPhone'] ?? ''}'.trim();
    final mayEnter = _r['mayEnter'] == true;
    final access = '${_r['access'] ?? ''}'.trim();
    final assigned = '${_r['assignTo'] ?? ''}'.trim();
    final resolution = _r['resolution'];
    final opened = clock.opened;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text(_number.isEmpty ? 'Request' : '#$_number',
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700, color: SColors.ink)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.sm, SSpace.lg, SSpace.xxl),
        children: [
          Text(title,
              style: TextStyle(
                fontSize: 21,
                height: 1.2,
                fontWeight: FontWeight.w800,
                color: SColors.ink,
                fontFamily: brand.displayFont,
              )),
          const SizedBox(height: SSpace.md),
          Row(
            children: [
              SlaChip(clock: clock),
              const SizedBox(width: SSpace.sm),
              _StatusPill(status: status),
            ],
          ),
          const SizedBox(height: SSpace.lg),

          // The promise, spelled out. "Routine" means nothing on its own.
          Container(
            padding: const EdgeInsets.all(SSpace.lg),
            decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(color: SColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(clock.target.label,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                            color: SColors.ink)),
                    const Spacer(),
                    Text(
                      'respond ${_short(clock.target.respond)} · fix ${_short(clock.target.resolve)}',
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 11.5),
                    ),
                  ],
                ),
                const SizedBox(height: SSpace.sm),
                Text(clock.target.meaning,
                    style: const TextStyle(
                        color: SColors.muted, fontSize: 12, height: 1.35)),
                if (opened != null) ...[
                  const Divider(height: SSpace.xl, color: SColors.line2),
                  _Fact(k: 'Reported', v: _when(opened)),
                  if (clock.due != null)
                    _Fact(
                        k: '${clock.what} due',
                        v: _when(clock.due!),
                        danger: clock.breached),
                ],
              ],
            ),
          ),

          if (description.isNotEmpty) ...[
            const SectionHead(
              title: 'What was reported',
              padding: EdgeInsets.fromLTRB(0, SSpace.xl, 0, SSpace.md),
            ),
            Text(description,
                style: const TextStyle(
                    color: SColors.ink2, fontSize: 14, height: 1.5)),
          ],

          const SectionHead(
            title: 'Details',
            padding: EdgeInsets.fromLTRB(0, SSpace.xl, 0, SSpace.md),
          ),
          Container(
            padding: const EdgeInsets.all(SSpace.lg),
            decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(color: SColors.line),
            ),
            child: Column(
              children: [
                if (unit.isNotEmpty) _Fact(k: 'Where', v: unit),
                if (widget.asManager && who.isNotEmpty)
                  _Fact(k: 'Reported by', v: who),
                if (widget.asManager && phone.isNotEmpty)
                  _Fact(k: 'Phone', v: phone),
                _Fact(k: 'Entry', v: mayEnter ? 'May enter when out' : 'By appointment'),
                if (access.isNotEmpty) _Fact(k: 'Access notes', v: access),
                if (assigned.isNotEmpty) _Fact(k: 'Assigned to', v: assigned),
              ],
            ),
          ),

          if (resolution is Map &&
              '${resolution['summary'] ?? ''}'.trim().isNotEmpty) ...[
            const SectionHead(
              title: 'How it was fixed',
              padding: EdgeInsets.fromLTRB(0, SSpace.xl, 0, SSpace.md),
            ),
            Container(
              padding: const EdgeInsets.all(SSpace.lg),
              decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${resolution['summary']}',
                      style: const TextStyle(
                          color: SColors.green2, fontSize: 13.5, height: 1.45)),
                  if ('${resolution['resolvedBy'] ?? ''}'.isNotEmpty) ...[
                    const SizedBox(height: SSpace.sm),
                    Text('— ${resolution['resolvedBy']}',
                        style: const TextStyle(
                            color: SColors.green, fontSize: 11.5)),
                  ],
                ],
              ),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: SSpace.lg),
            ModuleError(message: _error!),
          ],
        ],
      ),
      bottomNavigationBar: _Bar(
        status: status,
        asManager: widget.asManager,
        busy: _busy,
        onStatus: _setStatus,
      ),
    );
  }

  static String _short(Duration d) =>
      d.inHours >= 24 ? '${d.inDays}d' : '${d.inHours}h';

  static String _when(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '${d.day} ${months[d.month - 1]}, $h:$m';
  }
}

class _Fact extends StatelessWidget {
  final String k, v;
  final bool danger;
  const _Fact({required this.k, required this.v, this.danger = false});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 110,
              child: Text(k,
                  style: const TextStyle(color: SColors.muted, fontSize: 12.5)),
            ),
            Expanded(
              child: Text(v,
                  style: TextStyle(
                      color: danger ? SColors.danger : SColors.ink,
                      fontWeight: FontWeight.w600,
                      fontSize: 13)),
            ),
          ],
        ),
      );
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    final (Color fg, Color bg) = switch (s) {
      'done' => (SColors.green2, SColors.greenSoft),
      'canceled' => (SColors.muted, SColors.paper2),
      'blocked' => (SColors.danger, Color(0xFFFBE9E7)),
      'inprogress' => (Color(0xFF8A5B16), Color(0xFFFDF1DC)),
      _ => (SColors.ink2, SColors.paper2),
    };
    final label = switch (s) {
      'new' => 'Not picked up',
      'inprogress' => 'In progress',
      'canceled' => 'Cancelled',
      '' => 'Open',
      _ => '${s[0].toUpperCase()}${s.substring(1)}',
    };

    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: SSpace.md, vertical: SSpace.xs + 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(SRadius.pill),
      ),
      child: Text(label,
          style: TextStyle(
              color: fg, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

/// What can be done to this request right now, by whoever is looking at it.
class _Bar extends StatelessWidget {
  final String status;
  final bool asManager, busy;
  final ValueChanged<String> onStatus;
  const _Bar({
    required this.status,
    required this.asManager,
    required this.busy,
    required this.onStatus,
  });

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final s = status.toLowerCase();
    if (SlaPolicy.closed(s)) return const SizedBox.shrink();

    // The manager's moves follow the ticket's own vocabulary; the resident can
    // only withdraw what they raised.
    final actions = asManager
        ? switch (s) {
            'new' => [('Pick it up', 'open'), ('Start work', 'inprogress')],
            'open' => [('Start work', 'inprogress'), ('Waiting on parts', 'pending')],
            'pending' => [('Start work', 'inprogress'), ('Blocked', 'blocked')],
            'inprogress' => [('Mark done', 'done'), ('Blocked', 'blocked')],
            'blocked' => [('Start work', 'inprogress'), ('Mark done', 'done')],
            _ => [('Pick it up', 'open')],
          }
        : [('Withdraw', 'canceled')];

    return Container(
      padding: const EdgeInsets.fromLTRB(
          SSpace.lg, SSpace.md, SSpace.lg, SSpace.md),
      decoration: const BoxDecoration(
        color: SColors.card,
        border: Border(top: BorderSide(color: SColors.line)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            for (var i = 0; i < actions.length; i++) ...[
              if (i > 0) const SizedBox(width: SSpace.sm),
              Expanded(
                child: i == 0
                    ? FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: brand.primary,
                          padding: const EdgeInsets.symmetric(
                              vertical: SSpace.md + 2),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(SRadius.pill)),
                        ),
                        onPressed:
                            busy ? null : () => onStatus(actions[i].$2),
                        child: busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : Text(actions[i].$1,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                      )
                    : OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: SColors.ink2,
                          side: const BorderSide(color: SColors.line),
                          padding: const EdgeInsets.symmetric(
                              vertical: SSpace.md + 2),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(SRadius.pill)),
                        ),
                        onPressed:
                            busy ? null : () => onStatus(actions[i].$2),
                        child: Text(actions[i].$1,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 13)),
                      ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
