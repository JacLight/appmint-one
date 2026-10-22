import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../widgets/stowbo_widgets.dart';
import 'booking_dashboard_screen.dart';

/// The list behind a dashboard number — tap "45 In custody" / "11 Overdue" and
/// land here on the actual items, each opening its booking. Nothing on the home
/// is a dead number.
class HostTodayListScreen extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final Color accent;
  const HostTodayListScreen({
    super.key,
    required this.title,
    required this.items,
    this.accent = SColors.clay,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('$title · ${items.length}')),
      body: SafeArea(
        child: items.isEmpty
            ? const EmptyState(
                icon: Icons.inbox_rounded,
                title: 'Nothing here',
                subtitle: 'This list is empty right now.')
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                    SSpace.xl, SSpace.md, SSpace.xl, 96),
                children: items.map((e) => _row(context, e)).toList(),
              ),
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> e) {
    final customer = (e['customer'] ?? '').toString();
    final listing = (e['listingTitle'] ?? e['listing'] ?? '').toString();
    final id = (e['identifier'] ?? e['unit'] ?? '').toString();
    final present = e['present'] == true;
    final overstaying = e['overstaying'] == true;
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) =>
                  BookingDashboardScreen(bookingId: e['booking'].toString())),
        ),
        child: Row(children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(right: SSpace.md),
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(customer.isEmpty ? 'Walk-in' : customer,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                if (listing.isNotEmpty || id.isNotEmpty)
                  Text('$listing${id.isEmpty ? '' : ' · $id'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 13)),
              ],
            ),
          ),
          if (overstaying)
            _tag('Overdue', SColors.danger)
          else if (present)
            _tag('Here', SColors.green),
          const SizedBox(width: SSpace.sm),
          const Icon(Icons.chevron_right_rounded, color: SColors.faint),
        ]),
      ),
    );
  }

  Widget _tag(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(SRadius.pill)),
        child: Text(text,
            style: TextStyle(
                color: color, fontWeight: FontWeight.w700, fontSize: 11.5)),
      );
}
