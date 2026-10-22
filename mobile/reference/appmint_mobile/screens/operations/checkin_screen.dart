import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../models/contact_model.dart';
import '../../providers/app_visibility_provider.dart';
import '../../providers/checkin_provider.dart';
import '../../providers/location_provider.dart';
import '../../widgets/location_picker.dart';
import '../../widgets/auto_refresh.dart';
import '../../services/pos_service.dart';
import '../pos/pos_screen.dart';
import 'book_reservation_screen.dart';

/// Live check-in queue board. Mobile port of
/// `business-made/.../operations/CheckIn.tsx` (which wraps the React
/// `ModernCheckinQueue` component).
///
/// Backend: `/checkin/*` — see
/// `appengine/docs/CHECKIN_WORKFLOW_APP_GUIDE.md`. Renders tasks at stage 0
/// of the reservation-checkin-pipeline; transitions out via host actions
/// (Notify / Assign / Leave / No-show / Walk-in).
class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key});

  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  LocationProvider? _locProvider;
  String _lastLocId = '';
  int _section = 0;
  static const _accent = Color(0xFF16776B);
  static const _ink = Color(0xFF192C36);
  static const _muted = Color(0xFF62737B);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _locProvider = context.read<LocationProvider>();
      _lastLocId = _locProvider!.businessLocationName;
      _locProvider!.addListener(_onLocChanged);
      // The queue is read fresh on every visit, not from the last visit's list.
      final p = context.read<CheckinProvider>();
      p.setBusinessLocation(_lastLocId).then((_) {
        if (mounted) p.refresh();
      });
    });
  }

  void _onLocChanged() {
    if (!mounted) return;
    final newId = _locProvider?.businessLocationName ?? '';
    if (newId == _lastLocId) return;
    _lastLocId = newId;
    context.read<CheckinProvider>().setBusinessLocation(newId);
  }

  @override
  void dispose() {
    _locProvider?.removeListener(_onLocChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AutoRefresh(
      onRefresh: () async {
        final p = context.read<CheckinProvider>();
        if (!p.busy && !p.loadingQueue && p.businessLocationId.isNotEmpty) {
          await p.refresh();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7F7),
        appBar: AppBar(
          centerTitle: false,
          title: const LocationAppBarTitle(title: 'Arrivals'),
          backgroundColor: const Color(0xFFF5F7F7),
          surfaceTintColor: Colors.transparent,
          actions: [
            Consumer<CheckinProvider>(
              builder: (_, p, _) => IconButton(
                tooltip: 'Refresh',
                onPressed: p.loadingQueue ? null : p.refresh,
                icon: p.loadingQueue
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 22),
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Consumer<CheckinProvider>(
            builder: (context, p, _) => Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 960),
                child: RefreshIndicator(
                  onRefresh: p.refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                    children: [
                      const Text(
                        'Welcome your guests',
                        style: TextStyle(
                          fontSize: 25,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.5,
                          color: _ink,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Manage the waitlist and get parties seated.',
                        style: TextStyle(fontSize: 14, color: _muted),
                      ),
                      const SizedBox(height: 20),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        children: [
                          FilledButton.icon(
                            onPressed: p.busy || p.businessLocationId.isEmpty
                                ? null
                                : () => _openWalkInSheet(context),
                            style: FilledButton.styleFrom(
                              backgroundColor: _accent,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 44),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              textStyle: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            icon: const Icon(
                              Icons.person_add_alt_outlined,
                              size: 18,
                            ),
                            label: const Text('Add walk-in'),
                          ),
                          OutlinedButton(
                            onPressed: p.busy
                                ? null
                                : () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const BookReservationScreen(),
                                    ),
                                  ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: _ink,
                              minimumSize: const Size(0, 44),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              textStyle: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                              side: const BorderSide(color: Color(0xFFDFE6E5)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: const Text('New booking'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _SummaryRow(summary: p.summary, queueCount: p.queueCount),
                      const SizedBox(height: 24),
                      Row(
                        children: List.generate(
                          4,
                          (i) => Expanded(
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: () => setState(() => _section = i),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                  decoration: BoxDecoration(
                                    border: Border(
                                      bottom: BorderSide(
                                        color: _section == i
                                            ? _accent
                                            : const Color(0xFFDFE6E5),
                                        width: _section == i ? 2 : 1,
                                      ),
                                    ),
                                  ),
                                  child: Text(
                                    [
                                      'Waiting',
                                      'Bookings',
                                      'Tables',
                                      'History',
                                    ][i],
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: _section == i ? _accent : _muted,
                                      fontWeight: _section == i
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      if (p.error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFDEDEC),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            p.error!,
                            style: const TextStyle(
                              color: HaHoColors.error,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (p.loadingQueue &&
                          p.queue.isEmpty &&
                          p.allSpots.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else
                        ..._sectionContent(p),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _sectionContent(CheckinProvider p) {
    switch (_section) {
      case 0:
        if (p.queue.isEmpty) {
          return [
            _emptyPanel(
              Icons.groups_outlined,
              'Ready for your next guest',
              'Add a walk-in or check in a booking to start the waitlist.',
            ),
          ];
        }
        return [
          _SectionHeader(label: 'Waiting to be seated', count: p.queueCount),
          const SizedBox(height: 12),
          ..._queueCards(p),
        ];
      case 1:
        if (p.upcoming.isEmpty && p.today.isEmpty) {
          return [
            _emptyPanel(
              Icons.event_available_outlined,
              'No bookings today',
              'New reservations will appear here for check-in.',
            ),
          ];
        }
        return [
          if (p.upcoming.isNotEmpty) ...[
            _SectionHeader(label: 'Arriving soon', count: p.upcoming.length),
            const SizedBox(height: 12),
            ..._upcomingCards(p),
            const SizedBox(height: 20),
          ],
          if (p.today.isNotEmpty) ...[
            _SectionHeader(label: 'Today', count: p.today.length),
            const SizedBox(height: 12),
            ..._todayCards(p),
          ],
        ];
      case 2:
        if (p.allSpots.isEmpty) {
          return [
            _emptyPanel(
              Icons.table_restaurant_outlined,
              'No tables yet',
              'Add tables from the Tables screen to start seating guests.',
            ),
          ];
        }
        return [
          _SectionHeader(label: 'Your floor', count: p.allSpots.length),
          const SizedBox(height: 12),
          _SpotsBoard(spots: p.allSpots, onClear: p.clearServicePoint),
        ];
      default:
        if (p.history.isEmpty) {
          return [
            _emptyPanel(
              Icons.history,
              'No recent arrivals',
              'Seated parties and queue updates from the last 24 hours appear here.',
            ),
          ];
        }
        return [
          _SectionHeader(label: 'Last 24 hours', count: p.history.length),
          const SizedBox(height: 12),
          ..._historyCards(p),
        ];
    }
  }

  Widget _emptyPanel(IconData icon, String title, String description) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8E7)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: Color(0xFFE7F2EF),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 26, color: _accent),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: _ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              description,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, height: 1.5, color: _muted),
            ),
          ],
        ),
      );

  List<Widget> _queueCards(CheckinProvider p) {
    if (p.queue.isEmpty) {
      return [
        _emptyHint('No one is waiting. Walk-ins start with the + button.'),
      ];
    }
    return p.queue
        .map(
          (task) => _QueueCard(
            task: task,
            // A table held for this party's booking is theirs: offered first.
            availableSpots: [..._heldForTask(p, task), ...p.availableSpots],
            onAssign: (spId, spDisplay, spName) async {
              // Different verticals have different "next steps":
              //   dine-in (table/room/booth/bay) → seat them, then take order in POS
              //   pickup / counter / walk-up     → just hand off, no POS needed
              // After assignment we open a dialog (rather than a snackbar that
              // can be missed) confirming success + offering "Take order".
              // The dialog stays until the operator dismisses it explicitly.
              final messenger = ScaffoldMessenger.of(context);
              final nav = Navigator.of(context);
              final ok = await p.assign((task['sk'] ?? '').toString(), spId);
              if (!mounted) return;
              if (!ok) {
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(p.error ?? 'Assign failed'),
                    backgroundColor: HaHoColors.error,
                  ),
                );
                return;
              }
              // Visible confirmation that doesn't vanish.
              showSeatedDialog(
                context,
                nav: nav,
                guest: _guestOf(task),
                spName: spName,
                spDisplay: spDisplay,
              );
            },
            onNotify: () => p.notify((task['sk'] ?? '').toString()),
            onLeave: () => _confirmLeave(context, p, task),
            onNoShow: () => p.noShow((task['sk'] ?? '').toString()),
          ),
        )
        .toList();
  }

  static List<Map<String, dynamic>> _heldForTask(CheckinProvider p, Map<String, dynamic> task) {
    final d = task['data'] is Map ? task['data'] as Map : task;
    final payload = d['payload'] is Map ? d['payload'] as Map : const {};
    final rid = '${payload['reservationId'] ?? ''}';
    if (rid.isEmpty) return const [];
    return p.allSpots.where((s) {
      final sd = s['data'] is Map ? s['data'] as Map : s;
      return sd['status'] == 'reserved' && '${sd['currentReservationId'] ?? ''}' == rid;
    }).toList();
  }

  /// The party's name on a queue task ("Jessica Miller · 4" → "Jessica Miller").
  static String _guestOf(Map<String, dynamic> task) {
    final d = task['data'] is Map ? task['data'] as Map : task;
    final title = (d['title'] ?? '').toString().split(' · ').first.trim();
    return title.isEmpty ? 'The party' : title;
  }

  List<Widget> _upcomingCards(CheckinProvider p) {
    if (p.upcoming.isEmpty) {
      return [_emptyHint('No upcoming reservations in this window.')];
    }
    return p.upcoming
        .map(
          (r) => _UpcomingCard(
            reservation: r,
            onCheckIn: () =>
                p.checkInFromReservation((r['sk'] ?? '').toString()),
          ),
        )
        .toList();
  }

  /// Today's reservations across every status — a day-level view the host
  /// uses to see arrived / no-show / cancelled / still-expected at a glance.
  List<Widget> _todayCards(CheckinProvider p) {
    if (p.today.isEmpty) {
      return [_emptyHint('No reservations booked for today.')];
    }
    return p.today.map((r) {
      final data = r['data'] is Map
          ? Map<String, dynamic>.from(r['data'] as Map)
          : <String, dynamic>{};
      final cust = data['customer'] is Map
          ? Map<String, dynamic>.from(data['customer'] as Map)
          : const {};
      final name = (cust['name'] ?? data['customerName'] ?? 'Guest').toString();
      final status = (data['status'] ?? '').toString();
      final party = data['partySize'];
      final when = _shortTime(
        (data['startTime'] ?? data['reservationDate'] ?? '').toString(),
      );
      return _MiniRow(
        title: name,
        subtitle: [
          if (when.isNotEmpty) when,
          if (party != null) 'party $party',
        ].join(' · '),
        badge: _outcomeWords(status),
        badgeColor: _resStatusColor(status),
      );
    }).toList();
  }

  /// Last 24h of queue outcomes (served / left / no-show).
  List<Widget> _historyCards(CheckinProvider p) {
    if (p.history.isEmpty) {
      return [_emptyHint('No check-in history in the last 24 hours.')];
    }
    return p.history.map((t) {
      final data = t['data'] is Map
          ? Map<String, dynamic>.from(t['data'] as Map)
          : <String, dynamic>{};
      final payload = data['payload'] is Map
          ? Map<String, dynamic>.from(data['payload'] as Map)
          : const {};
      final cust = payload['customer'] is Map
          ? Map<String, dynamic>.from(payload['customer'] as Map)
          : const {};
      final name = (cust['name'] ?? 'Guest').toString();
      // What happened (seated, no-show, left), kept beside the task's own status.
      final enrich = t['enrich'] is Map ? t['enrich'] as Map : const {};
      final outcome = (enrich['outcome'] ?? data['outcome'] ?? data['status'] ?? '').toString();
      final party = payload['partySize'];
      final when = _shortTime(
        (data['completedAt'] ?? data['leftAt'] ?? data['modifydate'] ?? '')
            .toString(),
      );
      return _MiniRow(
        title: name,
        subtitle: [
          if (party != null) 'party $party',
          if (when.isNotEmpty) when,
        ].join(' · '),
        badge: _outcomeWords(outcome),
        badgeColor: _resStatusColor(outcome),
      );
    }).toList();
  }

  /// A booking's or a party's outcome as the host says it.
  static String _outcomeWords(String s) => switch (s.toLowerCase()) {
        'used' || 'served' || 'arrived' || 'done' || 'completed' => 'Seated',
        'no_show' || 'no-show' => 'No-show',
        'cancelled' || 'canceled' => 'Cancelled',
        'left' => 'Left',
        'new' || 'confirmed' || 'pending' || 'booked' => 'Booked',
        _ => s.replaceAll('_', ' '),
      };

  static Color _resStatusColor(String s) {
    switch (s.toLowerCase()) {
      case 'used':
      case 'served':
      case 'arrived':
      case 'done':
      case 'completed':
        return HaHoColors.success;
      case 'no_show':
      case 'no-show':
      case 'cancelled':
      case 'left':
        return HaHoColors.error;
      case 'confirmed':
      case 'new':
        return HaHoColors.primary;
      default:
        return HaHoColors.textGray;
    }
  }

  static String _shortTime(String iso) {
    if (iso.isEmpty) return '';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m ${d.hour < 12 ? 'AM' : 'PM'}';
  }

  Widget _emptyHint(String text) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.lg),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Text(
        text,
        style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
        textAlign: TextAlign.center,
      ),
    );
  }

  Future<void> _openWalkInSheet(BuildContext context) async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _WalkInSheet(),
    );
    if (added == true && mounted) setState(() => _section = 0);
  }

  void _confirmLeave(
    BuildContext context,
    CheckinProvider p,
    Map<String, dynamic> task,
  ) {
    final name = _displayName(task);
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Remove $name from queue?'),
        content: const Text(
          'Use this when the guest left before being seated.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              p.leave((task['sk'] ?? '').toString());
            },
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }
}

// ─── Summary row ────────────────────────────────────────────────────────

class _SummaryRow extends StatelessWidget {
  final Map<String, dynamic> summary;
  final int queueCount;
  const _SummaryRow({required this.summary, required this.queueCount});

  @override
  Widget build(BuildContext context) {
    final avg = summary['avgCurrentWaitMs'];
    final longest = summary['longestCurrent'];
    final maxWait = longest is Map ? longest['waitedMs'] : null;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8E7)),
      ),
      child: Row(
        children: [
          _stat('Waiting', '$queueCount'),
          Container(width: 1, height: 32, color: const Color(0xFFE2E8E7)),
          _stat('Average wait', queueCount == 0 ? '—' : _fmtMs(avg)),
          Container(width: 1, height: 32, color: const Color(0xFFE2E8E7)),
          _stat('Longest wait', queueCount == 0 ? '—' : _fmtMs(maxWait)),
        ],
      ),
    );
  }

  static String _fmtMs(dynamic ms) {
    if (ms is! num) return '—';
    final mins = (ms / 60000).floor();
    return mins < 1 ? '<1 min' : '$mins min';
  }

  Widget _stat(String label, String value) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Color(0xFF192C36),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, color: Color(0xFF62737B)),
        ),
      ],
    ),
  );
}

// ─── Section header ─────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  final int count;
  const _SectionHeader({required this.label, required this.count});
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
          decoration: BoxDecoration(
            color: HaHoColors.background,
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
          ),
          child: Text(
            '$count',
            style: HaHoTextStyles.caption.copyWith(
              fontWeight: FontWeight.w700,
              color: HaHoColors.textGray,
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Queue card ─────────────────────────────────────────────────────────

/// Compact one-line row for the Today / History strips.
class _MiniRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final String badge;
  final Color badgeColor;
  const _MiniRow({
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.badgeColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: HaHoTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle.isNotEmpty)
                  Text(
                    subtitle,
                    style: HaHoTextStyles.caption.copyWith(
                      color: HaHoColors.textGray,
                    ),
                  ),
              ],
            ),
          ),
          if (badge.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: badgeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(HaHoRadius.pill),
              ),
              child: Text(
                badge.replaceAll('_', ' '),
                style: HaHoTextStyles.caption.copyWith(
                  color: badgeColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Small chip for a check-in card's seating intent / guest preference.
Widget _prefChip(IconData icon, String label, Color color) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
  decoration: BoxDecoration(
    color: color.withValues(alpha: 0.10),
    borderRadius: BorderRadius.circular(HaHoRadius.pill),
    border: Border.all(color: color.withValues(alpha: 0.35)),
  ),
  child: Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 11, color: color),
      const SizedBox(width: 4),
      Text(
        label,
        style: HaHoTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  ),
);

class _QueueCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final List<Map<String, dynamic>> availableSpots;
  final void Function(String spId, String spDisplay, String spName) onAssign;
  final VoidCallback onNotify;
  final VoidCallback onLeave;
  final VoidCallback onNoShow;

  const _QueueCard({
    required this.task,
    required this.availableSpots,
    required this.onAssign,
    required this.onNotify,
    required this.onLeave,
    required this.onNoShow,
  });

  @override
  Widget build(BuildContext context) {
    final data = task['data'] is Map
        ? Map<String, dynamic>.from(task['data'] as Map)
        : <String, dynamic>{};
    final payload = data['payload'] is Map
        ? Map<String, dynamic>.from(data['payload'] as Map)
        : <String, dynamic>{};
    final customer = payload['customer'] is Map
        ? Map<String, dynamic>.from(payload['customer'] as Map)
        : <String, dynamic>{};
    final enrich = task['enrich'] is Map
        ? Map<String, dynamic>.from(task['enrich'] as Map)
        : <String, dynamic>{};

    final name = (customer['name'] ?? enrich['displayName'] ?? '')
        .toString()
        .trim();
    final partySize = (payload['partySize'] is num)
        ? (payload['partySize'] as num).toInt()
        : null;
    final waitedMs = (enrich['waitedMs'] is num)
        ? (enrich['waitedMs'] as num)
        : null;
    final position = (enrich['queuePosition'] is num)
        ? (enrich['queuePosition'] as num).toInt()
        : null;
    final quotedMin = payload['quotedWaitMinutes'] is num
        ? (payload['quotedWaitMinutes'] as num).toInt()
        : null;
    // Past the wait the host quoted: the card says so before the guest does.
    final overQuote = quotedMin != null &&
        waitedMs != null &&
        waitedMs > quotedMin * 60000;
    final isOverdue = enrich['isOverdue'] == true || overQuote;
    final source = (payload['source'] ?? '').toString();
    final notes = (payload['notes'] ?? '').toString();
    final phone = (customer['phone'] ?? '').toString();
    // Seating intent + guest preferences (allergies, high-chair, accessibility…).
    final preferredKind = (payload['preferredServicePointKind'] ?? '')
        .toString();
    final preferredSp = (payload['preferredServicePoint'] ?? '').toString();
    final prefs = payload['preferences'] is List
        ? (payload['preferences'] as List)
              .map((e) => e.toString())
              .where((s) => s.isNotEmpty)
              .toList()
        : const <String>[];

    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.sm),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(
          color: isOverdue ? HaHoColors.error : HaHoColors.border,
          width: isOverdue ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (position != null)
                Container(
                  width: 28,
                  height: 28,
                  margin: const EdgeInsets.only(right: HaHoSpacing.sm, top: 2),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: HaHoColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(HaHoRadius.sm),
                  ),
                  child: Text(
                    '#$position',
                    style: HaHoTextStyles.caption.copyWith(
                      fontWeight: FontWeight.w700,
                      color: HaHoColors.primary,
                    ),
                  ),
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name.isEmpty ? 'Guest' : name,
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (phone.isNotEmpty ||
                        partySize != null ||
                        source.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          [
                            if (partySize != null) 'Party of $partySize',
                            if (phone.isNotEmpty) ContactModel.formatPhone(phone),
                            // How they came: a booking or the door, not the booking's channel.
                            if (source == 'walk-in')
                              'Walk-in'
                            else if ((payload['reservationId'] ?? '').toString().isNotEmpty)
                              'Reserved'
                            else if (source.isNotEmpty)
                              source,
                          ].join(' · '),
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.textGray,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (waitedMs != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _fmtWait(waitedMs),
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                        color: isOverdue
                            ? HaHoColors.error
                            : HaHoColors.textDark,
                      ),
                    ),
                    Text(
                      quotedMin == null ? 'waiting' : 'quoted ${quotedMin}m',
                      style: HaHoTextStyles.caption.copyWith(
                        color: overQuote ? HaHoColors.error : HaHoColors.textGray,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          if (notes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: HaHoSpacing.sm),
              child: Text(
                notes,
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          // Seating intent + preference chips so the host seats correctly.
          if (preferredKind.isNotEmpty ||
              preferredSp.isNotEmpty ||
              prefs.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: HaHoSpacing.sm),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  if (preferredSp.isNotEmpty)
                    _prefChip(
                      Icons.push_pin_outlined,
                      'Wants $preferredSp',
                      HaHoColors.accent,
                    ),
                  if (preferredSp.isEmpty && preferredKind.isNotEmpty)
                    _prefChip(
                      Icons.push_pin_outlined,
                      'Prefers $preferredKind',
                      HaHoColors.accent,
                    ),
                  for (final pref in prefs)
                    _prefChip(Icons.info_outline, pref, HaHoColors.warning),
                ],
              ),
            ),
          const SizedBox(height: HaHoSpacing.sm),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: availableSpots.isEmpty
                      ? null
                      : () => _pickSpot(context, availableSpots, partySize),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16776B),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 44),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  icon: const Icon(Icons.event_seat_outlined, size: 18),
                  label: Text(
                    availableSpots.isEmpty
                        ? 'No spots available'
                        : 'Assign a spot',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              PopupMenuButton<String>(
                tooltip: 'Guest actions',
                icon: const Icon(Icons.more_horiz),
                onSelected: (action) {
                  switch (action) {
                    case 'notify':
                      onNotify();
                    case 'leave':
                      onLeave();
                    case 'no_show':
                      onNoShow();
                  }
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    value: 'notify',
                    enabled:
                        phone.isNotEmpty ||
                        (customer['email'] ?? '').toString().isNotEmpty,
                    child: const Text('Notify guest'),
                  ),
                  const PopupMenuItem(
                    value: 'leave',
                    child: Text('Guest left'),
                  ),
                  const PopupMenuItem(
                    value: 'no_show',
                    child: Text('Mark no-show'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _pickSpot(
    BuildContext context,
    List<Map<String, dynamic>> spots, [
    int? partySize,
  ]) {
    Map<String, dynamic> dataOf(Map<String, dynamic> sp) =>
        sp['data'] is Map ? Map<String, dynamic>.from(sp['data'] as Map) : sp;
    num? seatsOf(Map<String, dynamic> sp) {
      final c = dataOf(sp)['capacity'];
      return c is num ? c : num.tryParse('${c ?? ''}');
    }
    // The tables that fit the party come first, smallest first; then the
    // venue's own order. A host seats a party of 4 at a four-top, not by name.
    bool fits(Map<String, dynamic> sp) =>
        partySize == null || (seatsOf(sp) ?? partySize) >= partySize;
    bool heldHere(Map<String, dynamic> sp) => dataOf(sp)['status'] == 'reserved';
    final ordered = [...spots]
      ..sort((a, b) {
        final ha = heldHere(a) ? 0 : 1, hb = heldHere(b) ? 0 : 1;
        if (ha != hb) return ha - hb;
        final fa = fits(a) ? 0 : 1, fb = fits(b) ? 0 : 1;
        if (fa != fb) return fa - fb;
        final ca = seatsOf(a) ?? 999, cb = seatsOf(b) ?? 999;
        if (ca != cb) return ca.compareTo(cb);
        final oa = dataOf(a)['sortOrder'], ob = dataOf(b)['sortOrder'];
        if (oa is num && ob is num && oa != ob) return oa.compareTo(ob);
        return '${dataOf(a)['displayName'] ?? dataOf(a)['name']}'
            .compareTo('${dataOf(b)['displayName'] ?? dataOf(b)['name']}');
      });
    final allTables = spots.every((sp) => dataOf(sp)['kind'] == 'table');
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(HaHoSpacing.lg),
            shrinkWrap: true,
            children: [
              Text(
                partySize == null
                    ? (allTables ? 'Pick a table' : 'Pick a spot')
                    : '${allTables ? 'Pick a table' : 'Pick a spot'} for $partySize',
                style: HaHoTextStyles.h4,
              ),
              const SizedBox(height: HaHoSpacing.md),
              ...ordered.map((sp) {
                final d = sp['data'] is Map
                    ? Map<String, dynamic>.from(sp['data'] as Map)
                    : sp;
                // Send the record id — the server updates the point by id after resolving it.
                final spId = (sp['sk'] ?? d['name'] ?? sp['name'] ?? '')
                    .toString();
                final spName = (d['name'] ?? sp['name'] ?? spId).toString();
                final display = (d['displayName'] ?? spName).toString();
                final kind = (d['kind'] ?? '').toString();
                final seats = seatsOf(sp);
                final detail = [
                  if (seats != null) 'Seats ${seats.toInt()}',
                  if (kind.isNotEmpty && !allTables) kind,
                  if (heldHere(sp)) 'Held for this party',
                ].join(' · ');
                final small = !fits(sp);
                return ListTile(
                  leading: Icon(
                    Icons.event_seat,
                    color: small ? HaHoColors.textGray : null,
                  ),
                  title: Text(
                    display,
                    style: small
                        ? const TextStyle(color: HaHoColors.textGray)
                        : null,
                  ),
                  subtitle: detail.isNotEmpty ? Text(detail) : null,
                  onTap: () {
                    Navigator.pop(context);
                    onAssign(spId, display, spName);
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  static String _fmtWait(num ms) {
    final mins = (ms / 60000).floor();
    if (mins < 1) return '<1m';
    if (mins < 60) return '${mins}m';
    final h = (mins / 60).floor();
    final r = mins % 60;
    return '${h}h${r > 0 ? ' ${r}m' : ''}';
  }
}

// ─── Spots board ─────────────────────────────────────────────────────────
// Mobile port of React's Spots panel. Every service point at the location
// renders as a tile color-coded by status. Occupied/reserved tiles show the
// assigned guest's name + party size + how long they've been there. Tapping
// available shows assign hint; tapping occupied opens the clear menu.

class _SpotsBoard extends StatelessWidget {
  final List<Map<String, dynamic>> spots;
  final Future<bool> Function(String spId, {String? finalStatus}) onClear;
  const _SpotsBoard({required this.spots, required this.onClear});

  @override
  Widget build(BuildContext context) {
    if (spots.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(HaHoSpacing.lg),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(HaHoRadius.lg),
          border: Border.all(color: HaHoColors.border),
        ),
        child: Text(
          'No service points configured. Add some under Floor.',
          style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
          textAlign: TextAlign.center,
        ),
      );
    }
    // Stable order: occupied/reserved first (most actionable), then dirty,
    // then available, then blocked/closed.
    final order = [
      'occupied',
      'reserved',
      'dirty',
      'available',
      'blocked',
      'closed',
    ];
    final sorted = [...spots]
      ..sort((a, b) {
        String stat(Map<String, dynamic> m) {
          final d = m['data'] is Map ? m['data'] as Map : m;
          return (d['status'] ?? 'available').toString();
        }

        return order.indexOf(stat(a)).compareTo(order.indexOf(stat(b)));
      });
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        // 2 columns on phone width, 3 on tablet, 4 on wide
        final cols = w >= 720
            ? 3
            : w >= 480
            ? 2
            : 1;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cols,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            mainAxisExtent: 92,
          ),
          itemCount: sorted.length,
          itemBuilder: (_, i) => _SpotTile(sp: sorted[i], onClear: onClear),
        );
      },
    );
  }
}

class _SpotTile extends StatelessWidget {
  final Map<String, dynamic> sp;
  final Future<bool> Function(String spId, {String? finalStatus}) onClear;
  const _SpotTile({required this.sp, required this.onClear});

  @override
  Widget build(BuildContext context) {
    final d = sp['data'] is Map
        ? Map<String, dynamic>.from(sp['data'] as Map)
        : sp;
    final enrich = sp['enrich'] is Map
        ? Map<String, dynamic>.from(sp['enrich'] as Map)
        : <String, dynamic>{};
    final assigned = enrich['assignedTask'] is Map
        ? Map<String, dynamic>.from(enrich['assignedTask'] as Map)
        : <String, dynamic>{};
    final aPayload = assigned['payload'] is Map
        ? Map<String, dynamic>.from(assigned['payload'] as Map)
        : <String, dynamic>{};
    final aCustomer = aPayload['customer'] is Map
        ? Map<String, dynamic>.from(aPayload['customer'] as Map)
        : <String, dynamic>{};

    final name = (d['displayName'] ?? d['name'] ?? sp['sk'] ?? '').toString();
    final status = (d['status'] ?? 'available').toString();
    final spId = (sp['sk'] ?? d['name'] ?? sp['name'] ?? '').toString();
    final held = enrich['heldFor'] is Map
        ? Map<String, dynamic>.from(enrich['heldFor'] as Map)
        : <String, dynamic>{};
    // The server sends the seated party flat on assignedTask (displayName,
    // partySize, seatedAt); older payload-shaped entries are still read.
    final partySize = assigned['partySize'] ?? aPayload['partySize'] ?? held['partySize'] ?? d['currentPartySize'];
    final seatedAt = status == 'reserved' ? null : (assigned['seatedAt'] ?? aPayload['assignedAt'] ?? d['seatedAt']);
    // Who sits here, or whom the table is held for.
    final guestName = (assigned['displayName'] ?? aCustomer['name'] ?? held['displayName'] ?? '').toString();
    final heldUntil = status == 'reserved' ? _fmtSince('${held['heldUntil'] ?? d['heldUntil'] ?? ''}') : '';

    final tone = _toneForStatus(status);
    final tonedBg = Colors.white;

    return Material(
      color: tonedBg,
      borderRadius: BorderRadius.circular(HaHoRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        onTap: () => _showActions(context, name, status, spId),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(HaHoRadius.md),
            border: Border.all(color: const Color(0xFFE2E8E7)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: tone,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      name,
                      style: HaHoTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w700,
                        color: HaHoColors.textDark,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              if (status == 'occupied' || status == 'reserved') ...[
                if (guestName.isNotEmpty)
                  Text(
                    guestName,
                    style: TextStyle(fontSize: 11, color: HaHoColors.textDark),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                Text(
                  [
                    if (status == 'reserved') 'held',
                    if (partySize != null) 'party of $partySize',
                    if (seatedAt != null) _fmtSince(seatedAt.toString()),
                    if (heldUntil.isNotEmpty) heldUntil.replaceFirst('since', 'until'),
                  ].where((s) => s.isNotEmpty).join(' · '),
                  style: TextStyle(fontSize: 12, color: HaHoColors.textGray),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ] else
                Text(
                  (status == 'dirty' ? 'Needs cleaning' : status).toUpperCase(),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: tone,
                    letterSpacing: 0.6,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showActions(
    BuildContext context,
    String displayName,
    String status,
    String spId,
  ) {
    if (spId.isEmpty) return;
    // Available: just info ("tap an item in the queue to assign here").
    // Occupied / reserved: bus or free.
    // Dirty: cleaned → available.
    // Blocked / closed: no-op.
    final canBus = status == 'occupied';
    final canFree = canBus || status == 'dirty' || status == 'reserved';
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(HaHoSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(displayName, style: HaHoTextStyles.h3),
                Text(
                  switch (status) {
                    'dirty' => 'Needs cleaning',
                    'reserved' => 'Held for a booking',
                    _ => status.isEmpty ? status : status[0].toUpperCase() + status.substring(1),
                  },
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
                const SizedBox(height: HaHoSpacing.md),
                if (canBus)
                  ListTile(
                    leading: const Icon(Icons.cleaning_services_outlined),
                    title: const Text('Needs cleaning'),
                    onTap: () async {
                      Navigator.pop(sctx);
                      await onClear(spId);
                    },
                  ),
                if (canFree)
                  ListTile(
                    leading: const Icon(
                      Icons.check_circle_outline,
                      color: HaHoColors.success,
                    ),
                    title: Text(status == 'reserved' ? 'Release the hold' : 'Free the table'),
                    onTap: () async {
                      Navigator.pop(sctx);
                      await onClear(spId, finalStatus: 'available');
                    },
                  ),
                if (status == 'available')
                  Padding(
                    padding: const EdgeInsets.all(HaHoSpacing.sm),
                    child: Text(
                      'Tap "Assign" on a queue card to seat someone here.',
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.textGray,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  static Color _toneForStatus(String s) {
    switch (s) {
      case 'available':
        return const Color(0xFF10B981);
      case 'occupied':
        return const Color(0xFF2563EB);
      case 'reserved':
        return const Color(0xFFCA8A04);
      case 'dirty':
        return const Color(0xFFF59E0B);
      case 'blocked':
        return const Color(0xFF6B7280);
      case 'closed':
        return const Color(0xFF94A3B8);
      default:
        return HaHoColors.textGray;
    }
  }

  static String _fmtSince(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final h = dt.hour;
    final m = dt.minute.toString().padLeft(2, '0');
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return 'since $h12:$m ${h >= 12 ? 'PM' : 'AM'}';
  }
}

// ─── Upcoming reservation card ─────────────────────────────────────────

class _UpcomingCard extends StatelessWidget {
  final Map<String, dynamic> reservation;
  final VoidCallback onCheckIn;
  const _UpcomingCard({required this.reservation, required this.onCheckIn});

  @override
  Widget build(BuildContext context) {
    final d = reservation['data'] is Map
        ? Map<String, dynamic>.from(reservation['data'] as Map)
        : <String, dynamic>{};
    final enrich = reservation['enrich'] is Map
        ? Map<String, dynamic>.from(reservation['enrich'] as Map)
        : <String, dynamic>{};
    final customer = d['customer'] is Map
        ? Map<String, dynamic>.from(d['customer'] as Map)
        : <String, dynamic>{};
    final name =
        (customer['name'] ?? d['name'] ?? enrich['displayName'] ?? 'Guest')
            .toString();
    final partySize = (d['partySize'] is num)
        ? (d['partySize'] as num).toInt()
        : null;
    final minutesUntil = (enrich['minutesUntil'] is num)
        ? (enrich['minutesUntil'] as num).toInt()
        : null;
    final isLate = enrich['isLate'] == true;
    final isImminent = enrich['isImminent'] == true;
    final time = (d['time'] ?? '').toString();

    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.sm),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        border: Border.all(
          color: isLate
              ? HaHoColors.error
              : (isImminent ? HaHoColors.warning : HaHoColors.border),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: HaHoTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (partySize != null ||
                    time.isNotEmpty ||
                    minutesUntil != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      [
                        if (partySize != null) 'Party of $partySize',
                        if (time.isNotEmpty) time,
                        if (minutesUntil != null)
                          _minutesLabel(minutesUntil, isLate),
                      ].join(' · '),
                      style: HaHoTextStyles.caption.copyWith(
                        color: isLate ? HaHoColors.error : HaHoColors.textGray,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: onCheckIn,
            style: ElevatedButton.styleFrom(
              backgroundColor: HaHoColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            ),
            child: const Text('Check in'),
          ),
        ],
      ),
    );
  }

  static String _minutesLabel(int mins, bool isLate) {
    if (isLate) return '${mins.abs()}m late';
    if (mins == 0) return 'now';
    if (mins > 0) return 'in ${mins}m';
    return '${mins.abs()}m ago';
  }
}

// ─── Walk-in form ──────────────────────────────────────────────────────

class _WalkInSheet extends StatefulWidget {
  const _WalkInSheet();
  @override
  State<_WalkInSheet> createState() => _WalkInSheetState();
}

class _WalkInSheetState extends State<_WalkInSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _notes = TextEditingController();
  int _partySize = 2;
  // The wait the host quotes the party at the stand, picked, never typed.
  int? _quote;
  static const _quotes = [5, 10, 15, 20, 30, 45];

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _notes.dispose();
    super.dispose();
  }

  InputDecoration _field(String label, {String? hint}) => InputDecoration(
    labelText: label,
    hintText: hint,
    filled: true,
    fillColor: const Color(0xFFF8FAFA),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
    labelStyle: const TextStyle(fontSize: 14, color: Color(0xFF62737B)),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFFDFE6E5)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFF16776B), width: 1.5),
    ),
  );

  Future<void> _submit(CheckinProvider p) async {
    if (_name.text.trim().isEmpty &&
        _phone.text.trim().isEmpty &&
        _email.text.trim().isEmpty) {
      setState(() => _validation = 'Add a guest name, phone, or email.');
      return;
    }
    setState(() => _validation = null);
    final ok = await p.walkIn(
      customerName: _name.text.trim(),
      phone: _phone.text.trim(),
      email: _email.text.trim(),
      partySize: _partySize,
      notes: _notes.text.trim(),
      quotedWaitMinutes: _quote,
    );
    if (ok && mounted) Navigator.pop(context, true);
  }

  String? _validation;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<CheckinProvider>();
    return Padding(
      // The keyboard inset can read below zero for a frame while it hides; a
      // negative padding threw (walk-in sheet).
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom.clamp(0.0, double.infinity),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDFE6E5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Add a walk-in',
                      style: TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.4,
                        color: Color(0xFF192C36),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: p.busy ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close, size: 20),
                  ),
                ],
              ),
              const Text(
                'Add your guest to the waitlist.',
                style: TextStyle(fontSize: 13, color: Color(0xFF62737B)),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _name,
                decoration: _field('Guest name'),
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.only(
                  left: 14,
                  right: 4,
                  top: 4,
                  bottom: 4,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFDFE6E5)),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Party size',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF192C36),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Fewer guests',
                      onPressed: _partySize > 1
                          ? () => setState(() => _partySize--)
                          : null,
                      icon: const Icon(Icons.remove, size: 20),
                    ),
                    SizedBox(
                      width: 28,
                      child: Text(
                        '$_partySize',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'More guests',
                      onPressed: () => setState(() => _partySize++),
                      icon: const Icon(Icons.add, size: 20),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Quoted wait',
                style: TextStyle(fontSize: 12, color: Color(0xFF62737B)),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final m in _quotes)
                    ChoiceChip(
                      label: Text('$m min'),
                      selected: _quote == m,
                      showCheckmark: false,
                      selectedColor: const Color(0xFFE7F2EF),
                      side: BorderSide(
                        color: _quote == m
                            ? const Color(0xFF16776B)
                            : const Color(0xFFDFE6E5),
                      ),
                      labelStyle: TextStyle(
                        color: _quote == m
                            ? const Color(0xFF16776B)
                            : const Color(0xFF192C36),
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (sel) =>
                          setState(() => _quote = sel ? m : null),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              const Text(
                'Contact details · optional',
                style: TextStyle(fontSize: 12, color: Color(0xFF62737B)),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                decoration: _field('Phone', hint: 'For table-ready texts'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: _field('Email'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _notes,
                decoration: _field(
                  'Notes',
                  hint: 'Seating preferences or special requests',
                ),
                maxLines: 2,
              ),
              if (_validation != null || p.error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _validation ?? p.error!,
                  style: const TextStyle(fontSize: 13, color: HaHoColors.error),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: p.busy ? null : () => _submit(p),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF16776B),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: p.busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.add, size: 20),
                label: Text(p.busy ? 'Adding guest…' : 'Add to waitlist'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _displayName(Map<String, dynamic> task) {
  final data = task['data'] is Map
      ? Map<String, dynamic>.from(task['data'] as Map)
      : <String, dynamic>{};
  final payload = data['payload'] is Map
      ? Map<String, dynamic>.from(data['payload'] as Map)
      : <String, dynamic>{};
  final c = payload['customer'] is Map
      ? Map<String, dynamic>.from(payload['customer'] as Map)
      : <String, dynamic>{};
  final n = (c['name'] ?? '').toString().trim();
  if (n.isNotEmpty) return n;
  final enrich = task['enrich'] is Map ? task['enrich'] as Map : {};
  return (enrich['displayName'] ?? 'guest').toString();
}


/// After a party is seated: a confirmation that stays until dismissed, and the
/// table's next step. A device with the till takes the order; a front-desk
/// device (no till on its layout) opens the table's check for the server, so it
/// is waiting on their handheld under Open checks with the guest on it.
/// `spName` is the point's name (POS keys tabs by it).
void showSeatedDialog(
  BuildContext context, {
  required NavigatorState nav,
  required String guest,
  required String spName,
  required String spDisplay,
}) {
  final hasTill = context.read<AppVisibilityProvider>().isItemVisible('pos');
  final venue = context.read<LocationProvider>().businessLocationName;
  final messenger = ScaffoldMessenger.of(context);
  showDialog(
    context: context,
    builder: (dctx) {
      var opening = false;
      return StatefulBuilder(
        builder: (dctx, setDialog) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: HaHoColors.success, size: 36),
          title: Text('Seated at $spDisplay'),
          content: Text(
            hasTill
                ? '$guest is seated at $spDisplay. Take the order now, or close and come back to it.'
                : '$guest is seated at $spDisplay. Open the check so it is waiting for the server.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dctx),
              child: const Text('Close'),
            ),
            if (hasTill)
              ElevatedButton.icon(
                icon: const Icon(Icons.point_of_sale, size: 16),
                label: const Text('Take order'),
                onPressed: () {
                  Navigator.pop(dctx);
                  nav.push(
                    MaterialPageRoute(
                      builder: (_) => PosScreen(
                        businessLocationId: '',
                        // POS keys tabs by the point's NAME (floor plan, transfer do too);
                        // the record id only goes to the server's assign call.
                        initialServicePointId: spName,
                        initialServicePointDisplay: spDisplay,
                      ),
                    ),
                  );
                },
              )
            else
              ElevatedButton.icon(
                icon: opening
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.receipt_long_outlined, size: 16),
                label: const Text('Open check'),
                onPressed: opening
                    ? null
                    : () async {
                        setDialog(() => opening = true);
                        String msg;
                        try {
                          // The server seats the tab at the table and takes the guest,
                          // party size and booking notes from the seated visit.
                          final tab = await posService.openTab(
                            businessLocationId: venue,
                            servicePointId: spName,
                          );
                          msg = tab == null
                              ? 'Could not open the check. Try again.'
                              : "$spDisplay's check is open for the server.";
                        } catch (e) {
                          msg = e.toString().replaceFirst('Exception: ', '');
                        }
                        if (dctx.mounted) Navigator.pop(dctx);
                        messenger.showSnackBar(SnackBar(content: Text(msg)));
                      },
              ),
          ],
        ),
      );
    },
  );
}
