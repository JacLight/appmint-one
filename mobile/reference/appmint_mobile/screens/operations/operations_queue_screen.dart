import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../models/contact_model.dart';
import '../../models/operations_reservation_model.dart';
import '../../providers/location_provider.dart';
import '../../providers/operations_provider.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/location_picker.dart';
import '../../services/operations_service.dart';
import '../scanner/code_scanner_screen.dart';
import 'book_reservation_screen.dart';

/// Reservations (bookings) screen — the forward-looking booking manager,
/// matching the desktop's ModernReservations.
///
/// Shows booked reservations (new / confirmed / pending / used / cancelled /
/// no_show). Per-row actions: **Check in** (hands the booking to the live
/// `/checkin/*` queue) and **Cancel**. Book via the calendar icon; scan a
/// reservation QR to check it in.
///
/// The live queue — walk-ins, seating, "table ready" notify, no-show — lives
/// on the **Check-in** screen (backed by the check-in Task pipeline). This
/// screen no longer writes queue statuses onto reservations.
class OperationsQueueScreen extends StatefulWidget {
  /// businessLocationId — operations are venue-scoped. Pass empty to see all.
  final String businessLocationId;
  const OperationsQueueScreen({super.key, this.businessLocationId = ''});

  @override
  State<OperationsQueueScreen> createState() => _OperationsQueueScreenState();
}

class _OperationsQueueScreenState extends State<OperationsQueueScreen> {
  @override
  void initState() {
    super.initState();
    // Tables label seated rows ("Table 5", not an id) and offer holds; the
    // booking types give each booking its check-in grace period.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ops = context.read<OperationsProvider>();
      ops.loadServicePoints();
      if (ops.reservationDefinitions.isEmpty) ops.loadReservationDefinitions();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loc = context.read<LocationProvider>();
      final ops = context.read<OperationsProvider>();
      // Ctor arg wins if non-empty; otherwise use the picker's selection.
      final venue = widget.businessLocationId.isNotEmpty
          ? widget.businessLocationId
          : loc.businessLocationName;
      // Bookings are read fresh on every visit (the provider keeps the last
      // list, so a later visit showed the morning's bookings).
      ops.setBusinessLocation(venue).then((_) {
        if (mounted) ops.loadReservations();
      });
      // React to picker changes after first frame.
      loc.addListener(_onLocationChanged);
    });
  }

  void _onLocationChanged() {
    if (!mounted) return;
    final loc = context.read<LocationProvider>();
    final ops = context.read<OperationsProvider>();
    if (widget.businessLocationId.isEmpty) {
      ops.setBusinessLocation(loc.businessLocationName);
    }
  }

  @override
  void dispose() {
    try {
      // Read-without-listen is safe in dispose since the provider outlives us.
      Provider.of<LocationProvider>(
        context,
        listen: false,
      ).removeListener(_onLocationChanged);
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Lateness and holds change by the minute while the host watches the book.
    return AutoRefresh(
      interval: const Duration(seconds: 20),
      onRefresh: () async {
        final ops = context.read<OperationsProvider>();
        if (ops.busy || ops.loadingReservations) return;
        await Future.wait([ops.loadReservations(), ops.loadServicePoints()]);
      },
      child: Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        centerTitle: false,
        title: const LocationAppBarTitle(title: 'Reservations'),
        backgroundColor: HaHoColors.background,
        elevation: 0,
        actions: [
          const SizedBox(width: HaHoSpacing.xs),
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Scan reservation',
            onPressed: () => _scanReservation(context),
          ),
          IconButton(
            icon: const Icon(Icons.calendar_month),
            tooltip: 'Book reservation',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const BookReservationScreen(),
                ),
              );
            },
          ),
          Consumer<OperationsProvider>(
            builder: (_, ops, __) => IconButton(
              icon: ops.loadingReservations
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
              onPressed: ops.loadingReservations ? null : ops.loadReservations,
            ),
          ),
        ],
      ),
      // Reservations only — future bookings + already-confirmed entries.
      // Live queue / walk-ins live on the Check-in screen, not here.
      body: const _ReservationList(filter: 'bookings'),
      ),
    );
  }

  /// Scan a reservation QR/barcode → resolve by sk OR public number →
  /// flip the matching reservation from confirmed/new → waiting (arrived).
  /// Mirrors the doc's "from-reservation" check-in but via the surviving
  /// reservation CRUD path.
  Future<void> _scanReservation(BuildContext context) async {
    final code = await scanCode(
      context,
      title: 'Scan reservation',
      hint: 'Point at the customer\'s QR / reservation barcode',
    );
    if (code == null || !context.mounted) return;
    final ops = context.read<OperationsProvider>();
    // First try treating the scanned string as an sk.
    var hits = await operationsService.getReservations(id: code);
    if (hits.isEmpty) {
      // Fall back to public number lookup.
      hits = await operationsService.findReservations();
      hits = hits.where((r) => r.number == code).toList();
    }
    if (!context.mounted) return;
    if (hits.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('No reservation matched "$code"')));
      return;
    }
    final r = hits.first;
    // Hand the booking to the live check-in queue (creates a queue task +
    // fires the ready notification) — the correct path, not an invented
    // reservation status write.
    if (r.status == 'new' || r.status == 'confirmed' || r.status == 'pending') {
      final ok = await ops.checkInReservation(
        r,
        partySize: r.partySize?.toInt(),
      );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ok ? '${r.displayLabel} checked in' : 'Found but check-in failed',
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${r.displayLabel} — already ${r.status}')),
      );
    }
  }
}

class _ReservationList extends StatefulWidget {
  /// Bookings grouped the way the desktop counts them (modern-reservations
  /// `stats`): Today, Upcoming, and Past. Past is folded away by default —
  /// the front desk works today's book, not 2024's. Location narrowing is
  /// done in the provider. Live queue / walk-ins live on the Check-in screen.
  final String filter;
  const _ReservationList({required this.filter});

  @override
  State<_ReservationList> createState() => _ReservationListState();
}

class _ReservationListState extends State<_ReservationList> {
  bool _showPast = false;

  // Grouped by the venue's day as the device sees it: a booking stored as a
  // UTC instant ("…Z") is compared in local time, or an evening booking falls
  // on the next UTC day and was listed under Past.
  static DateTime? _start(OpsReservation r) {
    final d = DateTime.tryParse(r.startTime ?? '');
    return d != null && d.isUtc ? d.toLocal() : d;
  }

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  @override
  Widget build(BuildContext context) {
    return Consumer<OperationsProvider>(
      builder: (context, ops, _) {
        final list = ops.reservations;
        if (list.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(HaHoSpacing.xxxl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.event_outlined,
                    size: 48,
                    color: HaHoColors.textGray,
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  Text(
                    'No reservations',
                    style: HaHoTextStyles.body.copyWith(
                      color: HaHoColors.textGray,
                    ),
                  ),
                  const SizedBox(height: HaHoSpacing.xs),
                  Text(
                    'Book one with the calendar icon above.',
                    style: HaHoTextStyles.caption.copyWith(
                      color: HaHoColors.textGray,
                    ),
                  ),
                ],
              ),
            ),
          );
        }
        final now = DateTime.now();
        final today = <OpsReservation>[];
        final upcoming = <OpsReservation>[];
        final past = <OpsReservation>[];
        for (final r in list) {
          final d = _start(r);
          if (d == null || _sameDay(d, now)) {
            today.add(r); // no start time = walk-in / same-day entry
          } else if (d.isAfter(now)) {
            upcoming.add(r);
          } else {
            past.add(r);
          }
        }
        int byStart(OpsReservation a, OpsReservation b) =>
            (_start(a) ?? now).compareTo(_start(b) ?? now);
        today.sort(byStart);
        upcoming.sort(byStart);
        past.sort((a, b) => byStart(b, a));

        final rows = <Widget>[];
        void section(
          String title,
          List<OpsReservation> items, {
          Widget? trailing,
        }) {
          rows.add(
            Padding(
              padding: const EdgeInsets.fromLTRB(
                HaHoSpacing.xs,
                HaHoSpacing.md,
                HaHoSpacing.xs,
                HaHoSpacing.xs,
              ),
              child: Row(
                children: [
                  Text(
                    title,
                    style: HaHoTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: HaHoSpacing.xs),
                  Text(
                    '${items.length}',
                    style: HaHoTextStyles.caption.copyWith(
                      color: HaHoColors.textGray,
                    ),
                  ),
                  const Spacer(),
                  if (trailing != null) trailing,
                ],
              ),
            ),
          );
          if (items.isEmpty) {
            rows.add(
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: HaHoSpacing.xs,
                  vertical: HaHoSpacing.sm,
                ),
                child: Text(
                  'Nothing here.',
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
              ),
            );
          }
          for (final r in items) {
            rows.add(
              Padding(
                padding: const EdgeInsets.only(bottom: HaHoSpacing.sm),
                child: _ReservationCard(reservation: r),
              ),
            );
          }
        }

        section('Today', today);
        section('Upcoming', upcoming);
        section(
          'Past',
          _showPast ? past : const [],
          trailing: past.isEmpty
              ? null
              : TextButton(
                  onPressed: () => setState(() => _showPast = !_showPast),
                  child: Text(_showPast ? 'Hide' : 'Show ${past.length}'),
                ),
        );
        if (!_showPast && past.isNotEmpty)
          rows.removeLast(); // drop the "Nothing here." under a folded Past

        return RefreshIndicator(
          onRefresh: ops.loadReservations,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              HaHoSpacing.md,
              HaHoSpacing.md,
              HaHoSpacing.md,
              100,
            ),
            children: rows,
          ),
        );
      },
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final OpsReservation reservation;
  const _ReservationCard({required this.reservation});

  Color _statusColor() {
    switch (reservation.status) {
      case 'waiting':
        return HaHoColors.warning;
      case 'notified':
        return HaHoColors.primary;
      case 'in_progress':
        return HaHoColors.success;
      case 'completed':
        return HaHoColors.textGray;
      case 'no_show':
      case 'cancelled':
        return HaHoColors.error;
      default:
        return HaHoColors.textGray;
    }
  }

  /// "Thu, Sep 10 · 3:30 PM – 4:00 PM" from the booking's startTime/endTime.
  /// Records are mixed: slot bookings carry a UTC instant ("…Z"), older ones a
  /// zone-less wall-clock string. Convert only the ones that carry a zone.
  static DateTime? _local(String? iso) {
    final d = DateTime.tryParse(iso ?? '');
    if (d == null) return null;
    return d.isUtc ? d.toLocal() : d;
  }

  String _when() {
    final start = _local(reservation.startTime);
    if (start == null) return '';
    final end = _local(reservation.endTime);
    final day = DateFormat('EEE, MMM d').format(start);
    final t = DateFormat('h:mm a');
    return end == null
        ? '$day · ${t.format(start)}'
        : '$day · ${t.format(start)} – ${t.format(end)}';
  }

  /// Seat 8 instead of a raw service-point id — resolved from the loaded
  /// service points (by sk or name); falls back to the id when unknown.
  String _spotLabel(BuildContext context, String id) {
    final sps = context.read<OperationsProvider>().servicePoints;
    for (final sp in sps) {
      if (sp.sk == id || sp.name == id) return sp.displayName ?? sp.name;
    }
    return 'Spot $id';
  }

  /// The table held for this booking, if any (status reserved, pointing back at it).
  ServicePoint? _heldTable(BuildContext context) {
    final id = reservation.servicePointId ?? '';
    if (id.isEmpty) return null;
    for (final sp in context.read<OperationsProvider>().servicePoints) {
      if ((sp.sk == id || sp.name == id) && sp.status == 'reserved' && sp.currentReservationId == reservation.sk) return sp;
    }
    return null;
  }

  /// The booking type's check-in grace period ("Check-in by", minutes); 15 when unset.
  int _graceMinutes(BuildContext context) {
    for (final d in context.read<OperationsProvider>().reservationDefinitions) {
      final data = d['data'] is Map ? d['data'] as Map : d;
      if ('${d['sk'] ?? data['sk'] ?? ''}' != (reservation.reservationDefinitionId ?? '')) continue;
      final g = data['checkInBy'];
      if (g is num && g > 0) return g.toInt();
    }
    return 15;
  }

  /// Minutes past the booked time (negative: still to come), for today's
  /// bookings not yet checked in; null otherwise.
  int? _minutesLate() {
    final start = _local(reservation.startTime);
    if (start == null || (reservation.checkedInAt ?? '').isNotEmpty) return null;
    if (!const ['new', 'confirmed', 'pending'].contains(reservation.status)) return null;
    final now = DateTime.now();
    if (start.year != now.year || start.month != now.month || start.day != now.day) return null;
    return now.difference(start).inMinutes;
  }

  bool _pastGrace(BuildContext context) {
    final late = _minutesLate();
    return late != null && late >= _graceMinutes(context);
  }

  /// "12m late · Table 6 held until 6:30 PM" — what the host watches on a late booking.
  Widget? _timingChip(BuildContext context) {
    final late = _minutesLate();
    final held = _heldTable(context);
    if (late == null || (late < -30 && held == null)) return null;
    final start = _local(reservation.startTime)!;
    final until = start.add(Duration(minutes: _graceMinutes(context)));
    final over = _pastGrace(context);
    final parts = [
      if (late > 0) '${late}m late' else if (late > -30) (late == 0 ? 'due now' : 'due in ${-late}m'),
      if (held != null && !over) '${held.displayLabel} held until ${DateFormat('h:mm a').format(until)}',
      if (over) 'grace period over at ${DateFormat('h:mm a').format(until)}',
    ];
    final color = over ? HaHoColors.error : (late > 0 ? HaHoColors.warning : HaHoColors.primary);
    return Container(
      margin: const EdgeInsets.only(top: HaHoSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(HaHoRadius.pill),
      ),
      child: Text(
        parts.join(' · '),
        style: HaHoTextStyles.caption.copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }

  String _waitedFor() {
    final ts = reservation.joinedAt;
    if (ts == null || ts.isEmpty) return '';
    final t = DateTime.tryParse(ts);
    if (t == null) return '';
    final mins = DateTime.now().difference(t).inMinutes;
    if (mins < 1) return 'just now';
    if (mins < 60) return '${mins}m ago';
    return '${(mins / 60).toStringAsFixed(1)}h ago';
  }

  @override
  Widget build(BuildContext context) {
    final r = reservation;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: HaHoColors.border, width: 1),
      ),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: _statusColor().withValues(alpha: 0.15),
                foregroundColor: _statusColor(),
                radius: 18,
                child: Text(
                  (r.partySize ?? 1).toString(),
                  style: HaHoTextStyles.body.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: HaHoSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            r.displayLabel,
                            style: HaHoTextStyles.body.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        _SourceBadge(source: r.source),
                      ],
                    ),
                    const SizedBox(height: 2),
                    if (_when().isNotEmpty)
                      Text(
                        _when(),
                        style: HaHoTextStyles.caption.copyWith(
                          color: HaHoColors.textDark,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    Text(
                      [
                        if ((r.customer?.phone ?? '').isNotEmpty)
                          ContactModel.formatPhone(r.customer!.phone!),
                        if ((r.service ?? '').isNotEmpty) r.service!,
                        if ((r.servicePointId ?? '').isNotEmpty)
                          _spotLabel(context, r.servicePointId!),
                        _waitedFor(),
                      ].where((s) => s.isNotEmpty).join(' · '),
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.textGray,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if ((r.notes ?? '').isNotEmpty) ...[
            const SizedBox(height: HaHoSpacing.xs),
            Text(
              r.notes!,
              style: HaHoTextStyles.caption.copyWith(
                color: HaHoColors.textGray,
                fontStyle: FontStyle.italic,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (_timingChip(context) != null) _timingChip(context)!,
          const SizedBox(height: HaHoSpacing.sm),
          Wrap(runSpacing: 6, children: _buildActions(context, r)),
        ],
      ),
    );
  }

  List<Widget> _buildActions(BuildContext context, OpsReservation r) {
    final ops = context.read<OperationsProvider>();
    Widget btn(
      String label,
      IconData icon,
      VoidCallback onPressed, {
      Color? color,
      bool primary = false,
    }) {
      final c = color ?? HaHoColors.primary;
      return Padding(
        padding: const EdgeInsets.only(right: HaHoSpacing.xs),
        child: primary
            ? ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: c,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: HaHoSpacing.md,
                    vertical: 8,
                  ),
                  textStyle: HaHoTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onPressed: onPressed,
                icon: Icon(icon, size: 16),
                label: Text(label),
              )
            : OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: c,
                  side: BorderSide(color: c),
                  padding: const EdgeInsets.symmetric(
                    horizontal: HaHoSpacing.md,
                    vertical: 8,
                  ),
                  textStyle: HaHoTextStyles.bodySmall,
                ),
                onPressed: onPressed,
                icon: Icon(icon, size: 16),
                label: Text(label),
              ),
      );
    }

    switch (r.status) {
      case 'new':
      case 'confirmed':
      case 'pending':
        // Already handed to the live queue (server stamps checkedInAt; a
        // walk-in is on the waitlist from the start) — seat / notify /
        // no-show happen in Arrivals from here.
        if ((r.checkedInAt ?? '').isNotEmpty || r.source == 'walk-in') {
          final t = DateTime.tryParse(r.checkedInAt ?? "");
          return [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: HaHoSpacing.sm,
                vertical: 6,
              ),
              decoration: BoxDecoration(
                color: HaHoColors.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(HaHoRadius.pill),
              ),
              child: Text(
                r.source == 'walk-in'
                    ? 'On the waitlist'
                    : t == null
                    ? 'Checked in · in Arrivals'
                    : 'Checked in ${DateFormat('h:mm a').format(t.toLocal())} · in Arrivals',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.success,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ];
        }
        // Booking, not yet arrived. "Check in" hands it to the live queue
        // (creates a queue task + fires the ready notification) via
        // /checkin/from-reservation — then seat/notify happen in Check-in.
        // A late party keeps a table held for them through the grace period;
        // after it, the booking is a no-show and the table goes back.
        final late = _minutesLate();
        final held = _heldTable(context);
        final pastGrace = _pastGrace(context);
        // A party checks in on the day of their booking, not before.
        final start = _local(r.startTime);
        final now = DateTime.now();
        final isToday = start == null ||
            (start.year == now.year && start.month == now.month && start.day == now.day);
        return [
          if (isToday) btn('Check in', Icons.login, () async {
            final messenger = ScaffoldMessenger.maybeOf(context);
            final ok = await ops.checkInReservation(r, partySize: r.partySize?.toInt());
            // A refused or failed check-in used to leave the row as it was, silently.
            messenger?.showSnackBar(SnackBar(
              content: Text(ok
                  ? '${r.displayLabel} checked in. They are in Arrivals.'
                  : (ops.error ?? 'Could not check in. Try again.')),
            ));
          }, primary: true),
          if (held == null && late != null && late > -30 && !pastGrace)
            btn('Hold a table', Icons.event_seat_outlined, () => _pickHoldTable(context, r)),
          if (pastGrace)
            btn('No-show', Icons.person_off_outlined, () async {
              final messenger = ScaffoldMessenger.maybeOf(context);
              final ok = await ops.noShow(r);
              messenger?.showSnackBar(SnackBar(
                content: Text(ok
                    ? '${r.displayLabel} is a no-show.${held != null ? ' ${held.displayLabel} is free again.' : ''}'
                    : (ops.error ?? 'Could not mark the no-show. Try again.')),
              ));
            }, color: HaHoColors.error)
          else
            btn('Cancel', Icons.close, () async {
              await ops.cancel(r);
            }, color: HaHoColors.error),
        ];
      // Once checked in, the guest lives in the live queue (Check-in tile),
      // which handles seat / notify / no-show against the check-in task. This
      // booking screen no longer drives those (it used to write invented
      // reservation statuses the server rejects). Seated/served bookings show
      // their outcome with no further action here.
      default:
        final (label, color) = switch (r.status) {
          'used' || 'arrived' || 'in_progress' || 'completed' => (
              (r.servicePointId ?? '').isNotEmpty ? 'Seated · ${_spotLabel(context, r.servicePointId!)}' : 'Seated',
              HaHoColors.success,
            ),
          'no_show' => ('No-show', HaHoColors.error),
          'cancelled' || 'canceled' => ('Cancelled', HaHoColors.textGray),
          _ => ('', HaHoColors.textGray),
        };
        if (label.isEmpty) return const [];
        return [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.sm, vertical: 6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(HaHoRadius.pill),
            ),
            child: Text(label, style: HaHoTextStyles.caption.copyWith(color: color, fontWeight: FontWeight.w600)),
          ),
        ];
    }
  }

  /// Free tables that fit the party, smallest first: the host holds one.
  Future<void> _pickHoldTable(BuildContext context, OpsReservation r) async {
    final ops = context.read<OperationsProvider>();
    await ops.loadServicePoints();
    if (!context.mounted) return;
    final party = (r.partySize ?? 1).toInt();
    final free = ops.servicePoints
        .where((sp) => sp.isActive && sp.status == 'available' && (sp.capacity ?? party) >= party)
        .toList()
      ..sort((a, b) => (a.capacity ?? 99).compareTo(b.capacity ?? 99));
    final messenger = ScaffoldMessenger.maybeOf(context);
    final picked = await showModalBottomSheet<ServicePoint>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(HaHoSpacing.lg),
          children: [
            Text('Hold a table for $party', style: HaHoTextStyles.h4),
            const SizedBox(height: HaHoSpacing.xs),
            Text('${r.displayLabel} keeps it through the grace period.',
                style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray)),
            const SizedBox(height: HaHoSpacing.md),
            if (free.isEmpty) const ListTile(title: Text('No free table fits this party right now.')),
            for (final sp in free)
              ListTile(
                leading: const Icon(Icons.event_seat),
                title: Text(sp.displayLabel),
                subtitle: sp.capacity != null ? Text('Seats ${sp.capacity}') : null,
                onTap: () => Navigator.pop(sctx, sp),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    final ok = await ops.holdTable(r, picked);
    messenger?.showSnackBar(SnackBar(
      content: Text(ok ? '${picked.displayLabel} is held for ${r.displayLabel}.' : (ops.error ?? 'Could not hold the table.')),
    ));
  }
}

class _SourceBadge extends StatelessWidget {
  final String source;
  const _SourceBadge({required this.source});

  @override
  Widget build(BuildContext context) {
    final lbl = switch (source) {
      'walk-in' => 'walk-in',
      'phone' => 'phone',
      'online' => 'online',
      'kiosk' => 'kiosk',
      'partner' => 'partner',
      'agent' => 'agent',
      'email' => 'email',
      _ => source,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.sm),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Text(
        lbl,
        style: HaHoTextStyles.caption.copyWith(
          color: HaHoColors.textGray,
          fontSize: 10,
        ),
      ),
    );
  }
}

// ─── Walk-in form sheet ──────────────────────────────────────────────────

class _WalkInSheet extends StatefulWidget {
  const _WalkInSheet();

  @override
  State<_WalkInSheet> createState() => _WalkInSheetState();
}

class _WalkInSheetState extends State<_WalkInSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();
  num _partySize = 1;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty) return;
    final ops = context.read<OperationsProvider>();
    final result = await ops.walkIn(
      customer: OpsReservationCustomer(
        name: _name.text.trim(),
        phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      ),
      partySize: _partySize,
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
    );
    if (!mounted) return;
    if (result != null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${result.displayLabel} added to queue')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ops = context.watch<OperationsProvider>();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Column(
        children: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: HaHoColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
            child: Row(
              children: [
                const Icon(Icons.person_add, color: HaHoColors.primary),
                const SizedBox(width: HaHoSpacing.sm),
                Text('New walk-in', style: HaHoTextStyles.h3),
              ],
            ),
          ),
          const SizedBox(height: HaHoSpacing.md),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
              children: [
                TextField(
                  controller: _name,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Name *'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: HaHoSpacing.md),
                TextField(
                  controller: _phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone (for SMS notify)',
                  ),
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: HaHoSpacing.md),
                Row(
                  children: [
                    Text('Party size', style: HaHoTextStyles.bodySmall),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed: _partySize > 1
                          ? () => setState(() => _partySize -= 1)
                          : null,
                    ),
                    SizedBox(
                      width: 32,
                      child: Text(
                        '$_partySize',
                        textAlign: TextAlign.center,
                        style: HaHoTextStyles.body.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: () => setState(() => _partySize += 1),
                    ),
                  ],
                ),
                const SizedBox(height: HaHoSpacing.md),
                TextField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    hintText: 'e.g. patio, highchair, allergy',
                  ),
                ),
                if (ops.error != null) ...[
                  const SizedBox(height: HaHoSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(HaHoSpacing.sm),
                    decoration: BoxDecoration(
                      color: HaHoColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(HaHoRadius.md),
                    ),
                    child: Text(
                      ops.error!,
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.error,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              HaHoSpacing.lg,
              HaHoSpacing.md,
              HaHoSpacing.lg,
              MediaQuery.of(context).padding.bottom + HaHoSpacing.md,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: HaHoColors.border)),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: HaHoColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
                ),
                onPressed: ops.busy ? null : _submit,
                child: ops.busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Add to queue'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
