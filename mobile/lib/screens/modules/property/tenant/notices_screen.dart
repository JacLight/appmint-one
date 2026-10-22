import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/tenancy_provider.dart';
import '../../shared/module_states.dart';

/// The noticeboard.
///
/// A notice a resident can acknowledge is worth more than one they can only
/// dismiss: "17 of 24 have read the water shut-off" is the thing a building
/// manager actually needs.
class NoticesScreen extends StatelessWidget {
  const NoticesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<TenancyProvider>();
    final brand = CurrentSetup.brand;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: t.load,
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
                      'Notices',
                      style: TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                        color: SColors.ink,
                        fontFamily: brand.displayFont,
                      ),
                    ),
                  ),
                  if (t.unreadNotices > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.md, vertical: SSpace.xs + 2),
                      decoration: BoxDecoration(
                        color: brand.accent,
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                      child: Text('${t.unreadNotices} new',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800)),
                    ),
                ],
              ),
            ),
            if (t.partialError('notices') != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                    message: t.partialError('notices')!, onRetry: t.load),
              )
            else if (t.loading && t.notices.isEmpty)
              const ModuleLoading()
            else if (t.notices.isEmpty)
              const Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.campaign_rounded,
                  title: 'Nothing from the office',
                  body:
                      'Shut-offs, inspections, parking and anything else the '
                      'building announces lands here.',
                ),
              )
            else
              for (final n in t.notices)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, 0, SSpace.lg, SSpace.md),
                  child: _NoticeCard(notice: n),
                ),
          ],
        ),
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  final Map<String, dynamic> notice;
  const _NoticeCard({required this.notice});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final id = '${notice['id'] ?? notice['sk'] ?? ''}';
    final title = '${notice['title'] ?? 'Notice'}';
    final body = '${notice['bodyText'] ?? notice['summary'] ?? ''}'.trim();
    final category = '${notice['category'] ?? 'info'}';
    final viewer = notice['viewer'];
    final v = viewer is Map ? Map<String, dynamic>.from(viewer) : const {};
    final acknowledged = '${v['status'] ?? ''}' == 'accepted';
    final unread = v['read'] != true;

    final (Color colour, IconData icon) = switch (category) {
      'alert' => (SColors.danger, Icons.warning_amber_rounded),
      'reminder' => (SColors.amber, Icons.notifications_active_rounded),
      'announcement' => (brand.primary, Icons.campaign_rounded),
      'update' => (brand.primary, Icons.update_rounded),
      'promotion' => (brand.accent, Icons.local_offer_rounded),
      _ => (SColors.muted, Icons.info_outline_rounded),
    };

    return Container(
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        boxShadow: SShadow.soft,
        border: unread
            ? Border.all(color: colour.withValues(alpha: 0.4), width: 1.2)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: SSpace.lg, vertical: SSpace.md),
            decoration: BoxDecoration(
              color: colour.withValues(alpha: 0.09),
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(SRadius.xl)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 17, color: colour),
                const SizedBox(width: SSpace.sm),
                Text(category.toUpperCase(),
                    style: TextStyle(
                        color: colour,
                        fontSize: 10.5,
                        letterSpacing: 1.3,
                        fontWeight: FontWeight.w800)),
                const Spacer(),
                if (unread)
                  Container(
                    width: 8,
                    height: 8,
                    decoration:
                        BoxDecoration(color: colour, shape: BoxShape.circle),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(SSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w800,
                        color: SColors.ink,
                        height: 1.25)),
                if (body.isNotEmpty) ...[
                  const SizedBox(height: SSpace.sm),
                  Text(body,
                      style: const TextStyle(
                          color: SColors.ink2, fontSize: 13.5, height: 1.45)),
                ],
                const SizedBox(height: SSpace.lg),
                if (acknowledged)
                  Row(
                    children: const [
                      Icon(Icons.check_circle_rounded,
                          size: 16, color: SColors.green),
                      SizedBox(width: SSpace.sm),
                      Text('You confirmed you read this',
                          style:
                              TextStyle(color: SColors.green, fontSize: 12)),
                    ],
                  )
                else
                  Row(
                    children: [
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: brand.primary,
                          padding: const EdgeInsets.symmetric(
                              horizontal: SSpace.lg, vertical: SSpace.sm + 2),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(SRadius.pill)),
                        ),
                        onPressed: id.isEmpty
                            ? null
                            : () async {
                                final err = await context
                                    .read<TenancyProvider>()
                                    .acknowledge(id);
                                if (err != null && context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                        backgroundColor: SColors.danger,
                                        content: Text(err)),
                                  );
                                }
                              },
                        child: const Text('Got it',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13)),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
