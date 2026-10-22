import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../config/stowbo_theme.dart';
import '../../models/booking_detail.dart';
import '../../models/stowbo_host.dart';
import '../../providers/auth_provider.dart';
import '../../providers/booking_detail_provider.dart';
import '../../widgets/stowbo_widgets.dart';
import '../chat/chat_screen.dart';

/// The guest's booking detail — log-first, action-first. In custody the hero is
/// "Request my car" (works in advance); the pickup QR collapses to a button and
/// is only front-and-centre at drop-off. Everything that has happened — check
/// in/out, every move out/in, every request — lives in one Activity log.
class BookingDetailScreen extends StatelessWidget {
  final String bookingId;
  final String? initialTitle;
  const BookingDetailScreen(
      {super.key, required this.bookingId, this.initialTitle});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => BookingDetailProvider()..load(bookingId),
      child: _BookingDetailView(initialTitle: initialTitle),
    );
  }
}

class _BookingDetailView extends StatelessWidget {
  final String? initialTitle;
  const _BookingDetailView({this.initialTitle});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    final d = p.detail;
    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        title: Text(d?.title ?? initialTitle ?? 'Booking'),
        actions: [
          if (d?.host != null)
            IconButton(
              tooltip: 'Message host',
              icon: const Icon(Icons.chat_bubble_outline_rounded),
              onPressed: () => _openChat(context, d!),
            ),
        ],
      ),
      body: _body(context, p, d),
    );
  }

  Widget _body(
      BuildContext context, BookingDetailProvider p, BookingDetail? d) {
    if (p.loading && d == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (d == null) {
      return EmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load',
        subtitle: p.error ?? 'This booking is unavailable.',
      );
    }
    final inCustody =
        d.phase == StayPhase.inCustody || d.phase == StayPhase.retrieved;
    return RefreshIndicator(
      onRefresh: () => context.read<BookingDetailProvider>().load(d.bookingId),
      child: ListView(
        padding: const EdgeInsets.all(SSpace.lg),
        children: [
          _StatusHeader(d: d),
          const SizedBox(height: SSpace.lg),
          _Hero(d: d),
          // Pickup code is a quiet, tap-to-show affordance once in custody.
          if (inCustody &&
              d.activeRequest == null &&
              d.pickupCode.isNotEmpty) ...[
            const SizedBox(height: SSpace.md),
            _QuickCode(d: d),
          ],
          if (inCustody && !d.isClosed && !d.isCancelled && d.items.isNotEmpty) ...[
            const SizedBox(height: SSpace.md),
            _HandoffCard(d: d),
          ],
          const SizedBox(height: SSpace.lg),
          _VenueCard(d: d),
          const SizedBox(height: SSpace.md),
          if (d.host != null) ...[
            _HostCard(d: d),
            const SizedBox(height: SSpace.md),
          ],
          _WhenCard(d: d),
          const SizedBox(height: SSpace.md),
          _AmountCard(d: d),
          if (p.addOns.isNotEmpty && !d.isClosed && !d.isCancelled) ...[
            const SizedBox(height: SSpace.md),
            _AddServicesCard(addOns: p.addOns),
          ],
          const SizedBox(height: SSpace.md),
          _ActivityCard(d: d),
          const SizedBox(height: SSpace.lg),
          _ActionBar(d: d),
          const SizedBox(height: SSpace.xxl),
        ],
      ),
    );
  }
}

// ── header ───────────────────────────────────────────────────────────────────

class _StatusHeader extends StatelessWidget {
  final BookingDetail d;
  const _StatusHeader({required this.d});
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(d.title,
                  style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: SColors.ink)),
              const SizedBox(height: 2),
              Text('Booking #${d.reference}',
                  style: const TextStyle(color: SColors.muted, fontSize: 13)),
            ],
          ),
        ),
        _PhasePill(d.phase),
      ],
    );
  }
}

class _PhasePill extends StatelessWidget {
  final StayPhase phase;
  const _PhasePill(this.phase);
  @override
  Widget build(BuildContext context) {
    late final String label;
    late final Color bg;
    late final Color fg;
    switch (phase) {
      case StayPhase.reserved:
        label = 'Reserved';
        bg = SColors.claySoft;
        fg = SColors.clay2;
        break;
      case StayPhase.inCustody:
        label = 'In custody';
        bg = SColors.greenSoft;
        fg = SColors.green2;
        break;
      case StayPhase.retrieved:
        label = 'Out';
        bg = const Color(0xFFFBEBD0);
        fg = const Color(0xFF8A5A12);
        break;
      case StayPhase.closed:
        label = 'Closed';
        bg = SColors.line;
        fg = SColors.ink2;
        break;
      case StayPhase.cancelled:
        label = 'Cancelled';
        bg = const Color(0xFFF3D9D3);
        fg = SColors.danger;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label,
          style: TextStyle(
              color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

// ── the adaptive hero ─────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  final BookingDetail d;
  const _Hero({required this.d});

  @override
  Widget build(BuildContext context) {
    if (d.activeRequest != null) return _RequestMonitor(d: d);
    switch (d.phase) {
      case StayPhase.reserved:
        // Before drop-off the code IS the point — keep it prominent.
        return _CodePanel(
          label: 'SHOW AT DROP-OFF',
          code: d.dropoffCode,
          bookingId: d.bookingId,
          hint: 'The host scans this to receive your stuff.',
        );
      case StayPhase.inCustody:
      case StayPhase.retrieved:
        if (!d.isManned) return _SelfServeHero(d: d);
        if (d.canRequest) return _RequestHero(d: d);
        return _InCustodyInfo(d: d);
      case StayPhase.closed:
        return _ClosedHero(d: d);
      case StayPhase.cancelled:
        return const SCard(
          color: Color(0xFFF3D9D3),
          child: Row(children: [
            Icon(Icons.cancel_rounded, color: SColors.danger),
            SizedBox(width: SSpace.md),
            Expanded(
                child: Text('This booking was cancelled.',
                    style: TextStyle(
                        color: SColors.danger, fontWeight: FontWeight.w600))),
          ]),
        );
    }
  }
}

bool _isVehicle(BookingDetail d) {
  final t = (d.venue?.spaceType ?? '').toLowerCase();
  return (d.requestableItem?.identifier ?? '').isNotEmpty ||
      t.contains('valet') ||
      t.contains('park');
}

String _thing(BookingDetail d) => _isVehicle(d) ? 'car' : 'stuff';

/// The primary in-custody action (manned): request a retrieval/return. Big,
/// tappable, works in advance; opens a sheet for an optional note.
class _RequestHero extends StatelessWidget {
  final BookingDetail d;
  const _RequestHero({required this.d});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    final retrieve = d.requestKind == 'retrieve';
    final thing = _thing(d);
    final title = retrieve
        ? (_isVehicle(d) ? 'Request your car' : 'Get your stuff')
        : "Return your $thing";
    final sub = retrieve
        ? 'Ask the host to bring it out — even a few minutes ahead. You’ll watch it go from requested to ready.'
        : 'Let the host know you’re bringing it back.';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.ink,
        borderRadius: BorderRadius.circular(SRadius.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Icon(_isVehicle(d) ? Icons.directions_car_filled_rounded : Icons.luggage_rounded,
                color: SColors.lime, size: 18),
            const SizedBox(width: 6),
            Text(retrieve ? 'READY WHEN YOU ARE' : 'HEADING BACK',
                style: const TextStyle(
                    color: SColors.lime,
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 8),
          Text(title,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(sub,
              style:
                  const TextStyle(color: Color(0xFFC9CABF), fontSize: 13, height: 1.35)),
          const SizedBox(height: SSpace.lg),
          ElevatedButton.icon(
            onPressed: p.busy ? null : () => _open(context),
            icon: const Icon(Icons.pan_tool_alt_rounded),
            label: Text(p.busy
                ? 'Sending…'
                : (retrieve ? 'Request my $thing' : 'Tell them I’m back')),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              retrieve ? 'Someone else collecting? Add a note.' : ' ',
              style: const TextStyle(color: Color(0xFF9D998C), fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _open(BuildContext context) async {
    final note = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (_) => _RequestSheet(retrieve: d.requestKind == 'retrieve', thing: _thing(d)),
    );
    if (note == null || !context.mounted) return; // dismissed
    final prov = context.read<BookingDetailProvider>();
    final ok = await prov.request(note: note.isEmpty ? null : note);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? 'Request sent — watch the status above.'
          : (prov.error ?? 'Could not send the request')),
      backgroundColor: ok ? SColors.green : SColors.danger,
    ));
  }
}

/// Optional-note sheet shown when filing a request.
class _RequestSheet extends StatefulWidget {
  final bool retrieve;
  final String thing;
  const _RequestSheet({required this.retrieve, required this.thing});
  @override
  State<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends State<_RequestSheet> {
  final _c = TextEditingController();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(SSpace.lg, SSpace.lg, SSpace.lg, SSpace.lg + pad),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.retrieve ? 'Request' : 'Return'} your ${widget.thing}',
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700, color: SColors.ink)),
          const SizedBox(height: 4),
          const Text('Add a note if it helps — timing, or who’s collecting.',
              style: TextStyle(color: SColors.muted, fontSize: 13)),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _c,
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: widget.retrieve
                  ? 'e.g. “Out front in 30 min” or “My friend Sam is collecting”'
                  : 'e.g. “Back at the stand now”',
              filled: true,
              fillColor: SColors.paper2,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SRadius.md),
                  borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: SSpace.md),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(context, _c.text.trim()),
            icon: const Icon(Icons.send_rounded),
            label: const Text('Send request'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }
}

/// Self-serve (unmanned) hero — the guest moves it themselves.
class _SelfServeHero extends StatelessWidget {
  final BookingDetail d;
  const _SelfServeHero({required this.d});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    final out = d.retrievableItem != null; // something here to take
    return SCard(
      color: SColors.ink,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('SELF-SERVE',
              style: TextStyle(
                  color: SColors.lime,
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(out ? 'Grab your stuff any time' : 'Put your stuff back',
              style: const TextStyle(
                  color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: SSpace.md),
          ElevatedButton.icon(
            onPressed: p.busy
                ? null
                : () => _move(context, out ? 'out' : 'in'),
            icon: Icon(out ? Icons.logout_rounded : Icons.login_rounded),
            label: Text(p.busy ? 'Logging…' : (out ? 'Take my stuff' : 'Put it back')),
          ),
        ],
      ),
    );
  }

  Future<void> _move(BuildContext context, String dir) async {
    final prov = context.read<BookingDetailProvider>();
    final ok = await prov.selfMoveAll(dir);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? (dir == 'out' ? 'Logged — enjoy!' : 'Logged — back in storage.')
          : (prov.error ?? 'Could not record that')),
      backgroundColor: ok ? SColors.green : SColors.danger,
    ));
  }
}

/// In custody but nothing to request right now (rare — e.g. just fulfilled).
class _InCustodyInfo extends StatelessWidget {
  final BookingDetail d;
  const _InCustodyInfo({required this.d});
  @override
  Widget build(BuildContext context) {
    return const SCard(
      color: SColors.greenSoft,
      child: Row(children: [
        Icon(Icons.verified_user_rounded, color: SColors.green),
        SizedBox(width: SSpace.md),
        Expanded(
            child: Text('Safely in custody.',
                style: TextStyle(
                    color: SColors.green2, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

class _ClosedHero extends StatelessWidget {
  final BookingDetail d;
  const _ClosedHero({required this.d});
  @override
  Widget build(BuildContext context) {
    final paid = d.payment.paid;
    return SCard(
      color: SColors.greenSoft,
      child: Row(children: [
        const Icon(Icons.check_circle_rounded, color: SColors.green),
        const SizedBox(width: SSpace.md),
        Expanded(
          child: Text(
            paid > 0
                ? 'Stay closed · ${money(paid)} paid. Thanks for using Stowbo!'
                : 'Stay closed. Thanks for using Stowbo!',
            style: const TextStyle(
                color: SColors.green2, fontWeight: FontWeight.w600),
          ),
        ),
      ]),
    );
  }
}

// ── live request monitor ──────────────────────────────────────────────────────

class _RequestMonitor extends StatelessWidget {
  final BookingDetail d;
  const _RequestMonitor({required this.d});

  static const _steps = ['Requested', 'In progress', 'Ready', 'Handed over'];

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    final r = d.activeRequest!;
    final item = d.requestingItem;
    final what = (item?.displayName.isNotEmpty ?? false)
        ? item!.displayName
        : 'your ${_thing(d)}';
    final ready = r.status == 'ready';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: ready ? SColors.green : SColors.ink,
        borderRadius: BorderRadius.circular(SRadius.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Text(r.isRetrieve ? 'RETRIEVAL REQUEST' : 'RETURN REQUEST',
                style: const TextStyle(
                    color: SColors.lime,
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w600)),
            const Spacer(),
            _liveDot(),
          ]),
          const SizedBox(height: 8),
          Text(r.headline,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(
            ready ? '$what is ready.' : '$what · asked ${_ago(r.requestedAt)}',
            style: const TextStyle(color: Color(0xFFC9CABF), fontSize: 13),
          ),
          if (r.hostNote != null) ...[
            const SizedBox(height: 6),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.sticky_note_2_outlined,
                  size: 15, color: SColors.lime),
              const SizedBox(width: 6),
              Expanded(
                  child: Text('Host: ${r.hostNote}',
                      style: const TextStyle(color: Colors.white, fontSize: 13))),
            ]),
          ],
          const SizedBox(height: SSpace.lg),
          _Stepper(current: r.step),
          const SizedBox(height: SSpace.lg),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _openChat(context, d),
                style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Color(0x55FFFFFF))),
                icon: const Icon(Icons.help_outline_rounded, size: 18),
                label: const Text('Ask host'),
              ),
            ),
            const SizedBox(width: SSpace.sm),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: p.busy ? null : () => _cancel(context),
                style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Color(0x55FFFFFF))),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Cancel'),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _liveDot() => Row(mainAxisSize: MainAxisSize.min, children: const [
        SizedBox(
          width: 8,
          height: 8,
          child: DecoratedBox(
              decoration:
                  BoxDecoration(color: SColors.lime, shape: BoxShape.circle)),
        ),
        SizedBox(width: 6),
        Text('LIVE',
            style: TextStyle(
                color: SColors.lime,
                fontSize: 10,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w700)),
      ]);

  Future<void> _cancel(BuildContext context) async {
    final prov = context.read<BookingDetailProvider>();
    final ok = await prov.cancelActiveRequest();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:
            Text(ok ? 'Request cancelled' : (prov.error ?? 'Could not cancel')),
        backgroundColor: ok ? SColors.ink : SColors.danger));
  }

  static String _ago(DateTime? t) {
    if (t == null) return 'just now';
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'just now';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    return DateFormat('MMM d, h:mm a').format(t);
  }
}

class _Stepper extends StatelessWidget {
  final int current; // 0..3
  const _Stepper({required this.current});
  @override
  Widget build(BuildContext context) {
    const labels = _RequestMonitor._steps;
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++)
          Expanded(
            child: Column(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: i <= current ? SColors.lime : const Color(0x33FFFFFF),
                    shape: BoxShape.circle,
                  ),
                  child: i < current
                      ? const Icon(Icons.check, size: 14, color: SColors.ink)
                      : i == current
                          ? const Center(
                              child: SizedBox(
                                  width: 8,
                                  height: 8,
                                  child: DecoratedBox(
                                      decoration: BoxDecoration(
                                          color: SColors.ink,
                                          shape: BoxShape.circle))))
                          : null,
                ),
                const SizedBox(height: 6),
                Text(labels[i],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: i <= current
                            ? Colors.white
                            : const Color(0x88FFFFFF),
                        fontSize: 10.5,
                        fontWeight:
                            i == current ? FontWeight.w700 : FontWeight.w500)),
              ],
            ),
          ),
      ],
    );
  }
}

// ── pickup code (collapsed) ───────────────────────────────────────────────────

class _QuickCode extends StatelessWidget {
  final BookingDetail d;
  const _QuickCode({required this.d});
  @override
  Widget build(BuildContext context) {
    return SCard(
      onTap: () => showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (_) => _CodeSheet(d: d),
      ),
      padding: const EdgeInsets.symmetric(
          horizontal: SSpace.lg, vertical: SSpace.md),
      child: Row(children: [
        const Icon(Icons.qr_code_2_rounded, color: SColors.ink2),
        const SizedBox(width: SSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Pickup code',
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: SColors.ink)),
              Text(d.pickupCode.split('').join(' '),
                  style: const TextStyle(
                      color: SColors.muted, letterSpacing: 2, fontSize: 13)),
            ],
          ),
        ),
        const Text('Show',
            style: TextStyle(
                color: SColors.green, fontWeight: FontWeight.w700)),
        const Icon(Icons.chevron_right_rounded, color: SColors.faint),
      ]),
    );
  }
}

class _CodeSheet extends StatelessWidget {
  final BookingDetail d;
  const _CodeSheet({required this.d});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(SSpace.lg),
      child: _CodePanel(
        label: 'SHOW AT PICKUP',
        code: d.pickupCode,
        bookingId: d.bookingId,
        hint: 'Show this when you collect your stuff.',
      ),
    );
  }
}

class _CodePanel extends StatelessWidget {
  final String label;
  final String code;
  final String bookingId;
  final String hint;
  const _CodePanel({
    required this.label,
    required this.code,
    required this.bookingId,
    required this.hint,
  });
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
          color: SColors.ink, borderRadius: BorderRadius.circular(SRadius.xl)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: const TextStyle(
                  color: SColors.lime,
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: SSpace.md),
          Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: QrImageView(
              data: '$bookingId|$code',
              size: 180,
              backgroundColor: Colors.white,
              padding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: SSpace.md),
          Text(code.isEmpty ? bookingId : code.split('').join(' '),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 3)),
          const SizedBox(height: 4),
          Text(hint,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF9D998C), fontSize: 12)),
        ],
      ),
    );
  }
}

// ── venue ────────────────────────────────────────────────────────────────────

class _VenueCard extends StatelessWidget {
  final BookingDetail d;
  const _VenueCard({required this.d});
  @override
  Widget build(BuildContext context) {
    final v = d.venue;
    final address = v?.address ?? '';
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('WHERE'),
          const SizedBox(height: SSpace.sm),
          Text(v?.title ?? d.title,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 16, color: SColors.ink)),
          if (address.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.place_outlined, size: 16, color: SColors.muted),
              const SizedBox(width: 6),
              Expanded(
                  child: Text(address,
                      style: const TextStyle(color: SColors.ink2, height: 1.3))),
            ]),
          ] else
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Address shared with the host on this booking.',
                  style: TextStyle(color: SColors.muted, fontSize: 13)),
            ),
          if ((v?.accessHours ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.schedule_rounded, size: 16, color: SColors.muted),
              const SizedBox(width: 6),
              Expanded(
                  child: Text(v!.accessHours,
                      style: const TextStyle(color: SColors.ink2))),
            ]),
          ],
          const SizedBox(height: 8),
          Row(children: [
            _tag(
              icon: (v?.isManned ?? true)
                  ? Icons.person_rounded
                  : Icons.lock_open_rounded,
              text: (v?.isManned ?? true) ? 'Staffed' : 'Self-serve',
            ),
            if ((v?.spaceType ?? '').isNotEmpty) ...[
              const SizedBox(width: 8),
              _tag(icon: Icons.category_outlined, text: StowboHost.labelForKind(v!.spaceType)),
            ],
          ]),
        ],
      ),
    );
  }

  Widget _tag({required IconData icon, required String text}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
            color: SColors.line2, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: SColors.muted),
          const SizedBox(width: 4),
          Text(text,
              style: const TextStyle(
                  color: SColors.ink2,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ]),
      );
}

// ── host ─────────────────────────────────────────────────────────────────────

class _HostCard extends StatelessWidget {
  final BookingDetail d;
  const _HostCard({required this.d});
  @override
  Widget build(BuildContext context) {
    final h = d.host!;
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('WHO'),
          const SizedBox(height: SSpace.sm),
          Row(children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: SColors.greenSoft,
              backgroundImage: (h.avatar != null && h.avatar!.isNotEmpty)
                  ? NetworkImage(h.avatar!)
                  : null,
              child: (h.avatar == null || h.avatar!.isEmpty)
                  ? Text(h.name.isNotEmpty ? h.name[0].toUpperCase() : '?',
                      style: const TextStyle(
                          color: SColors.green2, fontWeight: FontWeight.w700))
                  : null,
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(
                      child: Text(h.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: SColors.ink)),
                    ),
                    if (h.verified) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.verified_rounded,
                          size: 15, color: SColors.green),
                    ],
                  ]),
                  const Text('Host',
                      style: TextStyle(color: SColors.muted, fontSize: 13)),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Message',
              onPressed: () => _openChat(context, d),
              icon: const Icon(Icons.chat_bubble_outline_rounded,
                  color: SColors.green),
            ),
            if (h.phone != null)
              IconButton(
                tooltip: h.phone,
                onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Call ${h.phone}'),
                        backgroundColor: SColors.ink)),
                icon: const Icon(Icons.call_outlined, color: SColors.green),
              ),
          ]),
        ],
      ),
    );
  }
}

// ── when ─────────────────────────────────────────────────────────────────────

class _WhenCard extends StatelessWidget {
  final BookingDetail d;
  const _WhenCard({required this.d});

  DateTime? get _checkedIn {
    final ins =
        d.items.map((i) => i.checkedInAt).whereType<DateTime>().toList()
          ..sort();
    return ins.isEmpty ? null : ins.first;
  }

  DateTime? get _checkedOut {
    final outs =
        d.items.map((i) => i.checkedOutAt).whereType<DateTime>().toList()
          ..sort();
    if (outs.isEmpty || outs.length < d.items.length) return null;
    return outs.last;
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('EEE MMM d, h:mm a');
    final rows = <Widget>[];
    if (d.windowStart != null) {
      rows.add(_row('Booked from', fmt.format(d.windowStart!)));
    }
    if (d.isOpenEnded) {
      rows.add(_row('Ends', 'Open — no end set', accent: true));
    } else if (d.windowEnd != null) {
      rows.add(_row('Booked until', fmt.format(d.windowEnd!)));
    }
    if (_checkedIn != null) {
      rows.add(_row('Checked in', fmt.format(_checkedIn!), good: true));
    }
    if (_checkedOut != null) {
      rows.add(_row('Checked out', fmt.format(_checkedOut!)));
    }

    String? live;
    if (d.phase == StayPhase.inCustody || d.phase == StayPhase.retrieved) {
      final since = _checkedIn ?? d.windowStart;
      if (since != null) {
        live = 'Stored for ${humanDuration(DateTime.now().difference(since))}';
      }
      if (!d.isOpenEnded && d.windowEnd != null) {
        final left = d.windowEnd!.difference(DateTime.now());
        live = left.isNegative
            ? 'Overdue by ${humanDuration(left.abs())}'
            : '${live ?? ''}${live == null ? '' : ' · '}${humanDuration(left)} left';
      }
    }

    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('WHEN'),
          const SizedBox(height: SSpace.sm),
          ...rows,
          if (live != null) ...[
            const SizedBox(height: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                  color: live.startsWith('Overdue')
                      ? const Color(0xFFF3D9D3)
                      : SColors.greenSoft,
                  borderRadius: BorderRadius.circular(8)),
              child: Text(live,
                  style: TextStyle(
                      color: live.startsWith('Overdue')
                          ? SColors.danger
                          : SColors.green2,
                      fontWeight: FontWeight.w600,
                      fontSize: 13)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(String label, String value,
          {bool good = false, bool accent = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 108,
                child: Text(label,
                    style:
                        const TextStyle(color: SColors.muted, fontSize: 13))),
            Expanded(
              child: Text(value,
                  style: TextStyle(
                      color: good
                          ? SColors.green2
                          : accent
                              ? SColors.clay2
                              : SColors.ink,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );
}

// ── amount ───────────────────────────────────────────────────────────────────

class _AmountCard extends StatelessWidget {
  final BookingDetail d;
  const _AmountCard({required this.d});
  @override
  Widget build(BuildContext context) {
    final pay = d.payment;
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionLabel('HOW MUCH', trailing: _payPill(pay)),
          const SizedBox(height: SSpace.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(money(pay.paid > 0 ? pay.paid : d.total),
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: SColors.ink)),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Text(pay.isPaid ? 'paid' : 'total',
                    style: const TextStyle(color: SColors.muted)),
              ),
            ],
          ),
          if (pay.hasBalance) ...[
            const SizedBox(height: 2),
            Text('Balance due ${money(pay.balance)}',
                style: const TextStyle(
                    color: SColors.clay2, fontWeight: FontWeight.w600)),
            if (!kIsWeb) ...[
              const SizedBox(height: SSpace.md),
              _PayBalanceButton(d: d),
            ],
          ],
          const Divider(height: SSpace.xl, color: SColors.line),
          ...d.bill.where((r) => r.amount != 0).map(_billRow),
          if (d.deposit != null) _depositRow(d.deposit!),
          const SizedBox(height: 6),
          _totalRow('Total', d.total),
          if (pay.refunded > 0) _billLine('Refunded', -pay.refunded, muted: true),
        ],
      ),
    );
  }

  Widget _payPill(PaymentSummary p) {
    final paid = p.isPaid;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
          color: paid ? SColors.greenSoft : SColors.claySoft,
          borderRadius: BorderRadius.circular(999)),
      child: Text(paid ? 'Paid' : (p.towardBill > 0 ? 'Partial' : 'Unpaid'),
          style: TextStyle(
              color: paid ? SColors.green2 : SColors.clay2,
              fontWeight: FontWeight.w700,
              fontSize: 12)),
    );
  }

  Widget _billRow(BillRow r) => _billLine(r.label, r.amount);
  Widget _depositRow(Deposit d) => _billLine(
      'Deposit${d.refundable ? ' (refundable)' : ''}', d.amount,
      muted: d.status == 'returned');

  Widget _billLine(String label, double amount, {bool muted = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(
              child: Text(label,
                  style: TextStyle(
                      color: muted ? SColors.faint : SColors.ink2,
                      fontSize: 14,
                      decoration:
                          muted ? TextDecoration.lineThrough : null))),
          Text((amount < 0 ? '-' : '') + money(amount.abs()),
              style: TextStyle(
                  color: amount < 0 ? SColors.green : SColors.ink2,
                  fontWeight: FontWeight.w600)),
        ]),
      );

  Widget _totalRow(String label, double amount) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: SColors.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w700))),
          Text(money(amount),
              style: const TextStyle(
                  color: SColors.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w700)),
        ]),
      );
}

class _PayBalanceButton extends StatelessWidget {
  final BookingDetail d;
  const _PayBalanceButton({required this.d});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: p.busy ? null : () => _pay(context),
        icon: p.busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2.2))
            : const Icon(Icons.credit_card_rounded),
        label: Text(
            p.busy ? 'Processing…' : 'Pay balance ${money(d.payment.balance)}'),
      ),
    );
  }

  Future<void> _pay(BuildContext context) async {
    final prov = context.read<BookingDetailProvider>();
    final email = context.read<AuthProvider>().user?.email;
    final paid = await prov.payBalance(email: email);
    if (!context.mounted) return;
    if (paid != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Paid ${money(paid)} ✓'),
          backgroundColor: SColors.green));
    } else if (prov.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(prov.error!), backgroundColor: SColors.danger));
    }
  }
}

// ── add services ──────────────────────────────────────────────────────────────

class _AddServicesCard extends StatelessWidget {
  final List<Map<String, dynamic>> addOns;
  const _AddServicesCard({required this.addOns});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('ADD A SERVICE'),
          const SizedBox(height: SSpace.sm),
          for (final a in addOns) _row(context, a, p.busy),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> a, bool busy) {
    final name =
        (a['name'] ?? a['label'] ?? a['title'] ?? 'Service').toString();
    final amount = _num(a['price'] ?? a['amount'] ?? a['subtotal']);
    final desc = (a['description'] ?? '').toString();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, color: SColors.ink)),
                if (desc.isNotEmpty)
                  Text(desc,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 12)),
                Text(amount > 0 ? money(amount) : 'Free',
                    style: const TextStyle(
                        color: SColors.clay2,
                        fontWeight: FontWeight.w600,
                        fontSize: 13)),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: busy
                ? null
                : () => _add(context, name, amount,
                    (a['code'] ?? a['name'])?.toString()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _add(BuildContext context, String name, double amount,
      String? code) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: Text('Add $name?'),
        content: Text(amount > 0
            ? 'This adds ${money(amount)} to your booking, charged now.'
            : 'Add $name to your booking?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Not now')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(amount > 0 ? 'Add & pay' : 'Add')),
        ],
      ),
    );
    if (yes != true || !context.mounted) return;
    final prov = context.read<BookingDetailProvider>();
    final ok = await prov.addService(name: name, amount: amount, code: code);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok ? '$name added ✓' : (prov.error ?? 'Could not add')),
        backgroundColor: ok ? SColors.green : SColors.danger));
  }

  static double _num(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }
}

// ── activity / the log ────────────────────────────────────────────────────────

class _ActivityCard extends StatelessWidget {
  final BookingDetail d;
  const _ActivityCard({required this.d});

  @override
  Widget build(BuildContext context) {
    final events = d.timeline.where((t) => t.at != null).toList();
    final dayFmt = DateFormat('EEE MMM d');
    final timeFmt = DateFormat('h:mm a');

    final children = <Widget>[];
    String? lastDay;
    for (final e in events.take(40)) {
      final day = dayFmt.format(e.at!);
      if (day != lastDay) {
        lastDay = day;
        children.add(Padding(
          padding: EdgeInsets.only(
              top: children.isEmpty ? 0 : SSpace.md, bottom: 6),
          child: Text(day.toUpperCase(),
              style: const TextStyle(
                  color: SColors.faint,
                  fontSize: 11,
                  letterSpacing: 1,
                  fontWeight: FontWeight.w700)),
        ));
      }
      children.add(_eventRow(e, timeFmt.format(e.at!)));
    }
    if (children.isEmpty) {
      children.add(const Text('No activity yet.',
          style: TextStyle(color: SColors.muted, fontSize: 13)));
    }

    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('ACTIVITY'),
          const SizedBox(height: SSpace.sm),
          ...children,
        ],
      ),
    );
  }

  Widget _eventRow(TimelineEntry e, String time) {
    final (icon, color) = _iconFor(e);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_labelFor(e),
                    style: const TextStyle(
                        color: SColors.ink,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                if (e.detail.isNotEmpty)
                  Text(e.detail,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 12)),
              ],
            ),
          ),
          Text(time,
              style: const TextStyle(color: SColors.faint, fontSize: 12)),
        ],
      ),
    );
  }

  String _labelFor(TimelineEntry e) {
    final det = e.detail.toLowerCase();
    switch (e.type) {
      case 'booked':
        return 'Booked';
      case 'note':
        if (det.contains('checked in') || det.contains('checkin')) {
          return 'Checked in';
        }
        if (det.contains('checked out') || det.contains('checkout')) {
          return 'Checked out';
        }
        if (det.startsWith('pickup of') && det.contains('handed to')) {
          return 'Pickup handed off';
        }
        if (det.startsWith('hand-off to') && det.contains('revoked')) {
          return 'Hand-off revoked';
        }
        if (det.startsWith('pickup refused')) return 'Pickup refused';
        return 'Note';
      case 'access':
        if (det.contains('collected by')) return 'Collected';
        return det.contains('out') ? 'Moved out' : 'Moved in';
      case 'request':
        return e.actorRole == 'host' ? 'Host update' : 'Request';
      case 'extended':
        return 'Extended';
      case 'settled':
        return 'Settled';
      case 'authorized':
        return 'Payment authorized';
      case 'cancelled':
        return 'Cancelled';
      default:
        return e.type.isEmpty ? 'Update' : _cap(e.type);
    }
  }

  (IconData, Color) _iconFor(TimelineEntry e) {
    final det = e.detail.toLowerCase();
    switch (e.type) {
      case 'booked':
        return (Icons.event_available_rounded, SColors.green);
      case 'note':
        if (det.contains('checked out')) {
          return (Icons.logout_rounded, SColors.ink2);
        }
        if (det.startsWith('pickup of')) {
          return (Icons.person_add_alt_1_rounded, SColors.clay);
        }
        if (det.startsWith('hand-off to') && det.contains('revoked')) {
          return (Icons.person_remove_alt_1_rounded, SColors.muted);
        }
        if (det.startsWith('pickup refused')) {
          return (Icons.block_rounded, SColors.danger);
        }
        return (Icons.login_rounded, SColors.green);
      case 'access':
        if (det.contains('collected by')) {
          return (Icons.handshake_rounded, SColors.green);
        }
        return (
          det.contains('out')
              ? Icons.north_east_rounded
              : Icons.south_west_rounded,
          SColors.clay
        );
      case 'request':
        return (Icons.pan_tool_alt_rounded, SColors.amber);
      case 'extended':
        return (Icons.update_rounded, SColors.amber);
      case 'settled':
        return (Icons.receipt_long_rounded, SColors.green);
      case 'cancelled':
        return (Icons.cancel_rounded, SColors.danger);
      default:
        return (Icons.circle, SColors.faint);
    }
  }

  String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ── action bar ───────────────────────────────────────────────────────────────

class _ActionBar extends StatelessWidget {
  final BookingDetail d;
  const _ActionBar({required this.d});
  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    return Column(
      children: [
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _openChat(context, d),
              icon: const Icon(Icons.chat_bubble_outline_rounded),
              label: const Text('Message'),
            ),
          ),
          if (d.canExtend) ...[
            const SizedBox(width: SSpace.sm),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: p.busy ? null : () => _extend(context),
                icon: const Icon(Icons.more_time_rounded),
                label: const Text('Extend'),
              ),
            ),
          ],
        ]),
        if (d.canCancel) ...[
          const SizedBox(height: SSpace.sm),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: p.busy ? null : () => _cancel(context),
              icon: const Icon(Icons.cancel_outlined, color: SColors.danger),
              label: const Text('Cancel booking',
                  style: TextStyle(
                      color: SColors.danger, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _extend(BuildContext context) async {
    final base = d.windowEnd ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: base.add(const Duration(days: 1)),
      firstDate: base,
      lastDate: base.add(const Duration(days: 365)),
    );
    if (picked == null || !context.mounted) return;
    final prov = context.read<BookingDetailProvider>();
    final ok = await prov.extend(DateTime(
        picked.year, picked.month, picked.day, base.hour, base.minute));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:
            Text(ok ? 'Stay extended' : (prov.error ?? 'Could not extend')),
        backgroundColor: ok ? SColors.green : SColors.danger));
  }

  Future<void> _cancel(BuildContext context) async {
    final policy = d.cancellationPolicy;
    final refundNote = policy == null
        ? 'Refund follows the host\'s cancellation policy.'
        : policy.freeNow
            ? 'You\'re within the free-cancellation window — full refund.'
            : 'Past the free window — ${(policy.refundablePortion * 100).round()}% refundable.';
    final yes = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Cancel booking?'),
        content: Text(
            'Cancel your booking at ${d.title}?\n\n$refundNote\n\nThis can only be done before check-in.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep it')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: SColors.danger),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (yes != true || !context.mounted) return;
    final prov = context.read<BookingDetailProvider>();
    final ok = await prov.cancel();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:
            Text(ok ? 'Booking cancelled' : (prov.error ?? 'Could not cancel')),
        backgroundColor: ok ? SColors.ink : SColors.danger));
  }
}

// ── shared ───────────────────────────────────────────────────────────────────

void _openChat(BuildContext context, BookingDetail d) {
  final h = d.host;
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => ChatScreen(
        recipientId:
            h == null ? d.hostId ?? '' : (h.email.isNotEmpty ? h.email : h.id),
        recipientName: h?.name ?? 'Host',
        subtitle: 'Host',
        bookingId: d.bookingId,
      ),
    ),
  );
}

// ── delegated pickup (owner side) ─────────────────────────────────────────────

/// Who collects each item. "You" by default; a hand-off names someone else.
/// The owner sets the requirements, like shipping options.
class _HandoffCard extends StatelessWidget {
  final BookingDetail d;
  const _HandoffCard({required this.d});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<BookingDetailProvider>();
    final open = d.items.where((i) => i.checkedOutAt == null && i.status != 'cancelled').toList();
    final free = open.where((i) => p.delegationFor(i.id) == null).toList();
    final active = p.delegations.where((x) => x.isActive).toList();
    final done = p.delegations.where((x) => x.status == 'completed').toList();
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('PICKUP'),
          for (final it in open) _row(context, p, it),
          for (final x in done) _doneRow(x),
          if (free.isNotEmpty) ...[
            const SizedBox(height: SSpace.sm),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: p.busy ? null : () => _openDelegate(context, free),
                icon: const Icon(Icons.person_add_alt_1_rounded),
                label: Text(open.length > 1 ? 'Let someone else pick some up' : 'Let someone else pick this up'),
              ),
            ),
          ],
          if (active.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: SSpace.sm),
              child: Text('They show the pass at the counter. Your own code no longer releases what you handed off.',
                  style: TextStyle(color: SColors.faint, fontSize: 12)),
            ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, BookingDetailProvider p, CustodyItem it) {
    final x = p.delegationFor(it.id);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Icon(x == null ? Icons.person_rounded : Icons.person_pin_circle_rounded,
            size: 18, color: x == null ? SColors.ink2 : SColors.clay),
        const SizedBox(width: SSpace.sm),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(it.displayName, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(
              x == null
                  ? 'You pick this up'
                  : '${x.who} · ${x.verifyLabel}${x.validUntil != null ? ' · until ${DateFormat('EEE d MMM, h:mm a').format(x.validUntil!)}' : ''}',
              style: TextStyle(color: x == null ? SColors.muted : SColors.clay, fontSize: 12.5),
            ),
          ]),
        ),
        if (x != null)
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_horiz_rounded, color: SColors.muted),
            onSelected: (v) async {
              try {
                if (v == 'resend') {
                  final url = await p.resendDelegation(x.id);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text('Pass re-sent to ${x.who}'), backgroundColor: SColors.green));
                  if (url != null) _sharePass(context, url);
                } else if (v == 'cancel') {
                  await p.revokeDelegation(x.id);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Hand-off revoked — back on your own code'), backgroundColor: SColors.green));
                }
              } catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(e.toString().replaceFirst('Exception: ', '')), backgroundColor: SColors.danger));
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'resend', child: Text('Re-send the pass')),
              PopupMenuItem(value: 'cancel', child: Text('Revoke hand-off')),
            ],
          ),
      ]),
    );
  }

  Widget _doneRow(PickupDelegation x) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          const Icon(Icons.handshake_rounded, size: 18, color: SColors.green),
          const SizedBox(width: SSpace.sm),
          Expanded(
            child: Text(
              'Collected by ${x.collectedBy ?? x.who}${x.completedAt != null ? ' · ${DateFormat('EEE d MMM, h:mm a').format(x.completedAt!)}' : ''}',
              style: const TextStyle(color: SColors.green, fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ),
        ]),
      );

  Future<void> _openDelegate(BuildContext context, List<CustodyItem> free) async {
    final p = context.read<BookingDetailProvider>();
    final result = await showModalBottomSheet<PickupDelegation>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DelegateSheet(items: free, provider: p),
    );
    if (result != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Pass sent to ${result.who}'), backgroundColor: SColors.green));
      if (result.passUrl != null) _sharePass(context, result.passUrl!);
    }
  }

  /// The owner may also share the pass themselves (WhatsApp, in person).
  void _sharePass(BuildContext context, String url) {
    showModalBottomSheet(
      context: context,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.xl),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Their pickup pass', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: SSpace.xs),
            const Text('We sent it to them. You can also share the link yourself.',
                style: TextStyle(color: SColors.muted)),
            const SizedBox(height: SSpace.md),
            SelectableText(url, style: const TextStyle(fontSize: 13, color: SColors.ink2)),
            const SizedBox(height: SSpace.md),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: url));
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                icon: const Icon(Icons.copy_rounded),
                label: const Text('Copy link'),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _DelegateSheet extends StatefulWidget {
  final List<CustodyItem> items;
  final BookingDetailProvider provider;
  const _DelegateSheet({required this.items, required this.provider});
  @override
  State<_DelegateSheet> createState() => _DelegateSheetState();
}

class _DelegateSheetState extends State<_DelegateSheet> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _contact = TextEditingController();
  final _note = TextEditingController();
  late Set<String> _picked = widget.items.map((i) => i.id).toSet();
  String _verify = 'qr_id';
  DateTime? _until;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _contact.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickUntil() async {
    final now = DateTime.now();
    final day = await showDatePicker(context: context, initialDate: _until ?? now, firstDate: now, lastDate: now.add(const Duration(days: 60)));
    if (day == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_until ?? now));
    if (t == null) return;
    setState(() => _until = DateTime(day.year, day.month, day.day, t.hour, t.minute));
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    if (_picked.isEmpty) {
      setState(() => _error = 'Pick at least one item');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final contact = _contact.text.trim();
    final isEmail = contact.contains('@');
    try {
      final d = await widget.provider.delegate({
        'items': _picked.toList(),
        'name': _name.text.trim(),
        if (isEmail) 'email': contact else 'phone': contact,
        'verify': _verify,
        if (_until != null) 'validUntil': _until!.toUtc().toIso8601String(),
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
      });
      if (mounted) Navigator.pop(context, d);
    } catch (e) {
      setState(() {
        _saving = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
            color: SColors.paper, borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
        padding: const EdgeInsets.all(SSpace.xl),
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Let someone else pick up', style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.xs),
              const Text('They get a pass with a QR to show at the counter. You set what the host must check.',
                  style: TextStyle(color: SColors.muted)),
              const SizedBox(height: SSpace.lg),
              if (widget.items.length > 1) ...[
                const Text('What they collect', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: SSpace.xs),
                Wrap(
                  spacing: SSpace.sm,
                  runSpacing: SSpace.xs,
                  children: [
                    for (final it in widget.items)
                      FilterChip(
                        label: Text(it.displayName),
                        selected: _picked.contains(it.id),
                        onSelected: (v) => setState(() => v ? _picked.add(it.id) : _picked.remove(it.id)),
                      ),
                  ],
                ),
                const SizedBox(height: SSpace.md),
              ],
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Their name'),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Who is collecting?' : null,
              ),
              const SizedBox(height: SSpace.sm),
              TextFormField(
                controller: _contact,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Their phone or email', hintText: 'We send the pass here'),
                validator: (v) => (v ?? '').trim().length < 6 ? 'Phone or email' : null,
              ),
              const SizedBox(height: SSpace.md),
              const Text('The host must check', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: SSpace.xs),
              Wrap(
                spacing: SSpace.sm,
                children: [
                  for (final o in const [('qr', 'QR only'), ('qr_name', 'QR + name'), ('qr_id', 'QR + photo ID')])
                    ChoiceChip(label: Text(o.$2), selected: _verify == o.$1, onSelected: (_) => setState(() => _verify = o.$1)),
                ],
              ),
              const SizedBox(height: SSpace.md),
              OutlinedButton.icon(
                onPressed: _pickUntil,
                icon: const Icon(Icons.schedule_rounded),
                label: Text(_until == null ? 'Valid until the booking ends' : 'Until ${DateFormat('EEE d MMM, h:mm a').format(_until!)}'),
              ),
              const SizedBox(height: SSpace.sm),
              TextFormField(
                controller: _note,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Note for them (optional)', hintText: 'Ask for the blue box'),
              ),
              if (_error != null) ...[
                const SizedBox(height: SSpace.sm),
                Text(_error!, style: const TextStyle(color: SColors.danger)),
              ],
              const SizedBox(height: SSpace.lg),
              ElevatedButton(
                onPressed: _saving ? null : _send,
                style: ElevatedButton.styleFrom(backgroundColor: SColors.clay, minimumSize: const Size.fromHeight(52)),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Send the pass'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
