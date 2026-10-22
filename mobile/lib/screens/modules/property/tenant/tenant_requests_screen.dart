import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/tenancy_provider.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';
import 'new_request_screen.dart';
import 'request_detail_screen.dart';
import 'tenant_home_screen.dart' show RequestRow;

/// Everything this resident has asked for, open first.
class TenantRequestsScreen extends StatelessWidget {
  const TenantRequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<TenancyProvider>();
    final words = CurrentSetup.words;
    final brand = CurrentSetup.brand;
    final open = t.openRequests;
    final closed = t.closedRequests;

    return Scaffold(
      backgroundColor: SColors.paper,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: brand.primary,
        foregroundColor: Colors.white,
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => NewRequestScreen(tenancy: t.current),
        )),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Report', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: t.load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl * 2),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.xs),
              child: Text(
                'My ${words.lower(LexiconKeys.requests)}',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                ),
              ),
            ),
            if (t.partialError('requests') != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                    message: t.partialError('requests')!, onRetry: t.load),
              )
            else if (t.loading && t.requests.isEmpty)
              const ModuleLoading()
            else if (t.requests.isEmpty)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.build_circle_rounded,
                  title: 'Nothing open',
                  body:
                      'Report a repair and it appears here with the time the '
                      'office has to answer it and to fix it.',
                ),
              )
            else ...[
              if (open.isNotEmpty) ...[
                SectionHead(title: 'Open · ${open.length}'),
                for (final r in open)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.lg, 0, SSpace.lg, SSpace.md),
                    child: RequestRow(
                      request: r,
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => RequestDetailScreen(request: r),
                      )),
                    ),
                  ),
              ],
              if (closed.isNotEmpty) ...[
                SectionHead(title: 'Closed · ${closed.length}'),
                for (final r in closed)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.lg, 0, SSpace.lg, SSpace.md),
                    child: Opacity(
                      opacity: 0.72,
                      child: RequestRow(
                        request: r,
                        onTap: () =>
                            Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => RequestDetailScreen(request: r),
                        )),
                      ),
                    ),
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
