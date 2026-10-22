import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/custody.dart';
import '../../providers/auth_provider.dart';
import '../../providers/custody_provider.dart';
import '../../widgets/stowbo_widgets.dart';
import '../chat/chat_screen.dart';
import 'booking_dashboard_screen.dart';

void _openDashboard(BuildContext context, String bookingId) {
  Navigator.push(
    context,
    MaterialPageRoute(
        builder: (_) => BookingDashboardScreen(bookingId: bookingId)),
  );
}

void _messageGuest(BuildContext context, String guestId, String guestName,
    String bookingId) {
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => ChatScreen(
        recipientId: guestId,
        recipientName: guestName,
        subtitle: 'Guest',
        bookingId: bookingId,
      ),
    ),
  );
}

/// The stored-items queue. Host retrieves (code match → hand back) then settles.
class HostQueueScreen extends StatelessWidget {
  const HostQueueScreen({super.key});

  Future<void> _reload(BuildContext context) async {
    final uid = context.read<AuthProvider>().user?.id;
    if (uid != null) await context.read<CustodyProvider>().loadForHost(uid);
  }

  @override
  Widget build(BuildContext context) {
    final cp = context.watch<CustodyProvider>();
    final stored = cp.stored;
    final awaiting = cp.active
        .where((c) => c.status == CustodyStatus.reserved)
        .toList();

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => _reload(context),
          child: cp.loading && cp.items.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(color: SColors.clay))
              : ListView(
                  padding: const EdgeInsets.all(SSpace.xl),
                  children: [
                    Text('Queue',
                        style: Theme.of(context).textTheme.displayLarge),
                    const SizedBox(height: SSpace.lg),
                    if (stored.isEmpty && awaiting.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 80),
                        child: EmptyState(
                          icon: Icons.inventory_2_outlined,
                          title: 'Queue is empty',
                          subtitle:
                              'Accepted drop-offs appear here until guests retrieve them.',
                        ),
                      ),
                    if (stored.isNotEmpty) ...[
                      SectionLabel('In custody · ${stored.length}'),
                      ...stored.map((c) => _StoredCard(c: c)),
                      const SizedBox(height: SSpace.lg),
                    ],
                    if (awaiting.isNotEmpty) ...[
                      SectionLabel('Reserved · not dropped off yet'),
                      ...awaiting.map((c) => _ReservedCard(c: c)),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class _StoredCard extends StatelessWidget {
  final Custody c;
  const _StoredCard({required this.c});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: SCard(
        onTap: () => _openDashboard(context, c.sk),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(c.guestName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16)),
                ),
                IconButton(
                  tooltip: 'Message guest',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.chat_bubble_outline_rounded,
                      size: 20, color: SColors.ink2),
                  onPressed: () => _messageGuest(
                    context,
                    c.guestEmail.isNotEmpty ? c.guestEmail : c.guestUserId,
                    c.guestName,
                    c.sk,
                  ),
                ),
                CustodyBadge(c.status),
              ],
            ),
            const SizedBox(height: 4),
            Row(children: [
              _chip(Icons.inventory_2_outlined, '${c.itemCount} item(s)'),
              const SizedBox(width: SSpace.sm),
              _chip(Icons.schedule_rounded,
                  'held ${humanDuration(c.elapsed())}'),
              const SizedBox(width: SSpace.sm),
              _chip(Icons.payments_outlined,
                  'est. ${money(c.estimatedCharge())}'),
            ]),
            const SizedBox(height: SSpace.md),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _openDashboard(context, c.sk),
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('Open · hand back at the Counter'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
            color: SColors.paper2,
            borderRadius: BorderRadius.circular(SRadius.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: SColors.ink2),
          const SizedBox(width: 4),
          Text(text,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: SColors.ink2)),
        ]),
      );
}

class _ReservedCard extends StatelessWidget {
  final Custody c;
  const _ReservedCard({required this.c});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        onTap: () => _openDashboard(context, c.sk),
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.lg, vertical: SSpace.md),
        child: Row(children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.guestName,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('${c.itemCount} item(s) · code ${c.handoffCode}',
                    style: const TextStyle(
                        color: SColors.muted, fontSize: 13)),
              ],
            ),
          ),
          const CustodyBadge(CustodyStatus.reserved),
        ]),
      ),
    );
  }
}
