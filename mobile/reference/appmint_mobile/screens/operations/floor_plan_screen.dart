import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/haho_theme.dart';
import 'service_point_form_sheet.dart';
import '../../models/operations_reservation_model.dart';
import '../../providers/app_visibility_provider.dart';
import '../../providers/checkin_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/operations_provider.dart';
import '../../services/pos_service.dart';
import '../pos/pos_screen.dart';
import 'checkin_screen.dart';

/// Floor-plan canvas view of service points.
///
/// Renders SPs at their authored x/y coordinates inside an InteractiveViewer
/// (pan + pinch-zoom) so a single screen can show a whole venue layout. SPs
/// without coordinates fall through to a flat Wrap below the canvas so we
/// never silently drop data.
///
/// The canvas is sized to the bounding box of all positioned SPs plus a
/// padding margin so panning to the edge still feels natural.
class FloorPlanScreen extends StatelessWidget {
  const FloorPlanScreen({super.key});

  static const double _canvasPadding = 100;

  @override
  Widget build(BuildContext context) {
    return Consumer<OperationsProvider>(
      builder: (context, ops, _) {
        final all = ops.servicePoints.where((sp) => sp.isActive).toList();
        final positioned = all
            .where((sp) => sp.x != null && sp.y != null)
            .toList();
        final unpositioned = all
            .where((sp) => sp.x == null || sp.y == null)
            .toList();

        if (all.isEmpty) {
          return Center(
            child: Text(
              'No service points configured',
              style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
            ),
          );
        }

        // Compute bounding box. Default to a small canvas if nothing is
        // positioned so the InteractiveViewer still has something to show.
        double minX = 0, minY = 0, maxX = 400, maxY = 400;
        if (positioned.isNotEmpty) {
          minX = double.infinity;
          minY = double.infinity;
          maxX = -double.infinity;
          maxY = -double.infinity;
          for (final sp in positioned) {
            final x = (sp.x ?? 0).toDouble();
            final y = (sp.y ?? 0).toDouble();
            final w = (sp.width ?? 60).toDouble();
            final h = (sp.height ?? 60).toDouble();
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
          }
        }

        final canvasWidth = (maxX - minX) + _canvasPadding * 2;
        final canvasHeight = (maxY - minY) + _canvasPadding * 2;

        return RefreshIndicator(
          onRefresh: ops.loadServicePoints,
          child: ListView(
            // AlwaysScrollable so RefreshIndicator works even when content fits.
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: 520,
                child: ClipRect(
                  child: InteractiveViewer(
                    panEnabled: true,
                    scaleEnabled: true,
                    minScale: 0.3,
                    maxScale: 3.0,
                    boundaryMargin: const EdgeInsets.all(200),
                    child: SizedBox(
                      width: canvasWidth,
                      height: canvasHeight,
                      child: Stack(
                        children: [
                          // Light grid background to convey the canvas extent.
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: HaHoColors.cardLight,
                                border: Border.all(
                                  color: HaHoColors.divider,
                                  width: 1,
                                ),
                              ),
                            ),
                          ),
                          for (final sp in positioned)
                            _PositionedSp(
                              sp: sp,
                              originX: minX - _canvasPadding,
                              originY: minY - _canvasPadding,
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (unpositioned.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    HaHoSpacing.lg,
                    HaHoSpacing.lg,
                    HaHoSpacing.lg,
                    HaHoSpacing.sm,
                  ),
                  child: Text(
                    'No coordinates (${unpositioned.length})',
                    style: HaHoTextStyles.bodySmall.copyWith(
                      color: HaHoColors.textGray,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    HaHoSpacing.lg, 0, HaHoSpacing.lg, HaHoSpacing.lg,
                  ),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final sp in unpositioned)
                        SizedBox(
                          width: 160,
                          height: 144 * MediaQuery.textScalerOf(context).scale(1),
                          child: ServicePointTile(sp: sp),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _PositionedSp extends StatelessWidget {
  final ServicePoint sp;
  // World-space origin offset so the bounding box starts at canvas (0,0).
  final double originX;
  final double originY;
  const _PositionedSp({
    required this.sp,
    required this.originX,
    required this.originY,
  });

  @override
  Widget build(BuildContext context) {
    final x = (sp.x ?? 0).toDouble() - originX;
    final y = (sp.y ?? 0).toDouble() - originY;
    final w = (sp.width ?? 60).toDouble();
    final h = (sp.height ?? 60).toDouble();
    final rotDeg = (sp.rotation ?? 0).toDouble();
    final rotRad = rotDeg * math.pi / 180.0;

    return Positioned(
      left: x,
      top: y,
      width: w,
      height: h,
      child: Transform.rotate(
        angle: rotRad,
        child: _SpShape(sp: sp),
      ),
    );
  }
}

class _SpShape extends StatelessWidget {
  final ServicePoint sp;
  const _SpShape({required this.sp});

  @override
  Widget build(BuildContext context) {
    final c = colorForServicePoint(sp);
    final shape = (sp.shape ?? '').toLowerCase();
    final isCircle = shape == 'circle' || shape == 'oval';

    return InkWell(
      onTap: () => showServicePointActionsSheet(context, sp),
      child: Container(
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.18),
          shape: isCircle ? BoxShape.circle : BoxShape.rectangle,
          borderRadius: isCircle ? null : BorderRadius.circular(8),
          border: Border.all(color: c, width: 1.5),
        ),
        padding: const EdgeInsets.all(4),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Flexible(
              child: Text(
                sp.displayLabel,
                style: HaHoTextStyles.caption.copyWith(
                  color: c,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
            if (sp.capacity != null)
              Text(
                'Seats ${sp.capacity}',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                  fontSize: 9,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    );
  }
}

/// Public reusable tile — same look as the grid. Exposed (not underscored)
/// so the floor plan's fallback list can render identically.
class ServicePointTile extends StatelessWidget {
  final ServicePoint sp;
  const ServicePointTile({super.key, required this.sp});

  IconData _icon() {
    final k = (sp.kind ?? '').toLowerCase();
    if (k.contains('table')) return Icons.table_restaurant;
    if (k.contains('room')) return Icons.meeting_room;
    if (k.contains('bay')) return Icons.car_repair;
    if (k.contains('chair')) return Icons.chair;
    if (k.contains('seat')) return Icons.event_seat;
    if (k.contains('counter')) return Icons.point_of_sale;
    if (k.contains('booth')) return Icons.dining;
    if (k.contains('section') || k.contains('floor')) return Icons.grid_view;
    return Icons.location_on_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final c = colorForServicePoint(sp);
    return InkWell(
      onTap: () => showServicePointActionsSheet(context, sp),
      onLongPress: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (_) => ServicePointFormSheet(existing: sp),
      ),
      borderRadius: BorderRadius.circular(HaHoRadius.md),
      child: Container(
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(HaHoRadius.md),
          border: Border.all(color: c, width: 1),
        ),
        padding: const EdgeInsets.all(HaHoSpacing.sm),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(_icon(), color: c, size: 22),
            const SizedBox(height: 2),
            Text(
              sp.displayLabel,
              style: HaHoTextStyles.body.copyWith(
                fontWeight: FontWeight.w700,
                color: c,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            if (sp.capacity != null)
              Text(
                'Seats ${sp.capacity}',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                  fontSize: 10,
                ),
              ),
            Text(
              _statusWords(sp.status),
              style: HaHoTextStyles.caption.copyWith(
                color: c,
                fontWeight: FontWeight.w600,
                fontSize: 10,
              ),
            ),
            // A held table: whom it waits for, and until when.
            if (sp.status == 'reserved') ...[
              Text(
                '${_heldFor(context.watch<CheckinProvider>(), sp)?['displayName'] ?? 'Held'}',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textDark,
                  fontWeight: FontWeight.w600,
                  fontSize: 10,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
              if ((sp.heldUntil ?? '').isNotEmpty)
                Text(
                  'held to ${_clock(sp.heldUntil)}',
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.textGray,
                    fontSize: 10,
                  ),
                  textAlign: TextAlign.center,
                ),
            ],
            // Occupant info — who's there now + when they were seated.
            // Same fields React uses (data.currentPartySize, data.seatedAt).
            if (sp.status == 'occupied') ...[
              // Who sits here (the check-in that seated them), then the party and since when.
              if (_seatedGuest(context.watch<CheckinProvider>(), sp).isNotEmpty)
                Text(
                  _seatedGuest(context.watch<CheckinProvider>(), sp),
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.textDark,
                    fontWeight: FontWeight.w600,
                    fontSize: 10,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              Text(
                [
                  if (sp.currentPartySize != null) 'party of ${sp.currentPartySize}',
                  if (sp.seatedAt != null) 'since ${_fmtTime(sp.seatedAt!)}',
                ].join(' · '),
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                  fontSize: 10,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _fmtTime(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    final h = dt.hour;
    final m = dt.minute.toString().padLeft(2, '0');
    final ampm = h >= 12 ? 'PM' : 'AM';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '$h12:$m $ampm';
  }
}

/// Color for a service point — explicit `data.color` wins, otherwise we
/// fall back to a status-based palette so the floor-plan and grid agree
/// out of the box.
Color colorForServicePoint(ServicePoint sp) {
  final raw = (sp.color ?? '').trim();
  if (raw.isNotEmpty) {
    final parsed = _tryParseColor(raw);
    if (parsed != null) return parsed;
  }
  switch (sp.status) {
    case 'available':
      return HaHoColors.success;
    case 'occupied':
    case 'reserved':
      return HaHoColors.primary;
    case 'dirty':
      return HaHoColors.warning;
    case 'blocked':
    case 'closed':
      return HaHoColors.error;
    default:
      return HaHoColors.textGray;
  }
}

// Accept '#RRGGBB', '#AARRGGBB', or 'RRGGBB' / 'AARRGGBB'.
Color? _tryParseColor(String s) {
  var h = s.replaceFirst('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  if (h.length != 8) return null;
  final v = int.tryParse(h, radix: 16);
  if (v == null) return null;
  return Color(v);
}

/// Bottom sheet with a table's actions. Shared by the grid view and the
/// floor-plan view so behavior stays in sync. The host seats a waiting party
/// at a free table from here; a table held for a booking shows whom it waits
/// for and until when; a front-desk device (no till on its layout) opens a
/// seated table's check for the server instead of taking the order.
void showServicePointActionsSheet(BuildContext context, ServicePoint sp) {
  final hasTill = context.read<AppVisibilityProvider>().isItemVisible('pos');
  final nav = Navigator.of(context);
  final messenger = ScaffoldMessenger.of(context);
  final venue = context.read<LocationProvider>().businessLocationName;
  final checkin = context.read<CheckinProvider>();
  // The waitlist and the holds are read fresh when the sheet opens.
  if (venue.isNotEmpty) {
    if (checkin.businessLocationId != venue) {
      checkin.setBusinessLocation(venue);
    } else {
      checkin.refresh();
    }
  }
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      Future<void> act(String newStatus) async {
        final ops = sheetContext.read<OperationsProvider>();
        final ok = await ops.setServicePointStatus(sp, newStatus);
        if (ok && sheetContext.mounted) {
          Navigator.pop(sheetContext);
          messenger.showSnackBar(
            SnackBar(content: Text('${sp.displayLabel} ${_statusSentence(newStatus)}')),
          );
          context.read<CheckinProvider>().refresh();
        }
      }

      Future<void> seat(Map<String, dynamic> task, String guest) async {
        final ops = sheetContext.read<OperationsProvider>();
        final p = sheetContext.read<CheckinProvider>();
        final ok = await p.assign((task['sk'] ?? '').toString(), sp.sk);
        if (!sheetContext.mounted) return;
        if (!ok) {
          messenger.showSnackBar(SnackBar(
            content: Text(p.error ?? 'Could not seat them. Try again.'),
            backgroundColor: HaHoColors.error,
          ));
          return;
        }
        Navigator.pop(sheetContext);
        await ops.loadServicePoints();
        if (!context.mounted) return;
        showSeatedDialog(context, nav: nav, guest: guest, spName: sp.name, spDisplay: sp.displayLabel);
      }

      Future<void> openCheck() async {
        String msg;
        try {
          final tab = await posService.openTab(businessLocationId: venue, servicePointId: sp.name);
          msg = tab == null ? 'Could not open the check. Try again.' : "${sp.displayLabel}'s check is open for the server.";
        } catch (e) {
          msg = e.toString().replaceFirst('Exception: ', '');
        }
        if (sheetContext.mounted) Navigator.pop(sheetContext);
        messenger.showSnackBar(SnackBar(content: Text(msg)));
        if (context.mounted) await context.read<OperationsProvider>().loadServicePoints();
      }

      return Consumer<CheckinProvider>(
        builder: (sheetContext, p, _) {
          final seats = sp.capacity?.toInt();
          final held = sp.status == 'reserved' ? _heldFor(p, sp) : null;
          // Who can sit here: the waitlist, first come first served, only parties the table fits.
          final waiting = sp.status == 'available'
              ? p.queue.where((t) {
                  final size = _payloadOf(t)['partySize'];
                  return seats == null || size is! num || size <= seats;
                }).toList()
              : const <Map<String, dynamic>>[];
          // A held table seats its own party once they have checked in.
          final heldParty = held == null
              ? null
              : p.queue.where((t) => '${_payloadOf(t)['reservationId'] ?? ''}' == '${held['reservationId'] ?? ''}').firstOrNull;
          return SafeArea(
            top: false,
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                HaHoSpacing.lg,
                HaHoSpacing.md,
                HaHoSpacing.lg,
                MediaQuery.of(sheetContext).padding.bottom + HaHoSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: HaHoColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Center(child: Text(sp.displayLabel, style: HaHoTextStyles.h3)),
                  if ((sp.kind ?? '').isNotEmpty)
                    Center(
                      child: Text(
                        // "Seats 4 · Occupied · party of 4"
                        [
                          if (sp.capacity != null) 'Seats ${sp.capacity}' else sp.kind!,
                          _statusWords(sp.status),
                          if (sp.currentPartySize != null && sp.status == 'occupied')
                            'party of ${sp.currentPartySize}',
                        ].join(' · '),
                        style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
                      ),
                    ),
                  if (held != null) ...[
                    const SizedBox(height: HaHoSpacing.md),
                    _HeldBanner(held: held),
                  ],
                  const SizedBox(height: HaHoSpacing.lg),
                  if (sp.status == 'available') ...[
                    Text('Seat from the waitlist',
                        style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: HaHoSpacing.xs),
                    if (waiting.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: HaHoSpacing.md),
                        child: Text(
                          p.queue.isEmpty ? 'Nobody is waiting.' : 'Nobody waiting fits this table.',
                          style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
                        ),
                      )
                    else
                      for (final t in waiting.take(4))
                        _WaitingRow(task: t, busy: p.busy, onSeat: () => seat(t, _guestName(t))),
                    const SizedBox(height: HaHoSpacing.sm),
                  ],
                  if (heldParty != null)
                    _ActionRow(
                      icon: Icons.event_seat,
                      label: 'Seat ${_guestName(heldParty)}',
                      color: HaHoColors.primary,
                      onTap: () => seat(heldParty, _guestName(heldParty)),
                    ),
                  // A device with the till takes the order at the table; the front desk
                  // opens a seated table's check for the server.
                  if (hasTill && (sp.status == 'available' || sp.status == 'occupied'))
                    _ActionRow(
                      icon: Icons.point_of_sale,
                      label: sp.status == 'available' ? 'Open tab here' : 'Take order',
                      color: HaHoColors.primary,
                      onTap: () {
                        Navigator.pop(sheetContext);
                        nav.push(
                          MaterialPageRoute(
                            builder: (_) => PosScreen(
                              businessLocationId: '',
                              initialServicePointId: sp.name,
                              initialServicePointDisplay: sp.displayLabel,
                            ),
                          ),
                        );
                      },
                    ),
                  if (!hasTill && sp.status == 'occupied' && (sp.currentTabId ?? '').isEmpty)
                    _ActionRow(
                      icon: Icons.receipt_long_outlined,
                      label: 'Open check for the server',
                      color: HaHoColors.primary,
                      onTap: openCheck,
                    ),
                  if (sp.status == 'available')
                    _ActionRow(
                      icon: Icons.block,
                      label: 'Block this spot',
                      color: HaHoColors.error,
                      onTap: () => act('blocked'),
                    ),
                  if (sp.status == 'occupied') ...[
                    _ActionRow(
                      icon: Icons.cleaning_services,
                      label: 'Needs cleaning',
                      color: HaHoColors.warning,
                      onTap: () => act('dirty'),
                    ),
                    _ActionRow(
                      icon: Icons.check,
                      label: 'Free the table',
                      color: HaHoColors.success,
                      onTap: () => act('available'),
                    ),
                  ],
                  if (sp.status == 'reserved')
                    _ActionRow(
                      icon: Icons.lock_open,
                      label: 'Release the hold',
                      color: HaHoColors.warning,
                      onTap: () => act('available'),
                    ),
                  if (sp.status == 'dirty')
                    _ActionRow(
                      icon: Icons.check,
                      label: 'Cleaned — set available',
                      color: HaHoColors.success,
                      onTap: () => act('available'),
                    ),
                  if (sp.status == 'blocked' || sp.status == 'closed')
                    _ActionRow(
                      icon: Icons.lock_open,
                      label: 'Reopen',
                      color: HaHoColors.success,
                      onTap: () => act('available'),
                    ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

Map<String, dynamic> _payloadOf(Map<String, dynamic> task) {
  final d = task['data'] is Map ? task['data'] as Map : task;
  return d['payload'] is Map ? Map<String, dynamic>.from(d['payload'] as Map) : <String, dynamic>{};
}

String _guestName(Map<String, dynamic> task) {
  final c = _payloadOf(task)['customer'];
  final n = c is Map ? '${c['name'] ?? ''}'.trim() : '';
  if (n.isNotEmpty) return n;
  final e = task['enrich'] is Map ? task['enrich'] as Map : const {};
  return '${e['displayName'] ?? 'Guest'}';
}

/// The party seated at a table, from the server's floor list ('' when unknown).
String _seatedGuest(CheckinProvider p, ServicePoint sp) {
  for (final s in p.allSpots) {
    final d = s['data'] is Map ? s['data'] as Map : s;
    if ('${s['sk'] ?? ''}' != sp.sk && '${d['name'] ?? ''}' != sp.name) continue;
    final e = s['enrich'] is Map ? s['enrich'] as Map : const {};
    final a = e['assignedTask'] is Map ? e['assignedTask'] as Map : const {};
    return '${a['displayName'] ?? ''}';
  }
  return '';
}

/// Whom a held table waits for (server enrichment of the floor list).
Map<String, dynamic>? _heldFor(CheckinProvider p, ServicePoint sp) {
  for (final s in p.allSpots) {
    final d = s['data'] is Map ? s['data'] as Map : s;
    if ('${s['sk'] ?? ''}' != sp.sk && '${d['name'] ?? ''}' != sp.name) continue;
    final e = s['enrich'] is Map ? s['enrich'] as Map : const {};
    return e['heldFor'] is Map ? Map<String, dynamic>.from(e['heldFor'] as Map) : null;
  }
  return null;
}

String _clock(String? iso) {
  final d = DateTime.tryParse(iso ?? '')?.toLocal();
  if (d == null) return '';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';
}

class _HeldBanner extends StatelessWidget {
  final Map<String, dynamic> held;
  const _HeldBanner({required this.held});

  @override
  Widget build(BuildContext context) {
    final until = DateTime.tryParse('${held['heldUntil'] ?? ''}')?.toLocal();
    final over = until != null && DateTime.now().isAfter(until);
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: (over ? HaHoColors.error : HaHoColors.primary).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(HaHoRadius.md),
      ),
      child: Row(children: [
        Icon(Icons.schedule, color: over ? HaHoColors.error : HaHoColors.primary),
        const SizedBox(width: HaHoSpacing.sm),
        Expanded(
          child: Text(
            [
              'Held for ${held['displayName'] ?? 'a booking'} · party of ${held['partySize'] ?? 1}',
              if ('${held['startTime'] ?? ''}'.isNotEmpty) 'Booked ${_clock('${held['startTime']}')}',
              if (until != null) over ? 'Grace period over at ${_clock('${held['heldUntil']}')}' : 'Held until ${_clock('${held['heldUntil']}')}',
            ].join('\n'),
            style: HaHoTextStyles.bodySmall.copyWith(height: 1.4),
          ),
        ),
      ]),
    );
  }
}

class _WaitingRow extends StatelessWidget {
  final Map<String, dynamic> task;
  final bool busy;
  final VoidCallback onSeat;
  const _WaitingRow({required this.task, required this.busy, required this.onSeat});

  @override
  Widget build(BuildContext context) {
    final p = _payloadOf(task);
    final e = task['enrich'] is Map ? task['enrich'] as Map : const {};
    final waitedMin = e['waitedMs'] is num ? ((e['waitedMs'] as num) / 60000).floor() : null;
    final quote = p['quotedWaitMinutes'] is num ? (p['quotedWaitMinutes'] as num).toInt() : null;
    final reserved = '${p['reservationId'] ?? ''}'.isNotEmpty && p['source'] != 'walk-in';
    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.xs),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        border: Border.all(color: HaHoColors.border),
      ),
      child: ListTile(
        dense: true,
        title: Text(_guestName(task), style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w600)),
        subtitle: Text([
          'Party of ${p['partySize'] ?? 1}',
          reserved ? 'Reserved' : 'Walk-in',
          if (waitedMin != null) waitedMin < 1 ? 'just arrived' : 'waiting ${waitedMin}m',
          if (quote != null) 'quoted ${quote}m',
        ].join(' · ')),
        trailing: FilledButton(
          onPressed: busy ? null : onSeat,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16776B)),
          child: const Text('Seat'),
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(HaHoRadius.md),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: HaHoSpacing.md,
          vertical: HaHoSpacing.md,
        ),
        margin: const EdgeInsets.only(bottom: HaHoSpacing.xs),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(HaHoRadius.md),
          border: Border.all(color: color, width: 1),
        ),
        child: Row(children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: HaHoSpacing.md),
          Expanded(
            child: Text(
              label,
              style: HaHoTextStyles.body.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// A table's state as staff say it: "dirty" → "Needs cleaning", "occupied" → "Occupied".
String _statusWords(String status) {
  if (status == 'dirty') return 'Needs cleaning';
  return status.isEmpty ? status : status[0].toUpperCase() + status.substring(1);
}

/// The snackbar after a status change: "Table 6 is available", "Booth 4 needs cleaning".
String _statusSentence(String status) => switch (status) {
      'dirty' => 'needs cleaning',
      'available' => 'is available',
      'blocked' => 'is blocked',
      'closed' => 'is closed',
      _ => 'is ${_statusWords(status).toLowerCase()}',
    };
