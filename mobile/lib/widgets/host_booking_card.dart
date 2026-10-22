import 'package:flutter/material.dart';
import '../config/stowbo_theme.dart';
import '../screens/host/booking_dashboard_screen.dart';
import 'stowbo_widgets.dart';

/// ONE booking card for every host list (Bookings tab, coupon usage, …).
/// Takes a row in the `host/bookings` shape and always opens the booking.
class HostBookingCard extends StatelessWidget {
  final Map<String, dynamic> row;
  /// A short note for the money row, e.g. "Coupon −$0.80".
  final String? note;
  const HostBookingCard({super.key, required this.row, this.note});

  @override
  Widget build(BuildContext context) {
    final r = row;
    final ref = (r['reference'] ?? r['booking'] ?? '').toString();
    final who = (r['customerName'] ?? '').toString().trim().isNotEmpty
        ? r['customerName'].toString()
        : (r['customer'] ?? '').toString();
    final listing = (r['listingTitle'] ?? r['listing'] ?? '').toString();
    final units = (r['units'] as num?)?.toInt() ?? 1;
    final status = (r['status'] ?? 'new').toString();
    final total = double.tryParse('${r['total']}') ?? 0;
    final balance = double.tryParse('${r['balance']}') ?? 0;
    final currency = (r['currency'] ?? 'USD').toString();
    final payState = (r['payState'] ?? '').toString();
    final when = stayLabel(r['start']?.toString(), r['end']?.toString());
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) =>
                  BookingDashboardScreen(bookingId: r['booking'].toString())),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text('#$ref',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              bookingStatusPill(status),
            ]),
            const SizedBox(height: 2),
            Text(
                [
                  if (who.isNotEmpty) who,
                  if (listing.isNotEmpty) listing,
                  '$units ${units == 1 ? 'unit' : 'units'}',
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: SColors.muted, fontSize: 13)),
            if (when.isNotEmpty) ...[
              const SizedBox(height: 2),
              Row(children: [
                const Icon(Icons.event_rounded, size: 13, color: SColors.faint),
                const SizedBox(width: 4),
                Text(when,
                    style: const TextStyle(color: SColors.faint, fontSize: 12)),
              ]),
            ],
            const SizedBox(height: SSpace.xs),
            Row(children: [
              // Money state — ALWAYS shown, so you know where every booking
              // stands (free / metered / unpaid / part-paid / paid).
              if (payState.isNotEmpty) payStatePill(payState),
              const SizedBox(width: SSpace.sm),
              if (balance > 0)
                Text('Due $currency ${balance.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, color: SColors.clay))
              else if (total > 0)
                Text('$currency ${total.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, color: SColors.ink)),
              if (note != null && note!.isNotEmpty) ...[
                const Spacer(),
                Text(note!,
                    style: const TextStyle(
                        color: SColors.green,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5)),
              ],
              const Spacer(),
              const Icon(Icons.chevron_right_rounded,
                  size: 18, color: SColors.faint),
            ]),
          ],
        ),
      ),
    );
  }
}

/// "Aug 31", "Aug 31 → Sep 2", or "Aug 31 · open" — a compact stay label.
String stayLabel(String? start, String? end) {
  final s = DateTime.tryParse(start ?? '')?.toLocal();
  if (s == null) return '';
  const mo = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  final sLbl = '${mo[s.month]} ${s.day}';
  final e = DateTime.tryParse(end ?? '')?.toLocal();
  if (end == null || end.isEmpty || e == null) return '$sLbl · open';
  final eLbl = '${mo[e.month]} ${e.day}';
  return sLbl == eLbl ? sLbl : '$sLbl → $eLbl';
}

Widget bookingStatusPill(String s) {
  Color c;
  switch (s) {
    case 'active':
    case 'stored':
      c = SColors.green;
      break;
    case 'completed':
    case 'settled':
      c = SColors.muted;
      break;
    case 'cancelled':
    case 'no_show':
      c = SColors.danger;
      break;
    default:
      c = SColors.clay; // new
  }
  final label = s.isEmpty ? '—' : s.replaceAll('_', ' ');
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
        color: c.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(SRadius.pill)),
    child: Text(label[0].toUpperCase() + label.substring(1),
        style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
  );
}
