import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/sla_policy.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';
import '../tenant/request_detail_screen.dart';
import '../tenant/tenant_home_screen.dart' show RequestRow;

/// The request queue, worst clock first.
///
/// This is the screen that makes an SLA mean anything: breached at the top in
/// red, about to breach next, then everything else by how long is left. A
/// queue sorted by date is a queue that lets the urgent ones rot.
class ManagerRequestsScreen extends StatefulWidget {
  const ManagerRequestsScreen({super.key});

  @override
  State<ManagerRequestsScreen> createState() => _ManagerRequestsScreenState();
}

class _ManagerRequestsScreenState extends State<ManagerRequestsScreen> {
  String _filter = 'open';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<PropertyProvider>();
      if (p.requests.isEmpty && !p.requestsLoading) p.loadRequests();
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;

    final all = p.requestQueue;
    final shown = switch (_filter) {
      'breached' => [
          for (final r in all)
            if (SlaClock.of(r).breached && !SlaClock.of(r).finished) r
        ],
      'closed' => [
          for (final r in all)
            if (SlaPolicy.closed('${r['status'] ?? ''}')) r
        ],
      _ => [
          for (final r in all)
            if (!SlaPolicy.closed('${r['status'] ?? ''}')) r
        ],
    };

    final breached = [
      for (final r in all)
        if (!SlaPolicy.closed('${r['status'] ?? ''}') &&
            SlaClock.of(r).breached)
          r
    ].length;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: p.loadRequests,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      words.term(LexiconKeys.requests),
                      style: TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                        color: SColors.ink,
                        fontFamily: brand.displayFont,
                      ),
                    ),
                  ),
                  if (breached > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.md, vertical: SSpace.xs + 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFBE9E7),
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded,
                              size: 14, color: SColors.danger),
                          const SizedBox(width: SSpace.xs + 1),
                          Text('$breached overdue',
                              style: const TextStyle(
                                  color: SColors.danger,
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            SizedBox(
              height: 42,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                children: [
                  for (final f in const [
                    ('open', 'Open'),
                    ('breached', 'Overdue'),
                    ('closed', 'Closed'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: SSpace.sm),
                      child: GestureDetector(
                        onTap: () => setState(() => _filter = f.$1),
                        child: Container(
                          alignment: Alignment.center,
                          padding: const EdgeInsets.symmetric(
                              horizontal: SSpace.lg),
                          decoration: BoxDecoration(
                            color: _filter == f.$1
                                ? brand.primary
                                : SColors.card,
                            borderRadius: BorderRadius.circular(SRadius.pill),
                            border: Border.all(
                                color: _filter == f.$1
                                    ? brand.primary
                                    : SColors.line),
                          ),
                          child: Text(f.$2,
                              style: TextStyle(
                                  color: _filter == f.$1
                                      ? Colors.white
                                      : SColors.ink2,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13)),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (p.requestsLoading && all.isEmpty)
              const ModuleLoading()
            else if (p.requestsError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                    message: p.requestsError!, onRetry: p.loadRequests),
              )
            else if (shown.isEmpty)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.verified_rounded,
                  title: switch (_filter) {
                    'breached' => 'Nothing overdue',
                    'closed' => 'Nothing closed yet',
                    _ => 'Queue is clear',
                  },
                  body: 'Every ${words.lower(LexiconKeys.request)} a resident '
                      'raises lands here with the clock already running.',
                ),
              )
            else ...[
              const SizedBox(height: SSpace.md),
              for (final r in shown)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, 0, SSpace.lg, SSpace.md),
                  child: RequestRow(
                    request: r,
                    showWho: true,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => RequestDetailScreen(
                          request: r, asManager: true),
                    )),
                  ),
                ),
            ],
            const SectionHead(title: 'The policy on this portfolio'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              child: Container(
                padding: const EdgeInsets.all(SSpace.lg),
                decoration: BoxDecoration(
                  color: SColors.card,
                  borderRadius: BorderRadius.circular(SRadius.md),
                  border: Border.all(color: SColors.line),
                ),
                child: Column(
                  children: [
                    for (final key in SlaPolicy.priorities) ...[
                      if (key != SlaPolicy.priorities.first)
                        const Divider(height: SSpace.lg, color: SColors.line2),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(SlaPolicy.targets[key]!.label,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13.5,
                                        color: SColors.ink)),
                                Text(SlaPolicy.targets[key]!.meaning,
                                    style: const TextStyle(
                                        color: SColors.muted,
                                        fontSize: 11,
                                        height: 1.3)),
                              ],
                            ),
                          ),
                          const SizedBox(width: SSpace.md),
                          Text(
                            '${_short(SlaPolicy.targets[key]!.respond)} / '
                            '${_short(SlaPolicy.targets[key]!.resolve)}',
                            style: const TextStyle(
                                color: SColors.ink2,
                                fontSize: 12,
                                fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: SSpace.lg, color: SColors.line2),
                    const Row(
                      children: [
                        Icon(Icons.info_outline_rounded,
                            size: 14, color: SColors.faint),
                        SizedBox(width: SSpace.sm),
                        Expanded(
                          child: Text(
                            'Respond / fix. These targets are the portfolio '
                            'default and apply to every request raised.',
                            style: TextStyle(
                                color: SColors.faint,
                                fontSize: 11,
                                height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _short(Duration d) =>
      d.inHours >= 24 ? '${d.inDays}d' : '${d.inHours}h';
}
