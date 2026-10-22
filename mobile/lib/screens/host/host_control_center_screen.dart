import '../../services/payment_ledger.dart';
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/stowbo_api.dart';
import '../../services/stripe_terminal_service.dart';
import '../../widgets/stowbo_widgets.dart';
import '../../services/support_chat.dart';
import 'booking_dashboard_screen.dart';
import 'host_shell.dart' show hostTabIndex;
import 'host_walkin_screen.dart';
import 'card_reader_screen.dart';
import 'host_today_list_screen.dart';
import 'tag_scan_screen.dart';
import 'handover_sheet.dart';
import 'plate_scan_screen.dart';
import 'checkout_flow.dart';
import 'take_payment_sheet.dart';

/// The host's operating surface: one search that takes any identifier (plate,
/// phone, code, bay, tag) and returns results carrying the exact actions
/// possible right now — plus today's board and a one-tap walk-in intake.
/// Everything is server-driven: the screen renders `host/resolve` /
/// `host/today` verbatim and never decides what's possible itself.
class HostControlCenterScreen extends StatefulWidget {
  const HostControlCenterScreen({super.key});
  @override
  State<HostControlCenterScreen> createState() =>
      _HostControlCenterScreenState();
}

class _HostControlCenterScreenState extends State<HostControlCenterScreen> {
  final _api = stowboApi;
  final _search = TextEditingController();
  Timer? _debounce;

  Map<String, dynamic>? _today;
  bool _loadingToday = true;
  String? _todayError;

  List<Map<String, dynamic>> _results = [];
  bool _searching = false;
  bool _busy = false;

  // Money summary for the home dashboard (best-effort — a home card, not the
  // Money screen; failures just hide the numbers, never block the board).
  Map<String, dynamic>? _wallet;
  List<Map<String, dynamic>> _txns = const [];

  bool get _hasQuery => _search.text.trim().length >= 2;

  @override
  void initState() {
    super.initState();
    _loadToday();
    _loadMoney();
  }

  Future<void> _loadMoney() async {
    try {
      final w = await _api.hostWallet();
      final t = await _api.hostTransactions();
      if (!mounted) return;
      setState(() {
        _wallet = w;
        _txns = t;
      });
    } catch (_) {/* home card just stays quiet if money can't load */}
  }

  double get _collectedToday {
    final today = DateTime.now();
    double sum = 0;
    for (final r in _txns) {
      if (!isCollectedPayment(r)) continue;
      final at = DateTime.tryParse('${r['at'] ?? ''}')?.toLocal();
      if (at == null) continue;
      if (at.year == today.year && at.month == today.month && at.day == today.day) {
        // NET, like the Wallet and Transactions screens: today's refunds
        // come off today's collections (refund rows carry a positive amount).
        final amt = double.tryParse('${r['amount']}') ?? 0;
        sum += (r['kind'] ?? '').toString() == 'refund' ? -amt : amt;
      }
    }
    return sum;
  }

  int get _pendingCount => _txns.where((r) => r['pending'] == true).length;
  double get _pendingAmount => _txns
      .where((r) => r['pending'] == true)
      .fold(0.0, (s, r) => s + (double.tryParse('${r['amount']}') ?? 0));
  double get _walletAvailable =>
      double.tryParse('${_wallet?['available'] ?? 0}') ?? 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadToday() async {
    setState(() {
      _loadingToday = true;
      _todayError = null;
    });
    try {
      _today = await _api.hostToday();
    } catch (e) {
      _todayError = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loadingToday = false);
  }

  void _onSearchChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() {
        _results = [];
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 300), () => _runSearch(q));
  }

  Future<void> _runSearch(String q) async {
    // A 6-digit pickup code, typed or scanned, is a handover — not a search.
    if (_isPickupCode(q)) {
      await _openHandover(q.trim());
      return;
    }
    try {
      final res = await _api.hostResolve(q);
      if (!mounted || _search.text.trim() != q.trim()) return;
      final rows = (res['results'] is List) ? res['results'] as List : const [];
      setState(() {
        _results = rows
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _searching = false;
      });
    } catch (_) {
      if (mounted) setState(() => _searching = false);
    }
  }

  bool _isPickupCode(String q) {
    final t = q.trim();
    return t.startsWith('stowbo:pickup:') || RegExp(r'^\d{6}$').hasMatch(t);
  }

  /// Scan → what the server needs checked → hand over (owner or delegate).
  Future<void> _openHandover(String code) async {
    final done = await showHandoverSheet(context, _api, code);
    if (!mounted) return;
    _search.clear();
    setState(() {});
    if (done) await _loadToday();
  }

  Future<void> _act(Future<void> Function() run, String done) async {
    setState(() => _busy = true);
    try {
      await run();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(done), backgroundColor: SColors.green));
      // Re-run search + today so the buttons reflect the new server state.
      if (_hasQuery) await _runSearch(_search.text);
      await _loadToday();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: SColors.danger));
    }
    if (mounted) setState(() => _busy = false);
  }

  /// Actions are per ITEM. checkin/in/out/checkout act on the item record;
  /// charge/cancel act on the whole order.
  Future<void> _doItemAction(
      String bookingId, String itemId, String action) async {
    switch (action) {
      case 'checkin':
        await _act(() => _api.itemCheckin(itemId).then((_) {}), 'Checked in');
        break;
      case 'in':
        await _act(
            () => _api.itemMovement(itemId, {'direction': 'in'}).then((_) {}),
            'Moved in');
        break;
      case 'out':
        await _act(
            () => _api.itemMovement(itemId, {'direction': 'out'}).then((_) {}),
            'Moved out');
        break;
      // Move-out ≠ check-out. Check-out is the only thing that closes the
      // session and returns the space — and the operator must SEE the cost, so
      // this previews + confirms + reports what was charged (not a bare toast).
      case 'checkout':
        setState(() => _busy = true);
        final done = await runCheckout(context, _api, itemId);
        if (done) {
          if (_hasQuery) await _runSearch(_search.text);
          await _loadToday();
        }
        if (mounted) setState(() => _busy = false);
        break;
      case 'charge':
        await _chargeSheet(bookingId);
        break;
      case 'cancel':
        await _act(
            () =>
                _api.hostCancelBooking(bookingId, reason: 'Host cancelled')
                    .then((_) {}),
            'Cancelled');
        break;
    }
  }

  // ── guest requests waiting on the host (across all bookings) ───────────────
  Widget _requestsSection(List<Map<String, dynamic>> requests) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: SSpace.sm),
        Row(children: [
          const Icon(Icons.pan_tool_alt_rounded, size: 18, color: SColors.clay2),
          const SizedBox(width: 6),
          Text('Requests · ${requests.length}',
              style: const TextStyle(
                  fontWeight: FontWeight.w800, color: SColors.ink)),
        ]),
        const SizedBox(height: SSpace.sm),
        ...requests.map(_requestCard),
        const SizedBox(height: SSpace.lg),
      ],
    );
  }

  Widget _requestCard(Map<String, dynamic> e) {
    final req = (e['request'] as Map?) ?? {};
    final status = (req['status'] ?? 'requested').toString();
    final dir = (req['direction'] ?? 'out').toString();
    final retrieve = dir == 'out';
    final name =
        (e['label'] ?? e['identifier'] ?? e['unit'] ?? 'item').toString();
    final itemId = (e['item'] ?? '').toString();
    final ready = status == 'ready';
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        color: ready ? SColors.greenSoft : SColors.claySoft,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(retrieve ? Icons.pan_tool_alt_rounded : Icons.login_rounded,
                  size: 16, color: SColors.clay2),
              const SizedBox(width: 6),
              Expanded(
                  child: Text(
                      retrieve ? 'Wants "$name" out' : 'Returning "$name"',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, color: SColors.ink))),
              Text(status.toUpperCase(),
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: SColors.ink2)),
            ]),
            if ((req['note'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(height: 2),
              Text('“${req['note']}”',
                  style: const TextStyle(
                      color: SColors.muted, fontStyle: FontStyle.italic)),
            ],
            const SizedBox(height: SSpace.sm),
            SizedBox(
              width: double.infinity,
              child: ready
                  ? ElevatedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _act(
                              () => _api
                                  .itemMovement(itemId, {'direction': dir}).then((_) {}),
                              retrieve ? 'Handed out ✓' : 'Received ✓'),
                      icon: const Icon(Icons.done_all_rounded, size: 18),
                      label: Text(retrieve ? 'Hand out ✓' : 'Receive back ✓'))
                  : ElevatedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _act(
                              () => _api
                                  .hostUpdateRequest(itemId, 'ready').then((_) {}),
                              'Guest notified — marked ready'),
                      icon: const Icon(Icons.check_rounded, size: 18),
                      label: const Text('Mark ready')),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _chargeSheet(String bookingId) async {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    String? err;
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
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Charge more', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: SSpace.md),
            TextField(
              controller: amountCtrl,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                  labelText: 'Amount', prefixText: '\$ '),
            ),
            const SizedBox(height: SSpace.sm),
            TextField(
              controller: noteCtrl,
              decoration: const InputDecoration(labelText: 'Reason (optional)'),
            ),
            if (err != null) ...[
              const SizedBox(height: SSpace.sm),
              Text(err!,
                  style: const TextStyle(color: SColors.danger, fontSize: 13)),
            ],
            const SizedBox(height: SSpace.lg),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                  onPressed: () {
                    final amt = double.tryParse(amountCtrl.text.trim()) ?? 0;
                    if (amt <= 0) {
                      setS(() => err = 'Enter an amount greater than 0.');
                      return;
                    }
                    Navigator.pop(ctx, true);
                  },
                  child: const Text('Charge')),
            ),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) return;
    setState(() => _busy = true);
    try {
      await _api.hostCharge(bookingId, {
        'amount': amount,
        if (noteCtrl.text.trim().isNotEmpty)
          'description': noteCtrl.text.trim(),
      });
      if (!mounted) return;
      // The charge is on the bill — now COLLECT it. Previously this dead-ended
      // (money owed, no way to take it from here).
      await TakePaymentSheet.show(context,
          bookingId: bookingId, presetAmount: amount, presetCategory: 'balance');
      if (_hasQuery) await _runSearch(_search.text);
      await _loadToday();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: SColors.danger));
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _walkIn() async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const HostWalkinScreen()),
    );
    if (saved == true && mounted) await _loadToday();
  }

  /// Scan a QR/barcode tag → drop the decoded code into the search box and let
  /// the existing resolve flow render its action cards. The camera is just a
  /// faster keyboard for the same search.
  Future<void> _scanTag() async {
    final code = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const TagScanScreen()),
    );
    if (code == null || code.trim().isEmpty || !mounted) return;
    if (_isPickupCode(code)) {
      await _openHandover(code.trim());
      return;
    }
    _search.text = code.trim();
    setState(() {});
    _runSearch(code.trim());
  }

  /// Scan a plate → the plate screen reads it on-device, looks it up, and does
  /// the whole valet branch (pickup / returning / new) itself.
  Future<void> _scanPlate() async {
    final done = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const PlateScanScreen()),
    );
    if (done == true && mounted) await _loadToday();
  }

  void _scanMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: SSpace.sm),
          // Plate OCR runs on-device (ML Kit) — a phone-only feature.
          if (!kIsWeb)
            ListTile(
              leading:
                  const Icon(Icons.directions_car_rounded, color: SColors.clay),
              title: const Text('Scan a plate'),
              subtitle: const Text('Valet — read, look up, take in or pick up'),
              onTap: () {
                Navigator.pop(ctx);
                _scanPlate();
              },
            ),
          ListTile(
            leading: const Icon(Icons.qr_code_scanner_rounded, color: SColors.green),
            title: const Text('Scan a tag'),
            subtitle: const Text('QR or barcode — ticket, locker, bay label'),
            onTap: () {
              Navigator.pop(ctx);
              _scanTag();
            },
          ),
          const SizedBox(height: SSpace.sm),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final first = context.watch<AuthProvider>().user?.firstName;
    return Scaffold(
      body: SafeArea(
        bottom: false, // the host shell owns the bottom nav
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.xl, SSpace.lg, SSpace.xl, SSpace.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                            (first == null || first.isEmpty)
                                ? 'Home'
                                : 'Hi, $first',
                            style: Theme.of(context).textTheme.displayLarge),
                      ),
                      // Card-reader status — ICON only (no label, no cramp):
                      // green when paired, muted when not. Tap → pairing.
                      // Talk to Stowbo — the admin answers in this thread.
                      IconButton(
                        tooltip: 'Chat with Stowbo',
                        onPressed: () => openSupportChat(context),
                        icon: const Icon(Icons.support_agent_rounded,
                            color: SColors.ink2),
                      ),
                      const _ReaderStatusIcon(),
                    ],
                  ),
                  const SizedBox(height: SSpace.md),
                  _searchBar(),
                ],
              ),
            ),
            Expanded(
              child: _hasQuery ? _searchResults() : _dashboard(),
            ),
          ],
        ),
      ),
    );
  }


  // Money & Listings are TABS — switch to them (keeps the bottom nav, so Home
  // is one tap back), never push a dead-end route. Reader is a real pushed
  // screen (it has its own AppBar back button).
  void _goMoney() => hostTabIndex.value = 2;
  void _goListings() => hostTabIndex.value = 4;
  void _goReader() => Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CardReaderScreen()));

  Widget _searchBar() {
    return Container(
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.pill),
        border: Border.all(color: SColors.line, width: 1.2),
        boxShadow: SShadow.soft,
      ),
      padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
      child: Row(children: [
        const Icon(Icons.search_rounded, color: SColors.muted, size: 22),
        const SizedBox(width: SSpace.sm),
        Expanded(
          child: TextField(
            controller: _search,
            onChanged: _onSearchChanged,
            textInputAction: TextInputAction.search,
            cursorColor: SColors.clay,
            decoration: const InputDecoration(
              hintText: 'Plate, phone, code, bay, tag…',
              isDense: true,
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 15),
            ),
          ),
        ),
        if (_search.text.isNotEmpty)
          GestureDetector(
            onTap: () {
              _search.clear();
              _onSearchChanged('');
              setState(() {});
            },
            child: const Icon(Icons.close_rounded,
                color: SColors.muted, size: 20),
          )
        else
          GestureDetector(
            onTap: _scanMenu,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.only(left: SSpace.xs),
              child: Icon(Icons.qr_code_scanner_rounded,
                  color: SColors.clay, size: 22),
            ),
          ),
      ]),
    );
  }

  // ── search results (action cards) ─────────────────────────────────────────
  Widget _searchResults() {
    if (_searching && _results.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: SColors.clay));
    }
    if (_results.isEmpty) {
      return const EmptyState(
        icon: Icons.search_off_rounded,
        title: 'Nothing matches',
        subtitle: 'Try a plate, phone, code, bay or tag.',
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.sm, SSpace.xl, 96),
      children: _results.map(_resultCard).toList(),
    );
  }

  Widget _resultCard(Map<String, dynamic> r) {
    final bookingId = r['booking'].toString();
    final customer = (r['customer'] ?? '').toString();
    final ref = (r['reference'] ?? '').toString();
    final items = (r['items'] is List)
        ? (r['items'] as List).whereType<Map>().toList()
        : const [];

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: SCard(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => BookingDashboardScreen(bookingId: bookingId)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(customer.isEmpty ? 'Walk-in' : customer,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 16)),
              ),
              Text('#$ref',
                  style: const TextStyle(color: SColors.muted, fontSize: 13)),
            ]),
            // Each ITEM: its identity, its state, and its own action buttons —
            // the server's actions[] for THIS item, nothing re-derived.
            ...items.map((it) => _itemBlock(bookingId, it)),
          ],
        ),
      ),
    );
  }

  Widget _itemBlock(String bookingId, Map it) {
    final id = (it['id'] ?? '').toString();
    final label =
        (it['identifier'] ?? it['unit'] ?? it['listing'] ?? 'Item').toString();
    final present = it['present'] == true;
    final overstaying = it['overstaying'] == true;
    final actions = (it['actions'] is List)
        ? (it['actions'] as List).map((e) => e.toString()).toList()
        : <String>[];
    return Padding(
      padding: const EdgeInsets.only(top: SSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(present ? Icons.check_circle_rounded : Icons.logout_rounded,
                size: 16, color: present ? SColors.green : SColors.faint),
            const SizedBox(width: 6),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14.5)),
            ),
            if (overstaying)
              _tag('Overstaying', SColors.danger,
                  SColors.danger.withValues(alpha: 0.12))
            else if (present)
              _tag('Here', SColors.green, SColors.greenSoft),
          ]),
          const SizedBox(height: SSpace.sm),
          Wrap(
            spacing: SSpace.sm,
            runSpacing: SSpace.sm,
            children: [
              ...actions.map((a) => _actionBtn(bookingId, id, a)),
              _bayBtn(id, (it['listing'] ?? '').toString(),
                  it['unit']?.toString()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _bayBtn(String itemId, String listing, String? unit) {
    final has = unit != null && unit.isNotEmpty;
    return OutlinedButton.icon(
      onPressed: _busy ? null : () => _assignBaySheet(itemId, listing, unit),
      icon: Icon(Icons.grid_view_rounded,
          size: 15, color: has ? SColors.green : SColors.ink2),
      label: Text(has ? 'Bay $unit' : 'Assign bay',
          style: TextStyle(
              color: has ? SColors.green : SColors.ink2,
              fontWeight: FontWeight.w600,
              fontSize: 13)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: has ? SColors.green : SColors.line),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Future<void> _assignBaySheet(
      String itemId, String listing, String? current) async {
    List<Map<String, dynamic>> units = const [];
    try {
      units = await _api.hostUnits(listing: listing);
    } catch (_) {}
    if (!mounted) return;
    final newCtrl = TextEditingController();

    Future<void> pick(String name, {bool create = false}) async {
      Navigator.pop(context);
      await _act(() async {
        if (create) {
          await _api.createUnit({'listing': listing, 'name': name});
        }
        await _api.itemAssign(itemId, {'unit': name});
      }, 'Assigned to bay $name');
    }

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(SSpace.lg, SSpace.lg, SSpace.lg,
            SSpace.lg + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Assign a bay',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: SColors.ink)),
            const SizedBox(height: 4),
            Text(units.isEmpty
                ? 'No bays here yet — add one below.'
                : 'Tap a bay, or add a new one.',
                style: const TextStyle(color: SColors.muted, fontSize: 13)),
            if (units.isNotEmpty) ...[
              const SizedBox(height: SSpace.md),
              Wrap(
                spacing: SSpace.sm,
                runSpacing: SSpace.sm,
                children: units.map((u) {
                  final d = (u['data'] as Map?) ?? u;
                  final name = (d['name'] ?? '').toString();
                  final occupied = (d['status'] ?? '') == 'occupied';
                  final isCurrent = name == current;
                  return ChoiceChip(
                    label: Text(occupied && !isCurrent ? '$name · busy' : name),
                    selected: isCurrent,
                    showCheckmark: false,
                    selectedColor: SColors.green,
                    labelStyle: TextStyle(
                        color: isCurrent ? Colors.white : SColors.ink2,
                        fontWeight: FontWeight.w600),
                    backgroundColor: SColors.paper2,
                    onSelected: (_) => pick(name),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: SSpace.md),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: newCtrl,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'New bay (e.g. A-14)',
                    filled: true,
                    fillColor: SColors.paper2,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SRadius.md),
                        borderSide: BorderSide.none),
                  ),
                ),
              ),
              const SizedBox(width: SSpace.sm),
              ElevatedButton(
                onPressed: () {
                  final n = newCtrl.text.trim();
                  if (n.isNotEmpty) pick(n, create: true);
                },
                child: const Text('Add'),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _actionBtn(String bookingId, String itemId, String action) {
    const labels = {
      'checkin': 'Check in',
      'in': 'Move in',
      'out': 'Move out',
      'checkout': 'Check out',
      'charge': 'Charge',
      'cancel': 'Cancel',
    };
    final green = action == 'in' || action == 'checkin';
    final clay = action == 'out';
    final primary = green || clay;
    final danger = action == 'cancel';
    return ElevatedButton(
      onPressed: _busy ? null : () => _doItemAction(bookingId, itemId, action),
      style: ElevatedButton.styleFrom(
        backgroundColor: danger
            ? SColors.card
            : primary
                ? (green ? SColors.green : SColors.clay)
                : SColors.paper2,
        foregroundColor: danger
            ? SColors.danger
            : primary
                ? Colors.white
                : SColors.ink,
        elevation: 0,
        side: danger ? BorderSide(color: SColors.danger) : BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      ),
      child: Text(labels[action] ?? action,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
    );
  }

  // ── home dashboard — a platform summary, not a booking board ──────────────
  // A glance across every domain a host operates: what needs attention, the
  // live custody pulse, money, spaces, and devices — each a card that taps
  // through to its full section. Different hosts scan to what they care about.
  Widget _dashboard() {
    if (_loadingToday && _today == null) {
      return const Center(child: CircularProgressIndicator(color: SColors.clay));
    }
    List<Map<String, dynamic>> pick(String k) => (_today?[k] is List)
        ? (_today![k] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList()
        : <Map<String, dynamic>>[];
    final requests = pick('requests');
    final bookingRequests = pick('bookingRequests');
    final overdue = pick('overdue');
    final departures = pick('departures');
    final inCustody = pick('inCustody');
    final arrivals = pick('arrivals');
    final capacity = pick('capacity');

    return RefreshIndicator(
      color: SColors.clay,
      onRefresh: () async {
        await _loadToday();
        await _loadMoney();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(SSpace.lg, SSpace.md, SSpace.lg, 110),
        children: [
          if (_today == null && _todayError != null)
            _errorCard(_todayError!, _loadToday),
          // REQUESTS — kept at home (host's call).
          if (requests.isNotEmpty) _requestsSection(requests),
          for (final entry in bookingRequests)
            Padding(
              padding: const EdgeInsets.only(bottom: SSpace.sm),
              child: SCard(child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.pan_tool_alt_rounded, color: SColors.clay),
                title: Text(((entry['request'] as Map?)?['label'] ?? 'Guest request').toString()),
                subtitle: Text('#${entry['reference'] ?? ''}'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () async {
                  await Navigator.push(context, MaterialPageRoute(builder: (_) => BookingDashboardScreen(bookingId: entry['booking'].toString())));
                  if (mounted) _loadToday();
                },
              )),
            ),
          // NEEDS ATTENTION — only the rows that actually exist.
          _needsAttention(overdue),
          // PULSE — live custody numbers, glance-only.
          _pulseStrip(
            inCustody: inCustody,
            arrivals: arrivals,
            departures: departures,
            overdue: overdue,
            capacity: capacity,
          ),
          const SizedBox(height: SSpace.md),
          _moneyCard(),
          const SizedBox(height: SSpace.md),
          _spacesCard(capacity),
          const SizedBox(height: SSpace.md),
          _devicesCard(),
        ],
      ),
    );
  }

  Widget _errorCard(String msg, VoidCallback retry) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.md),
        child: SCard(
          color: SColors.danger.withValues(alpha: 0.06),
          child: Row(children: [
            const Icon(Icons.wifi_off_rounded, color: SColors.danger, size: 18),
            const SizedBox(width: SSpace.sm),
            Expanded(
                child: Text(msg,
                    style: const TextStyle(color: SColors.danger, fontSize: 13))),
            TextButton(onPressed: retry, child: const Text('Retry')),
          ]),
        ),
      );

  // NEEDS ATTENTION — actionable rows; renders nothing when all is clear.
  Widget _needsAttention(List<Map<String, dynamic>> overdue) {
    final rows = <Widget>[];
    if (overdue.isNotEmpty) {
      rows.add(_attnRow(Icons.error_outline_rounded, SColors.danger,
          '${overdue.length} overdue ${overdue.length == 1 ? 'pickup' : 'pickups'}',
          () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => HostTodayListScreen(
                  title: 'Overdue', items: overdue, accent: SColors.danger)))));
    }
    if (_pendingCount > 0) {
      rows.add(_attnRow(Icons.link_rounded, SColors.clay,
          '$_pendingCount payment ${_pendingCount == 1 ? 'link' : 'links'} waiting',
          _goMoney));
    }
    if (_walletAvailable > 0) {
      rows.add(_attnRow(Icons.account_balance_rounded, SColors.green,
          '\$${_walletAvailable.toStringAsFixed(2)} ready to pay out', _goMoney));
    }
    if (rows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: SCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Needs attention',
                style: TextStyle(fontWeight: FontWeight.w800, color: SColors.ink)),
            const SizedBox(height: SSpace.sm),
            ...rows,
          ],
        ),
      ),
    );
  }

  Widget _attnRow(IconData icon, Color color, String label, VoidCallback? onTap) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: SSpace.sm),
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: SColors.ink, fontWeight: FontWeight.w600))),
          if (onTap != null)
            const Icon(Icons.chevron_right_rounded, color: SColors.faint),
        ]),
      ),
    );
  }

  // PULSE — the live custody numbers, compact and horizontal.
  // Every number drills in: tap it → the actual list behind it. Not static.
  Widget _pulseStrip({
    required List<Map<String, dynamic>> inCustody,
    required List<Map<String, dynamic>> arrivals,
    required List<Map<String, dynamic>> departures,
    required List<Map<String, dynamic>> overdue,
    required List<Map<String, dynamic>> capacity,
  }) {
    final free = capacity.fold<int>(
        0, (s, c) => s + ((c['available'] as num?)?.toInt() ?? 0));
    void openList(String title, List<Map<String, dynamic>> items, Color c) =>
        Navigator.of(context).push(MaterialPageRoute(
            builder: (_) =>
                HostTodayListScreen(title: title, items: items, accent: c)));
    final chips = <Widget>[
      _pulseChip('In custody', inCustody.length, SColors.ink2,
          () => openList('In custody', inCustody, SColors.ink2)),
      _pulseChip('Arrivals', arrivals.length, SColors.green,
          () => openList('Arriving', arrivals, SColors.green)),
      _pulseChip('Leaving', departures.length, SColors.clay,
          () => openList('Leaving today', departures, SColors.clay)),
      _pulseChip('Overdue', overdue.length,
          overdue.isNotEmpty ? SColors.danger : SColors.ink2,
          () => openList('Overdue', overdue, SColors.danger)),
      if (capacity.isNotEmpty)
        _pulseChip('Free', free, SColors.green, _goListings),
    ];
    return SizedBox(
      height: 66,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: SSpace.sm),
        itemBuilder: (_, i) => chips[i],
      ),
    );
  }

  Widget _pulseChip(String label, int value, Color color, VoidCallback onTap) {
    return Material(
      color: SColors.card,
      borderRadius: BorderRadius.circular(SRadius.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SRadius.md),
        child: Container(
          width: 100,
          padding: const EdgeInsets.symmetric(
              horizontal: SSpace.md, vertical: SSpace.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(SRadius.md),
            border: Border.all(color: SColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('$value',
                  style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800, color: color)),
              Row(children: [
                Flexible(
                  child: Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 11)),
                ),
                const Icon(Icons.chevron_right_rounded,
                    size: 13, color: SColors.faint),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  // MONEY — collected today, pending, wallet available. → Money hub.
  Widget _moneyCard() {
    return _sectionCard(
      icon: Icons.payments_rounded,
      title: 'Money',
      onTap: _goMoney,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _wallet == null
                ? 'Tap to open your wallet, payouts and transactions.'
                : 'Collected today \$${_collectedToday.toStringAsFixed(2)}'
                    ' · Pending \$${_pendingAmount.toStringAsFixed(2)}',
            style: const TextStyle(color: SColors.ink2, fontSize: 13),
          ),
          if (_wallet != null) ...[
            const SizedBox(height: 2),
            Text('Wallet \$${_walletAvailable.toStringAsFixed(2)} available',
                style: const TextStyle(
                    color: SColors.green, fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  // SPACES — listings + occupancy. → Listings.
  Widget _spacesCard(List<Map<String, dynamic>> capacity) {
    final total = capacity.fold<int>(
        0, (s, c) => s + (((c['capacity'] ?? c['total']) as num?)?.toInt() ?? 0));
    final free = capacity.fold<int>(
        0, (s, c) => s + ((c['available'] as num?)?.toInt() ?? 0));
    final occupied = (total - free).clamp(0, total);
    return _sectionCard(
      icon: Icons.grid_view_rounded,
      title: 'Spaces',
      onTap: _goListings,
      child: capacity.isEmpty
          ? const Text('Add a listing to start taking items in.',
              style: TextStyle(color: SColors.ink2, fontSize: 13))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    '${capacity.length} ${capacity.length == 1 ? 'listing' : 'listings'}'
                    '${total > 0 ? ' · $occupied / $total occupied' : ''}',
                    style: const TextStyle(color: SColors.ink2, fontSize: 13)),
                if (total > 0) ...[
                  const SizedBox(height: SSpace.sm),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(SRadius.pill),
                    child: LinearProgressIndicator(
                      value: total == 0 ? 0 : occupied / total,
                      minHeight: 8,
                      backgroundColor: SColors.line,
                      valueColor: const AlwaysStoppedAnimation(SColors.clay),
                    ),
                  ),
                ],
                const SizedBox(height: SSpace.md),
                // Intake lives with Spaces. Compact action button in a Wrap so
                // more space actions can join it later.
                Wrap(
                  spacing: SSpace.sm,
                  runSpacing: SSpace.sm,
                  children: [
                    SActionButton(
                      icon: Icons.person_add_alt_1_rounded,
                      label: 'Take someone in',
                      onTap: _busy ? null : _walkIn,
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  // DEVICES — card reader status. → pairing.
  Widget _devicesCard() {
    return ValueListenableBuilder<int>(
      valueListenable: stripeTerminalService.connectionRevision,
      builder: (context, _, __) {
        final on = stripeTerminalService.isConnected;
        return _sectionCard(
          icon: Icons.devices_other_rounded,
          title: 'Devices',
          onTap: _goReader,
          child: Row(children: [
            Icon(on ? Icons.contactless_rounded : Icons.contactless_outlined,
                size: 18, color: on ? SColors.green : SColors.muted),
            const SizedBox(width: SSpace.sm),
            Text(
                on
                    ? 'Card reader connected'
                    : 'Card reader not paired — tap to pair',
                style: TextStyle(
                    color: on ? SColors.green : SColors.ink2,
                    fontWeight: on ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 13)),
          ]),
        );
      },
    );
  }

  Widget _sectionCard({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    required Widget child,
  }) {
    return SCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18, color: SColors.clay),
            const SizedBox(width: SSpace.sm),
            Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, color: SColors.ink))),
            const Icon(Icons.chevron_right_rounded, color: SColors.faint),
          ]),
          const SizedBox(height: SSpace.sm),
          child,
        ],
      ),
    );
  }

  Widget _tag(String text, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(SRadius.pill)),
        child: Text(text,
            style: TextStyle(
                color: fg, fontWeight: FontWeight.w700, fontSize: 11.5)),
      );
}

/// Compact top-bar card-reader status — ICON only, no label, so it never
/// crowds the header. Green + filled when a reader is paired, muted outline
/// when not. Reacts live to connect/disconnect and taps through to pairing.
class _ReaderStatusIcon extends StatelessWidget {
  const _ReaderStatusIcon();
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: stripeTerminalService.connectionRevision,
      builder: (context, _, __) {
        final on = stripeTerminalService.isConnected;
        return IconButton(
          tooltip: on ? 'Card reader — connected' : 'Pair a card reader',
          visualDensity: VisualDensity.compact,
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CardReaderScreen()),
          ),
          icon: Icon(
            on ? Icons.contactless_rounded : Icons.contactless_outlined,
            color: on ? SColors.green : SColors.muted,
          ),
        );
      },
    );
  }
}
