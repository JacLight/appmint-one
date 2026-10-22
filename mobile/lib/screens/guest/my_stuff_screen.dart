import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/custody.dart';
import '../../providers/auth_provider.dart';
import '../../providers/custody_provider.dart';
import '../../widgets/stowbo_widgets.dart';
import '../chat/chat_screen.dart';
import 'booking_detail_screen.dart';

class MyStuffScreen extends StatelessWidget {
  const MyStuffScreen({super.key});

  Future<void> _reload(BuildContext context) async {
    final uid = context.read<AuthProvider>().user?.id;
    if (uid != null) await context.read<CustodyProvider>().loadForGuest(uid);
  }

  @override
  Widget build(BuildContext context) {
    final cp = context.watch<CustodyProvider>();
    final active = cp.active;
    final history =
        cp.items.where((c) => !c.isActive).toList();

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => _reload(context),
          child: cp.loading && cp.items.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(color: SColors.clay))
              : cp.items.isEmpty
                  ? ListView(children: const [
                      SizedBox(height: 120),
                      EmptyState(
                        icon: Icons.backpack_outlined,
                        title: 'Nothing stored yet',
                        subtitle:
                            'Book a spot from Browse and your active drop-offs show up here.',
                      ),
                    ])
                  : ListView(
                      padding: const EdgeInsets.all(SSpace.xl),
                      children: [
                        Text('My stuff',
                            style:
                                Theme.of(context).textTheme.displayLarge),
                        const SizedBox(height: SSpace.lg),
                        if (active.isNotEmpty) ...[
                          const SectionLabel('Active'),
                          ...active.map((c) => _CustodyTile(c)),
                          const SizedBox(height: SSpace.lg),
                        ],
                        if (history.isNotEmpty) ...[
                          const SectionLabel('History'),
                          ...history.map((c) => _CustodyTile(c)),
                        ],
                      ],
                    ),
        ),
      ),
    );
  }
}

class _CustodyTile extends StatelessWidget {
  final Custody c;
  const _CustodyTile(this.c);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: SCard(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => BookingDetailScreen(
                  bookingId: c.sk, initialTitle: c.hostName)),
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
                  Text(c.hostName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    c.status == CustodyStatus.stored
                        ? '${c.itemCount} item(s) · held ${humanDuration(c.elapsed())}'
                        : c.status == CustodyStatus.closed && c.amount != null
                            ? '${c.itemCount} item(s) · ${money(c.amount!)}'
                            : '${c.itemCount} item(s) · code ${c.handoffCode}',
                    style:
                        const TextStyle(color: SColors.muted, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(width: SSpace.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                CustodyBadge(c.status),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ChatScreen(
                        recipientId:
                            c.hostEmail.isNotEmpty ? c.hostEmail : c.hostId,
                        recipientName: c.hostName,
                        subtitle: 'Host',
                        bookingId: c.sk,
                      ),
                    ),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: const [
                    Icon(Icons.chat_bubble_outline_rounded,
                        size: 15, color: SColors.clay),
                    SizedBox(width: 4),
                    Text('Message host',
                        style: TextStyle(
                            color: SColors.clay,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700)),
                  ]),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
