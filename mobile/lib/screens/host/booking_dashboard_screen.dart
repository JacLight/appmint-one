import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/stowbo_theme.dart';
import '../../models/booking.dart';
import '../../services/stowbo_api.dart';
import '../../services/community_service.dart';
import '../../services/community_chat_service.dart';
import '../../widgets/stowbo_widgets.dart';
import '../chat/chat_screen.dart';
import 'take_payment_sheet.dart';
import 'checkout_flow.dart';

/// The host's 360° view of one booking — request → fulfilment → payment →
/// support, every activity and every action in a single screen. All logic is
/// server-side; this drives it.
class BookingDashboardScreen extends StatefulWidget {
  final String bookingId;
  const BookingDashboardScreen({super.key, required this.bookingId});
  @override
  State<BookingDashboardScreen> createState() => _BookingDashboardScreenState();
}

class _BookingDashboardScreenState extends State<BookingDashboardScreen> {
  final _api = stowboApi;
  final _community = communityService;
  Booking? _b;
  double? _dueNow; // server-computed amount owed now (incl. running meter)
  double _accrued = 0;
  String? _payState; // free | metered | unpaid | partial | paid
  List<Map<String, dynamic>> _items = const [];
  List<Map<String, dynamic>> _bookingRequests = const [];
  bool _loading = true;
  String? _error;
  bool _busy = false;
  StreamSubscription<Map<String, dynamic>>? _socketSub;

  @override
  void initState() {
    super.initState();
    _load();
    // Live-refresh when a guest files/updates a request on this booking, so the
    // host sees it appear without a manual pull-to-refresh.
    communityChatService.ensureConnected();
    _socketSub = communityChatService.onStowbo.listen((evt) {
      final b = (evt['booking'] ?? evt['bookingId'] ?? '').toString();
      if (b == widget.bookingId && mounted && !_busy) _load();
    });
  }

  @override
  void dispose() {
    _socketSub?.cancel();
    super.dispose();
  }

  // Amount owed now — the server's live figure (billed + running meter) when we
  // have it, else the model's stored balance.
  double _bal(Booking b) => _dueNow ?? b.balanceDue;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rec = await _api.hostBooking(widget.bookingId);
      _b = Booking.fromRecord(rec);
      final rawRequests = (rec['data'] as Map?)?['requests'];
      _bookingRequests = rawRequests is List
          ? rawRequests.whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList()
          : [];
      _items = await _api
          .bookingItems(widget.bookingId)
          .catchError((_) => <Map<String, dynamic>>[]);
      // The REAL amount owed now (billed balance + running meter) — the same
      // source take-payment and the settle guard use, so display/preset/settle
      // agree instead of showing a stale stored total (PAY-7).
      final due = await _api
          .bookingDue(widget.bookingId)
          .catchError((_) => <String, dynamic>{});
      _dueNow = double.tryParse('${due['due'] ?? ''}');
      _accrued = double.tryParse('${due['accrued'] ?? ''}') ?? 0;
      _payState = (due['payState'] ?? '').toString();
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _act(Future<void> Function() op, String okMsg) async {
    setState(() => _busy = true);
    try {
      await op();
      await _load();
      if (mounted) _toast(okMsg, SColors.green);
    } catch (e) {
      if (mounted) {
        _toast(e.toString().replaceFirst('Exception: ', ''), SColors.danger);
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  void _toast(String m, Color c) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(m), backgroundColor: c));

  @override
  Widget build(BuildContext context) {
    final b = _b;
    return Scaffold(
      appBar: AppBar(
        title: Text(b == null ? 'Booking' : '#${b.reference}'),
        actions: [
          if (b != null && !_loading)
            IconButton(
                tooltip: 'Take payment',
                icon: const Icon(Icons.contactless_rounded),
                onPressed: () async {
                  final ok = await TakePaymentSheet.show(
                    context,
                    bookingId: widget.bookingId,
                    listingId:
                        b.lines.isNotEmpty ? b.lines.first.listing : null,
                    presetAmount: _bal(b) > 0 ? _bal(b) : null,
                    presetCategory: 'balance',
                  );
                  if (ok == true) _load();
                }),
          if (b != null && !_loading)
            IconButton(
                icon: const Icon(Icons.refresh_rounded), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : b == null
              ? EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: "Couldn't load booking",
                  subtitle: _error,
                  action: OutlinedButton(
                      onPressed: _load, child: const Text('Retry')))
              : RefreshIndicator(
                  color: SColors.clay,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(SSpace.xl),
                    children: [
                      _header(b),
                      const SizedBox(height: SSpace.lg),
                      ..._requestCards(),
                      ..._bookingRequestCards(),
                      _money(b),
                      const SizedBox(height: SSpace.lg),
                      _custody(b),
                      const SizedBox(height: SSpace.lg),
                      _support(b),
                      const SizedBox(height: SSpace.lg),
                      _timeline(b),
                      const SizedBox(height: SSpace.lg),
                      _manage(b),
                      const SizedBox(height: SSpace.xxl),
                    ],
                  ),
                ),
    );
  }

  // ── header: status + customer + chat ──────────────────────────────────────
  String _custodyStatus(Booking b) {
    if (b.isCancelled || b.isSettled) return b.status;
    final rows = _items.map((i) => (i['data'] as Map?) ?? {}).toList();
    if (rows.isNotEmpty && rows.every((d) => d['checkedOutAt'] != null || d['status'] == 'ended' || d['status'] == 'cancelled')) return 'retrieved';
    if (rows.any((d) => d['checkedInAt'] != null && d['checkedOutAt'] == null)) return 'in_custody';
    return b.status == 'new' || b.status == 'confirmed' ? 'reserved' : b.status;
  }

  Widget _header(Booking b) {
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            _StatusPill(_custodyStatus(b)),
            const Spacer(),
            if (_bal(b) != 0)
              Text('Balance ${money(_bal(b))}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: SColors.clay2)),
          ]),
          const SizedBox(height: SSpace.md),
          Row(children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: SColors.claySoft,
              child: Text(
                  b.customer.isNotEmpty ? b.customer[0].toUpperCase() : '?',
                  style: const TextStyle(
                      color: SColors.clay2, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(b.customer.isEmpty ? 'Walk-in guest' : b.customer,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(
                      b.lines.isEmpty
                          ? '—'
                          : b.lines.map((l) => l.listingTitle).toSet().join(', '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: SColors.muted, fontSize: 13)),
                ],
              ),
            ),
            if (b.customer.isNotEmpty) IconButton(
              tooltip: 'Message',
              icon: const Icon(Icons.chat_bubble_outline_rounded,
                  color: SColors.clay),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ChatScreen(
                      recipientId: b.customer,
                      recipientName: b.customer,
                      subtitle: 'Guest',
                      bookingId: b.sk),
                ),
              ),
            ),
          ]),
          if (b.customer.isNotEmpty && b.status != 'settled' && b.status != 'cancelled') ...[
            const SizedBox(height: SSpace.md),
            const Divider(height: 1, color: SColors.line),
            const SizedBox(height: SSpace.md),
            const Text('Tell the guest',
                style: TextStyle(
                    color: SColors.faint,
                    fontSize: 11,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: SSpace.sm),
            Wrap(
              spacing: SSpace.sm,
              runSpacing: SSpace.sm,
              children: [
                for (final s in _statusTemplates)
                  _StatusChip(
                    label: s.$1,
                    busy: _busy,
                    onTap: () => _sendStatus(b, s.$2),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // One-tap status pings — templated messages that land on the booking chat
  // thread and (server-side) fan out as the guest's email + SMS alert.
  static const List<(String, String)> _statusTemplates = [
    ('Received ✓', "Got your stuff — it's safely stored. 📦"),
    ('Getting it ready', 'Getting your stuff ready now — one moment.'),
    ('Ready for pickup', 'Your stuff is ready for pickup. 👍'),
    ('Out front 🚗', 'Your vehicle is out front and ready.'),
  ];

  Future<void> _sendStatus(Booking b, String content) async {
    setState(() => _busy = true);
    try {
      await _community.sendMessage(
        recipientId: b.customer,
        content: content,
        context: {'bookingId': b.sk, 'reference': b.reference},
      );
      if (mounted) _toast('Sent to guest', SColors.green);
    } catch (e) {
      if (mounted) {
        _toast(e.toString().replaceFirst('Exception: ', ''), SColors.danger);
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  // ── open guest requests (retrieve / return) — the host acts, guest watches ──
  List<Widget> _bookingRequestCards() => _bookingRequests
      .where((r) => !['done', 'declined'].contains(r['status']))
      .map((r) {
        final type = r['type'];
        final status = r['status'];
        final title = r['label'] ?? {'out': 'Retrieve belongings', 'in': 'Return belongings', 'checkout': 'Collect and check out'}[type] ?? 'Guest request';
        final next = status == 'open' ? 'acknowledged' : status == 'acknowledged' ? 'ready' : 'done';
        final label = next == 'acknowledged' ? 'Start preparing' : next == 'ready' ? 'Mark ready' : type == 'out' ? 'Hand out' : type == 'in' ? 'Receive back' : type == 'checkout' ? 'Check out' : 'Mark done';
        return Padding(
          padding: const EdgeInsets.only(bottom: SSpace.md),
          child: SCard(color: status == 'ready' ? SColors.greenSoft : SColors.claySoft,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title.toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: SSpace.sm),
              if ((r['note'] ?? '').toString().isNotEmpty) Text(r['note'].toString()),
              Wrap(spacing: SSpace.sm, children: [
                _reqBtn(label, Icons.check_rounded, () => _completeBookingRequest(r, next)),
                TextButton(onPressed: _busy ? null : () => _completeBookingRequest(r, 'declined'), child: const Text('Decline')),
              ]),
            ])),
        );
      }).toList();

  Future<void> _completeBookingRequest(Map<String, dynamic> request, String status) => _act(() async {
    final type = request['type'];
    if (status == 'done' && ['out', 'in', 'checkout'].contains(type)) {
      // Read current custody before acting, so a retry never repeats a movement
      // already completed by this or another operator.
      final items = await _api.bookingItems(widget.bookingId);
      for (final item in items) {
        final d = (item['data'] as Map?) ?? {};
        if (request['item'] != null && request['item'] != item['sk']) continue;
        if (d['checkedInAt'] == null || d['checkedOutAt'] != null || ['cancelled', 'ended'].contains(d['status'])) continue;
        final movements = d['movements'] as List? ?? [];
        final present = movements.isEmpty || (movements.last as Map)['direction'] != 'out';
        final direction = type == 'in' ? 'in' : 'out';
        if (present != (direction == 'in')) {
          await _api.itemMovement(item['sk'].toString(), {'direction': direction});
        }
        if (type == 'checkout') {
          if (!mounted || !await runCheckout(context, _api, item['sk'].toString())) return;
        }
      }
    }
    await _api.respondBookingRequest(widget.bookingId, request['id'].toString(), status);
  }, 'Request updated');

  List<Widget> _requestCards() {
    final open = _items.where((it) {
      final r = (it['data'] as Map?)?['request'];
      return r is Map && r['active'] == true;
    }).toList();
    if (open.isEmpty) return const [];
    return [
      for (final it in open) ...[
        _requestCard(it),
        const SizedBox(height: SSpace.md),
      ],
    ];
  }

  Widget _requestCard(Map<String, dynamic> it) {
    final d = (it['data'] as Map?) ?? {};
    final r = (d['request'] as Map?) ?? {};
    final status = (r['status'] ?? 'requested').toString();
    final dir = (r['direction'] ?? 'out').toString();
    final retrieve = dir == 'out';
    final name = (d['label'] ?? d['identifier'] ?? d['unit'] ?? 'item').toString();
    final id = it['sk'].toString();

    Widget primary;
    if (status == 'requested' || status == 'acknowledged') {
      primary = _reqBtn('Start preparing', Icons.play_arrow_rounded,
          () => _advanceRequest(id, 'preparing'));
    } else if (status == 'preparing') {
      primary = _reqBtn('Mark ready', Icons.check_rounded,
          () => _advanceRequest(id, 'ready'));
    } else {
      // ready → the physical hand-off closes it
      primary = _reqBtn(retrieve ? 'Hand out ✓' : 'Receive back ✓',
          Icons.done_all_rounded, () => _handOut(id, dir));
    }

    return SCard(
      color: status == 'ready' ? SColors.greenSoft : SColors.claySoft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(retrieve ? Icons.pan_tool_alt_rounded : Icons.login_rounded,
                size: 18, color: SColors.clay2),
            const SizedBox(width: 6),
            Text(retrieve ? 'RETRIEVAL REQUEST' : 'RETURN REQUEST',
                style: const TextStyle(
                    color: SColors.clay2,
                    fontSize: 11,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700)),
            const Spacer(),
            Text(status.toUpperCase(),
                style: const TextStyle(
                    color: SColors.ink2,
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 6),
          Text(
              retrieve
                  ? 'Guest wants "$name" brought out'
                  : 'Guest is returning "$name"',
              style: const TextStyle(
                  color: SColors.ink, fontWeight: FontWeight.w700, fontSize: 15)),
          if (r['note'] != null && r['note'].toString().isNotEmpty) ...[
            const SizedBox(height: 2),
            Text('“${r['note']}”',
                style: const TextStyle(
                    color: SColors.muted, fontStyle: FontStyle.italic)),
          ],
          const SizedBox(height: SSpace.md),
          Row(children: [
            Expanded(child: primary),
            const SizedBox(width: SSpace.sm),
            OutlinedButton(
              onPressed: _busy ? null : _messageGuest,
              child: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _reqBtn(String label, IconData icon, VoidCallback onTap) =>
      ElevatedButton.icon(
        onPressed: _busy ? null : onTap,
        icon: Icon(icon, size: 18),
        label: Text(label),
      );

  Future<void> _advanceRequest(String itemId, String status) =>
      _act(() => _api.hostUpdateRequest(itemId, status).then((_) {}),
          'Guest notified');

  Future<void> _handOut(String itemId, String direction) => _act(
      () => _api.itemMovement(itemId, {'direction': direction}).then((_) {}),
      direction == 'out' ? 'Handed out ✓' : 'Received back ✓');

  void _messageGuest() {
    final b = _b;
    if (b == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatScreen(
            recipientId: b.customer,
            recipientName: b.customer,
            subtitle: 'Guest',
            bookingId: b.sk),
      ),
    );
  }

  // ── the running account ───────────────────────────────────────────────────
  Widget _money(Booking b) {
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Money header now SAYS where the booking stands — a clear badge
          // (free / metered / unpaid / part-paid / paid), never just a bare $0.
          Row(children: [
            const Expanded(child: SectionLabel('Money')),
            if ((_payState ?? '').isNotEmpty) payStatePill(_payState!),
          ]),
          // Space charge. Line-model bookings don't carry the legacy `subtotal`
          // field, so sum the space lines — otherwise a $4 stay showed "$0.00"
          // and only Total revealed it.
          _row(
              'Subtotal',
              money(b.subtotal != 0
                  ? b.subtotal
                  : b.lines
                      .where((l) => !l.isAdjustment)
                      .fold<double>(0, (s, l) => s + l.amount))),
          if (b.addOnTotal != 0) _row('Add-ons', money(b.addOnTotal)),
          if (b.deposit != 0) _row('Deposit held', money(b.deposit)),
          if (b.overstayCharge != 0)
            _row('Overstay', money(b.overstayCharge)),
          // Bill lines from the line model — every add-on, extra charge, credit
          // and reversal, itemised so the host can SEE what's on the bill and
          // undo a line that shouldn't be there.
          for (final l in b.lines.where((l) => l.isAdjustment)) _adjLine(b, l),
          // Legacy bookings (pre-line-model) carry a parallel adjustments array.
          for (final a in b.adjustments)
            _row(
                '${a.kind[0].toUpperCase()}${a.kind.substring(1)} · ${a.category}',
                '${a.kind == 'charge' ? '' : '−'}${money(a.amount)}',
                strike: a.reversed,
                color: a.kind == 'charge' ? SColors.ink : SColors.green),
          const Divider(height: SSpace.xl),
          if (_accrued > 0) _row('Unbilled usage', money(_accrued)),
          _row(_accrued > 0 ? 'Total so far' : 'Total', money(b.total + _accrued), bold: true),
          if (_bal(b) != 0)
            _row('Balance due', money(_bal(b)),
                bold: true, color: SColors.clay2),
          if (b.hostEarning != 0)
            _row('Your earning', money(b.hostEarning), color: SColors.green2),
          const SizedBox(height: SSpace.md),
          // actions
          Wrap(spacing: SSpace.sm, runSpacing: SSpace.sm, children: [
            _miniBtn('Add add-on', Icons.add_box_outlined, SColors.clay,
                () => _addAddon(b)),
            _miniBtn('Charge more', Icons.add_rounded, SColors.clay,
                () => _adjust(b, 'charge')),
            _miniBtn('Discount', Icons.remove_rounded, SColors.green,
                () => _adjust(b, 'discount')),
            _miniBtn('Refund', Icons.undo_rounded, SColors.green,
                () => _adjust(b, 'refund')),
            _miniBtn('Waive', Icons.block_flipped, SColors.muted,
                () => _adjust(b, 'waiver')),
          ]),
          if (!b.isSettled && !b.isCancelled) ...[
            const SizedBox(height: SSpace.md),
            // COLLECT — the way to actually take the money. Settle refuses an
            // unpaid booking (the server 402s), so this is how you get paid:
            // take the balance here, then settle pays you out.
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _busy
                    ? null
                    : () async {
                        final ok = await TakePaymentSheet.show(
                          context,
                          bookingId: widget.bookingId,
                          listingId: b.lines.isNotEmpty
                              ? b.lines.first.listing
                              : null,
                          presetAmount: _bal(b) > 0
                              ? _bal(b)
                              : (b.total > 0 ? b.total : null),
                          presetCategory: 'balance',
                        );
                        if (ok == true) _load();
                      },
                style: ElevatedButton.styleFrom(
                    backgroundColor: SColors.clay,
                    minimumSize: const Size.fromHeight(50)),
                icon: const Icon(Icons.contactless_rounded, color: Colors.white),
                label: Text(
                    _bal(b) > 0
                        ? 'Take payment · ${money(_bal(b))}'
                        : 'Take payment',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: SSpace.sm),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _busy
                    ? null
                    : () => _act(() => _api.settle(b.sk).then((_) {}),
                        'Settled & paid out'),
                icon: const Icon(Icons.account_balance_wallet_rounded),
                label: const Text('Settle & pay out'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── custody per line ──────────────────────────────────────────────────────
  Widget _custody(Booking b) {
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionLabel('Custody'),
          if (b.dropoffCode.isNotEmpty || b.pickupCode.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: SSpace.sm),
              child: Row(children: [
                if (b.dropoffCode.isNotEmpty)
                  _codeChip('Drop-off', b.dropoffCode),
                if (b.pickupCode.isNotEmpty) ...[
                  const SizedBox(width: SSpace.sm),
                  _codeChip('Pickup', b.pickupCode),
                ],
              ]),
            ),
          // Hand-offs: the owner let someone else collect some of this.
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _api.hostBookingDelegations(widget.bookingId),
            builder: (_, snap) {
              final rows = snap.data ?? const [];
              if (rows.isEmpty) return const SizedBox.shrink();
              return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final h in rows) _handoffRow(h),
                const SizedBox(height: SSpace.sm),
              ]);
            },
          ),
          // Only the physical things — add-on / charge / credit lines are bill
          // lines and render in Money, not as custody items.
          if (_items.isNotEmpty)
            for (final item in _items) _itemTile(item)
          else
            for (final l in b.lines.where((l) => !l.isAdjustment)) _lineTile(b, l),
        ],
      ),
    );
  }

  Widget _itemTile(Map<String, dynamic> item) {
    final d = (item['data'] as Map?) ?? {};
    final ended = d['checkedOutAt'] != null || d['status'] == 'ended';
    final cancelled = d['status'] == 'cancelled';
    final checkedIn = d['checkedInAt'] != null;
    final label = (d['identifier'] ?? d['label'] ?? d['unit'] ?? 'Item').toString();
    final state = cancelled ? 'Cancelled' : ended ? 'Collected' : !checkedIn ? 'Awaiting drop-off' : d['present'] == false ? 'Temporarily out' : 'In storage';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(ended ? Icons.check_circle_outline : Icons.inventory_2_outlined),
      title: Text(label),
      subtitle: Text(state),
    );
  }

  Widget _lineTile(Booking b, BookingLine l) {
    final photos = [...l.dropoffPhotos, ...l.pickupPhotos];
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(
                  '${l.quantity}× ${l.listingTitle}${l.unit != null && l.unit!.isNotEmpty ? ' · ${l.unit}' : ''}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            _LineState(l.state),
          ]),
          // Each physical thing (car/bag) with its in/out state — read-only
          // here; moving things in/out is the Counter's job (item-scoped).
          ...l.holdings.map((h) => Padding(
                padding: const EdgeInsets.only(top: SSpace.sm),
                child: Row(children: [
                  Icon(h.present
                      ? Icons.check_circle_rounded
                      : Icons.logout_rounded,
                      size: 16,
                      color: h.present ? SColors.green : SColors.faint),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(h.display,
                        style: const TextStyle(
                            fontSize: 13.5, fontWeight: FontWeight.w600)),
                  ),
                  Text(h.present ? 'here' : 'out',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: h.present ? SColors.green : SColors.muted)),
                ]),
              )),
          if (photos.isNotEmpty) ...[
            const SizedBox(height: SSpace.sm),
            SizedBox(
              height: 60,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: photos.length,
                separatorBuilder: (_, _) => const SizedBox(width: SSpace.sm),
                itemBuilder: (_, i) {
                  final url = (photos[i]['url'] ?? '').toString();
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(SRadius.sm),
                    child: url.isEmpty
                        ? Container(width: 60, color: SColors.paper2)
                        : CachedNetworkImage(
                            imageUrl: url,
                            width: 60,
                            height: 60,
                            fit: BoxFit.cover),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── support / claims (read-only — claims live on the record; money moves as
  //     charge/refund lines) ──────────────────────────────────────────────────
  Widget _support(Booking b) {
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionLabel('Support & claims'),
          if (b.claims.isEmpty)
            const Text('No claims or disputes.',
                style: TextStyle(color: SColors.muted, fontSize: 13))
          else
            for (final c in b.claims)
              Padding(
                padding: const EdgeInsets.only(bottom: SSpace.sm),
                child: Row(children: [
                  Icon(Icons.gavel_rounded,
                      size: 16,
                      color: c.status == 'resolved'
                          ? SColors.green
                          : SColors.amber),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    child: Text(
                        '${c.type} · ${c.description}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13)),
                  ),
                  Text(c.status,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 12)),
                ]),
              ),
        ],
      ),
    );
  }

  // ── timeline ──────────────────────────────────────────────────────────────
  Widget _timeline(Booking b) {
    return SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionLabel('Activity'),
          if (b.timeline.isEmpty)
            const Text('Nothing yet.',
                style: TextStyle(color: SColors.muted, fontSize: 13))
          else
            for (final e in b.timeline) _event(e),
        ],
      ),
    );
  }

  Widget _event(TimelineEvent e) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 5),
            decoration: const BoxDecoration(
                color: SColors.clay, shape: BoxShape.circle),
          ),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    e.type.replaceAll('_', ' ') +
                        (e.amount != 0 ? ' · ${money(e.amount)}' : ''),
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
                if (e.detail.isNotEmpty)
                  Text(e.detail,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 13)),
                Text(
                    [
                      if (e.actorRole.isNotEmpty) e.actorRole,
                      if (e.at != null) _ago(e.at!),
                    ].join(' · '),
                    style:
                        const TextStyle(color: SColors.faint, fontSize: 11.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── manage (check out / hold payout / cancel) ─────────────────────────────
  Widget _manage(Booking b) {
    if (b.isSettled || b.isCancelled) return const SizedBox.shrink();
    // Anything still physically here blocks check-out — the server enforces it
    // too (409), this just makes the state visible.
    final somethingHere =
        b.lines.expand((l) => l.holdings).any((h) => h.present);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (somethingHere)
          Padding(
            padding: const EdgeInsets.only(bottom: SSpace.sm),
            child: Text(
                'Something is still here — check out from the Counter once it’s moved out.',
                style: const TextStyle(color: SColors.muted, fontSize: 12.5)),
          ),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _togglePayoutHold(b),
              icon: Icon(b.paymentHeld
                  ? Icons.lock_open_rounded
                  : Icons.pause_circle_outline_rounded),
              label: Text(b.paymentHeld ? 'Release payout' : 'Hold payout'),
            ),
          ),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _confirmCancel(b),
              style: OutlinedButton.styleFrom(
                  foregroundColor: SColors.danger,
                  side:
                      BorderSide(color: SColors.danger.withValues(alpha: 0.4))),
              icon: const Icon(Icons.cancel_outlined),
              label: const Text('Cancel'),
            ),
          ),
        ]),
      ],
    );
  }

  // ── actions ───────────────────────────────────────────────────────────────
  Future<void> _adjust(Booking b, String kind) async {
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    const cats = {
      'charge': ['overstay', 'damage', 'cleaning', 'lost_key', 'lock_cut', 'oversize', 'other'],
      'discount': ['goodwill', 'price_match', 'promo', 'other'],
      'refund': ['service_failure', 'goodwill', 'other'],
      'waiver': ['goodwill', 'service_failure', 'other'],
    };
    String cat = cats[kind]!.first;
    String? err; // in-sheet validation — no more silent no-op on a bad amount
    final title = {
      'charge': 'Charge the guest',
      'discount': 'Apply a discount',
      'refund': 'Issue a refund',
      'waiver': 'Waive a charge',
    }[kind]!;

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.fromLTRB(SSpace.xl, SSpace.xl, SSpace.xl,
              SSpace.xl + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: SSpace.md),
              Wrap(
                spacing: SSpace.sm,
                children: cats[kind]!
                    .map((c) => ChoiceChip(
                          label: Text(c.replaceAll('_', ' ')),
                          selected: cat == c,
                          onSelected: (_) => setS(() => cat = c),
                        ))
                    .toList(),
              ),
              const SizedBox(height: SSpace.md),
              TextField(
                controller: amountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                    labelText: 'Amount', prefixText: '\$ '),
              ),
              const SizedBox(height: SSpace.sm),
              TextField(
                controller: descCtrl,
                decoration:
                    const InputDecoration(labelText: 'Note (optional)'),
              ),
              if (err != null) ...[
                const SizedBox(height: SSpace.sm),
                Text(err!,
                    style: const TextStyle(
                        color: SColors.danger, fontSize: 13)),
              ],
              const SizedBox(height: SSpace.lg),
              ElevatedButton(
                onPressed: () {
                  final amt = double.tryParse(amountCtrl.text.trim()) ?? 0;
                  if (amt <= 0) {
                    setS(() => err = 'Enter an amount greater than 0.');
                    return;
                  }
                  Navigator.pop(ctx, true);
                },
                child: Text(title),
              ),
            ],
          ),
        ),
      ),
    );
    if (ok != true) return;
    final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) return; // guarded in-sheet; belt-and-suspenders
    final body = {
      'category': cat,
      'amount': amount,
      // Send the KIND so discount / refund / waiver are recorded distinctly (and,
      // for credits, the server lowers the bill instead of raising it).
      'kind': kind,
      if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
    };
    await _act(
        () => (kind == 'charge'
                ? _api.hostCharge(b.sk, body)
                : _api.hostRefund(b.sk, body))
            .then((_) {}),
        kind == 'charge'
            ? 'Charged'
            : {'discount': 'Discount applied', 'refund': 'Refunded', 'waiver': 'Charge waived'}[kind] ?? 'Credited');
  }


  /// One bill line (add-on / charge / credit / reversal) with an undo. The
  /// reverse never deletes — it appends the opposite line, so the audit trail
  /// stays whole. A line that is itself a reversal, or already reversed, has no
  /// undo.
  Widget _adjLine(Booking b, BookingLine l) {
    final credit = l.amount < 0;
    final kindLabel = (l.kind ?? 'adjustment');
    final title = l.label.isNotEmpty
        ? l.label
        : '${kindLabel[0].toUpperCase()}${kindLabel.substring(1)}';
    // Platform fees (booking fee, trust & support) aren't the host's to undo —
    // only the lines the host or guest put on the bill.
    final canUndo = !l.reversed &&
        !l.isReversal &&
        l.kind != 'fee' &&
        !b.isSettled &&
        !b.isCancelled;
    final style = TextStyle(
      fontSize: 13.5,
      color: l.reversed ? SColors.faint : (credit ? SColors.green : SColors.ink),
      decoration: l.reversed ? TextDecoration.lineThrough : null,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(
          child: Text(
              '$title${l.kind == 'addon' ? ' · add-on' : ''}${l.isReversal ? '' : ''}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: style),
        ),
        Text('${credit ? '−' : ''}${money(l.amount.abs())}',
            style: style.copyWith(fontWeight: FontWeight.w600)),
        if (canUndo)
          IconButton(
            tooltip: 'Reverse this line',
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            icon: const Icon(Icons.undo_rounded, size: 18, color: SColors.muted),
            onPressed: _busy ? null : () => _reverseLine(b, l),
          )
        else
          const SizedBox(width: 32),
      ]),
    );
  }

  /// Undo a bill line. For a PAID add-on this credits the bill (the guest may
  /// end up overpaid — the server refunds the difference to their card, same as
  /// a discount); an unpaid one simply drops off the balance.
  Future<void> _reverseLine(Booking b, BookingLine l) async {
    final reasonCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SColors.card,
        title: Text('Reverse "${l.label.isNotEmpty ? l.label : (l.kind ?? 'line')}"?'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(
              'Adds the opposite of ${money(l.amount.abs())} to the bill — the original stays for the record. '
              'If the guest already paid for it, the difference goes back to their card.',
              style: const TextStyle(color: SColors.muted, fontSize: 13)),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: reasonCtrl,
            decoration: const InputDecoration(labelText: 'Reason (optional)'),
          ),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep it')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Reverse',
                  style: TextStyle(color: SColors.danger))),
        ],
      ),
    );
    if (ok != true) return;
    final reason = reasonCtrl.text.trim();
    await _act(
        () => _api
            .reverseLine(b.sk, l.index, reason: reason.isEmpty ? null : reason)
            .then((_) {}),
        'Line reversed');
  }

  /// Add one of the listing's catalog add-ons to this booking from the counter.
  /// A free add-on goes on the bill at $0 (it is a real offer — the guest sees
  /// it and a service add-on still queues fulfilment); a paid one raises the
  /// balance, collected with Take payment.
  Future<void> _addAddon(Booking b) async {
    final listing = b.lines.isNotEmpty ? b.lines.first.listing : '';
    if (listing.isEmpty) {
      _toast('This booking has no listing to load add-ons for.', SColors.danger);
      return;
    }
    List<Map<String, dynamic>> catalog = [];
    setState(() => _busy = true);
    try {
      final wrap = await _api.myListing(listing);
      catalog = ((wrap['addOns'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (mounted) _toast(e.toString().replaceFirst('Exception: ', ''), SColors.danger);
    }
    if (mounted) setState(() => _busy = false);
    if (!mounted) return;
    if (catalog.isEmpty) {
      _toast('No add-ons are attached to this listing yet — set them up under Listings → Add-ons.', SColors.muted);
      return;
    }
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: SColors.paper,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(SSpace.lg),
          children: [
            Text('Add an add-on', style: Theme.of(ctx).textTheme.displayLarge),
            const SizedBox(height: SSpace.xs),
            const Text('Goes on this booking\'s bill. Paid ones are collected with Take payment.',
                style: TextStyle(color: SColors.muted, fontSize: 13)),
            const SizedBox(height: SSpace.md),
            for (final a in catalog)
              Builder(builder: (_) {
                final d = (a['data'] is Map)
                    ? Map<String, dynamic>.from(a['data'])
                    : <String, dynamic>{};
                final price = double.tryParse('${d['price'] ?? 0}') ?? 0;
                final title = (d['title'] ?? d['label'] ?? d['name'] ?? 'Add-on').toString();
                final service = d['service'] == true;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                      [
                        if ((d['description'] ?? '').toString().isNotEmpty) d['description'].toString(),
                        service ? 'Service — queued for you to do' : 'Passive — money only',
                      ].join(' · '),
                      style: const TextStyle(color: SColors.muted, fontSize: 12)),
                  trailing: Text(price > 0 ? money(price) : 'Free',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: price > 0 ? SColors.ink : SColors.green)),
                  onTap: () => Navigator.pop(ctx, {'name': d['name'], 'title': title, 'price': price}),
                );
              }),
          ],
        ),
      ),
    );
    if (picked == null) return;
    final price = (picked['price'] as num).toDouble();
    await _act(
        () => _api.hostCharge(b.sk, {
              'amount': price,
              'category': 'addon',
              'kind': 'addon',
              'code': picked['name'],
              'description': picked['title'],
              'allowZero': true,
            }).then((_) {}),
        price > 0 ? 'Add-on added — ${money(price)} on the bill' : 'Free add-on added');
  }

  Future<void> _togglePayoutHold(Booking b) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SColors.card,
        title: Text(b.paymentHeld ? 'Release the payout?' : 'Hold the payout?'),
        content: Text(b.paymentHeld
            ? 'The booking can settle and pay out to you again.'
            : 'The booking will not settle or pay out until you release it — use this while something is under review.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Back')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(b.paymentHeld ? 'Release' : 'Hold')),
        ],
      ),
    );
    if (ok != true) return;
    await _act(
        () => (b.paymentHeld
                ? _api.hostReleasePayment(b.sk)
                : _api.hostHoldPayment(b.sk))
            .then((_) {}),
        b.paymentHeld ? 'Payout released' : 'Payout held');
  }

  Future<void> _confirmCancel(Booking b) async {
    // Same question as everywhere else — "what does this owe if we cancel?" —
    // answered by the server, shown before the button, executed with the same numbers.
    Map<String, dynamic> d = {};
    try {
      d = await _api.bookingDue(b.sk, action: 'cancel');
    } catch (_) {/* dialog still opens; server will decide on confirm */}
    final fee = (d['feeTotal'] as num?)?.toDouble() ?? 0;
    final refund = (d['refund'] as num?)?.toDouble() ?? 0;
    final due = (d['due'] as num?)?.toDouble() ?? 0;
    final paid = (d['paid'] as num?)?.toDouble() ?? 0;
    final lines = (d['lines'] is List) ? List<Map>.from(d['lines']) : const <Map>[];
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Cancel booking?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (d.isEmpty)
              const Text('Could not reach the server for the amount. It will be worked out on confirm.')
            else ...[
              _row('Paid so far', '\$${paid.toStringAsFixed(2)}'),
              for (final l in lines)
                _row('${l['label']}', '\$${((l['amount'] as num?) ?? 0).toStringAsFixed(2)}',
                    color: SColors.danger),
              if (fee == 0) _row('Cancellation fee', 'none'),
              const Divider(height: 16),
              if (refund > 0)
                _row('Back to the guest', '\$${refund.toStringAsFixed(2)}', bold: true, color: SColors.green),
              if (due > 0)
                _row('Still due from the guest', '\$${due.toStringAsFixed(2)}', bold: true, color: SColors.danger),
              if (refund == 0 && due == 0) _row('Nothing due either way', '', bold: true),
            ],
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep it')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: SColors.danger),
            child: Text(due > 0
                ? 'Cancel · \$${due.toStringAsFixed(2)} due'
                : refund > 0
                    ? 'Cancel · refund \$${refund.toStringAsFixed(2)}'
                    : 'Cancel booking'),
          ),
        ],
      ),
    );
    if (yes != true) return;
    await _act(() => _api.hostCancelBooking(b.sk).then((_) {}),
        (d['message'] ?? 'Booking cancelled').toString());
  }

  // ── small pieces ──────────────────────────────────────────────────────────
  Widget _row(String l, String r,
          {bool bold = false, bool strike = false, Color? color}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(l,
                style: TextStyle(
                    color: bold ? SColors.ink : SColors.muted,
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w500)),
            Text(r,
                style: TextStyle(
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                    fontSize: bold ? 16 : 14,
                    color: color ?? SColors.ink,
                    decoration:
                        strike ? TextDecoration.lineThrough : null)),
          ],
        ),
      );

  Widget _miniBtn(String label, IconData icon, Color c, VoidCallback onTap) =>
      OutlinedButton.icon(
        onPressed: _busy ? null : onTap,
        style: OutlinedButton.styleFrom(
            foregroundColor: c,
            side: BorderSide(color: c.withValues(alpha: 0.4)),
            padding: const EdgeInsets.symmetric(
                horizontal: SSpace.md, vertical: SSpace.sm)),
        icon: Icon(icon, size: 18),
        label: Text(label),
      );

  Widget _handoffRow(Map<String, dynamic> h) {
    final d = h['delegate'] is Map ? Map<String, dynamic>.from(h['delegate']) : {};
    final status = (h['status'] ?? '').toString();
    final items = (h['itemDetails'] as List?)?.whereType<Map>().toList() ?? [];
    final what = items.map((i) => (i['label'] ?? i['identifier'] ?? (i['unit'] != null ? 'Bay ${i['unit']}' : 'item')).toString()).join(', ');
    final color = status == 'completed' ? SColors.green : status == 'active' ? SColors.clay : SColors.muted;
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Row(children: [
        Icon(status == 'completed' ? Icons.handshake_rounded : Icons.person_pin_circle_rounded, size: 18, color: color),
        const SizedBox(width: SSpace.sm),
        Expanded(
          child: Text(
            status == 'completed'
                ? 'Collected by ${h['collectedBy'] ?? d['name'] ?? 'delegate'}${what.isNotEmpty ? ' · $what' : ''}'
                : status == 'active'
                    ? 'Handed to ${d['name'] ?? d['phone'] ?? d['email'] ?? 'someone'} · ${h['verifyLabel'] ?? ''}${what.isNotEmpty ? ' · $what' : ''}'
                    : 'Hand-off to ${d['name'] ?? 'someone'} $status',
            style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
        if (status == 'active') _codeChip('Their code', (h['code'] ?? '').toString()),
      ]),
    );
  }

  Widget _codeChip(String label, String code) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
            color: SColors.ink, borderRadius: BorderRadius.circular(SRadius.md)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text('$label ',
              style: const TextStyle(color: SColors.lime, fontSize: 11)),
          Text(code.split('').join(' '),
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2)),
        ]),
      );

  String _ago(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'just now';
    if (d.inHours < 1) return '${d.inMinutes}m ago';
    if (d.inDays < 1) return '${d.inHours}h ago';
    return '${d.inDays}d ago';
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill(this.status);
  @override
  Widget build(BuildContext context) {
    Color bg = SColors.claySoft, fg = SColors.clay2;
    switch (status) {
      case 'in_custody':
        bg = SColors.green;
        fg = Colors.white;
        break;
      case 'overdue':
      case 'disputed':
        bg = const Color(0xFFF3DAD3);
        fg = SColors.danger;
        break;
      case 'retrieved':
        bg = SColors.greenSoft;
        fg = SColors.green2;
        break;
      case 'settled':
        bg = SColors.line;
        fg = SColors.muted;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(status.replaceAll('_', ' '),
          style:
              TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

class _LineState extends StatelessWidget {
  final String state;
  const _LineState(this.state);
  @override
  Widget build(BuildContext context) {
    final c = {
          'stored': SColors.green,
          'retrieved': SColors.muted,
          'damaged': SColors.danger,
          'lost': SColors.danger,
        }[state] ??
        SColors.clay;
    return Text(state,
        style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12));
  }
}

/// One-tap status ping chip on the host booking dashboard.
class _StatusChip extends StatelessWidget {
  final String label;
  final bool busy;
  final VoidCallback onTap;
  const _StatusChip(
      {required this.label, required this.busy, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: SColors.greenSoft,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: busy ? null : onTap,
        child: Padding(
          padding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          child: Text(label,
              style: const TextStyle(
                  color: SColors.green2,
                  fontWeight: FontWeight.w700,
                  fontSize: 13)),
        ),
      ),
    );
  }
}
