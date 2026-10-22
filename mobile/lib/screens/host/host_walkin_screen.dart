import '../../models/stowbo_host.dart';
import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import 'take_payment_sheet.dart';

/// Take someone standing at the counter. One required detail (phone or plate),
/// everything else defaulted by the server: an OPEN stay, priced from the
/// listing's rate schedule, logged as arrived. Signup never blocks a handover.
class HostWalkinScreen extends StatefulWidget {
  /// Optional prefill — the plate scanner passes what it read (plate + photo)
  /// and, for a returning customer, their known contact, so the operator does
  /// not re-key anything the camera already knows.
  final String? initialPlate;
  final String? initialCustomer;
  final String? platePhotoUrl;
  final String? initialListing;
  const HostWalkinScreen({
    super.key,
    this.initialPlate,
    this.initialCustomer,
    this.platePhotoUrl,
    this.initialListing,
  });
  @override
  State<HostWalkinScreen> createState() => _HostWalkinScreenState();
}

class _HostWalkinScreenState extends State<HostWalkinScreen> {
  final _api = stowboApi;
  final _who = TextEditingController();
  final _coupon = TextEditingController(); // storefront discount code // phone
  final _plate = TextEditingController(); // plate / tag
  final _note = TextEditingController();
  int _qty = 1;
  String? _platePhotoUrl;

  // Per-unit identity when taking in MORE THAN ONE — each thing its own type
  // (sedan/truck/locker…) + registration/plate. Kept in sync with _qty.
  final List<_UnitRow> _unitRows = [];
  String _defaultUnitType() {
    for (final r in _listings) {
      // The dashboard hands over the record id; chips use the code (data.name).
      if (_codeOf(r) != _listing && r['sk']?.toString() != _listing) continue;
      final d = (r['data'] is Map) ? Map<String, dynamic>.from(r['data']) : r;
      return unitTypeForSpace((d['spaceType'] ?? '').toString());
    }
    return 'other';
  }

  void _syncUnitRows() {
    while (_unitRows.length < _qty) {
      _unitRows.add(_UnitRow()..type = _defaultUnitType());
    }
    while (_unitRows.length > _qty) {
      _unitRows.removeLast().dispose();
    }
  }

  // Stay window. Default = an OPEN stay (valet/storage): no end, priced by the
  // meter and charged at pickup. The host can switch to a fixed window and pick
  // a check-out — but we NEVER fabricate a fake +12h end (that mis-books
  // capacity and starts overstay after 12h). Open stay ⇒ endDate is omitted.
  bool _openStay = true;

  // Catalog add-ons attached to the chosen listing (via myListing → resolveAddOns),
  // and which the host ticked. Sent as `addOns` so the server prices them into
  // the booking from the start — free ones at $0, paid ones onto the bill.
  List<Map<String, dynamic>> _addonCatalog = [];
  final Set<String> _addons = {};
  String? _addonsFor; // listing code the catalog was loaded for
  DateTime _start = DateTime.now();
  DateTime? _end;

  List<Map<String, dynamic>> _listings = [];
  String? _listing; // selected listing code (data.name) / sk
  bool _loading = true;
  bool _saving = false;

  // Set once the take-in succeeds → we show a SUMMARY (code to hand over, what's
  // due, take-payment) instead of a toast that throws the booking away.
  Map<String, dynamic>? _result;

  // Live balance after a payment is taken from the summary — the take-in `dueNow`
  // is a snapshot and goes stale the moment money lands, so we re-read it and
  // stop showing "Take payment · $X" on a booking that now owes nothing.
  double? _liveDue;
  String? _livePayState; // paid/partial/… from bookingDue after a collection
  bool get _rPaid => _livePayState == 'paid';
  double get _effDue => _liveDue ?? _rDueNow;

  @override
  void initState() {
    super.initState();
    if (widget.initialPlate != null) _plate.text = widget.initialPlate!;
    if (widget.initialCustomer != null) _who.text = widget.initialCustomer!;
    _platePhotoUrl = widget.platePhotoUrl;
    _load();
  }

  @override
  void dispose() {
    _who.dispose();
    _coupon.dispose();
    _plate.dispose();
    _note.dispose();
    for (final r in _unitRows) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await _api.hostListings();
      if (!mounted) return;
      setState(() {
        _listings = rows;
        // Prefer the listing code the server books against (data.name).
        if (rows.isNotEmpty) {
          final d = (rows.first['data'] is Map)
              ? Map<String, dynamic>.from(rows.first['data'])
              : const {};
          // Honor the listing the scanner already picked (the lane the car is
          // being taken into), else default to the first.
          _listing = widget.initialListing ??
              (d['name'] ?? rows.first['sk']).toString();
        }
        _loadAddons(_listing);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _titleOf(Map<String, dynamic> r) {
    final d = (r['data'] is Map) ? Map<String, dynamic>.from(r['data']) : r;
    return (d['title'] ?? d['name'] ?? 'Space').toString();
  }

  String _codeOf(Map<String, dynamic> r) {
    final d = (r['data'] is Map) ? Map<String, dynamic>.from(r['data']) : r;
    return (d['name'] ?? r['sk']).toString();
  }

  bool get _canSave =>
      _listing != null &&
      // One unit needs a contact or a plate; multiple units carry their own
      // per-unit identity, so the listing is enough.
      (_qty > 1 ||
          _who.text.trim().isNotEmpty ||
          _plate.text.trim().isNotEmpty);

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() => _saving = true);
    try {
      // An OPEN stay omits endDate — the server treats that as "runs until
      // pickup", prices it on the meter, and doesn't oversell a fake window.
      // A fixed window sends the chosen end.
      final res = await _api.hostBook({
        'listing': _listing,
        if (_who.text.trim().isNotEmpty) 'customer': _who.text.trim(),
        if (_coupon.text.trim().isNotEmpty) 'discountCode': _coupon.text.trim(),
        if (_plate.text.trim().isNotEmpty) 'identifier': _plate.text.trim(),
        'quantity': _qty,
        // Add-ons chosen at the counter — priced by the server from the catalog.
        if (_addons.isNotEmpty)
          'addOns': [for (final n in _addons) {'name': n, 'quantity': 1}],
        // Per-unit identity when taking in more than one.
        if (_qty > 1)
          'units': [
            for (final r in _unitRows)
              {
                'type': r.type,
                if (r.reg.text.trim().isNotEmpty)
                  'identifier': r.reg.text.trim(),
              }
          ],
        'startDate': _start.toUtc().toIso8601String(),
        if (!_openStay && _end != null)
          'endDate': _end!.toUtc().toIso8601String(),
        'movementIn': true,
        // The plate photo becomes the intake evidence on the first movement —
        // proof of condition at drop-off, the same way a bag-check photo does.
        if (_platePhotoUrl != null) 'photos': [_platePhotoUrl],
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
      });
      if (!mounted) return;
      // Land on the summary — the operator needs the code to hand over and a way
      // to collect. No toast-and-vanish.
      setState(() {
        _saving = false;
        _result = res;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: SColors.danger));
    }
  }

  // ── the intake summary ─────────────────────────────────────────────────────
  Map<String, dynamic> get _rBooking {
    final b = _result?['booking'];
    return (b is Map) ? Map<String, dynamic>.from(b) : {};
  }

  Map<String, dynamic> get _rBookingData {
    final d = _rBooking['data'];
    return (d is Map) ? Map<String, dynamic>.from(d) : {};
  }

  double get _rDueNow => double.tryParse('${_result?['dueNow'] ?? ''}') ?? 0;
  double get _rTotal => double.tryParse('${_result?['total'] ?? ''}') ?? 0;

  Future<void> _takePaymentOnResult() async {
    final bookingId = (_rBooking['sk'] ?? '').toString();
    if (bookingId.isEmpty) return;
    final due = _effDue;
    final paid = await TakePaymentSheet.show(
      context,
      bookingId: bookingId,
      listingId: _listing,
      presetAmount: due > 0 ? due : (_rTotal > 0 ? _rTotal : null),
      presetCategory: due > 0 ? 'balance' : 'booking',
    );
    // A collection happened → re-read what the booking owes NOW so the summary's
    // "Due now / Take payment" stop showing a figure that's already been paid.
    if (paid == true) await _refreshResultDue(bookingId);
    if (mounted) setState(() {});
  }

  Future<void> _refreshResultDue(String bookingId) async {
    try {
      final res = await _api.bookingDue(bookingId);
      if (!mounted || res.isEmpty) return;
      setState(() {
        _liveDue = double.tryParse('${res['due'] ?? ''}') ?? 0;
        _livePayState = (res['payState'] ?? '').toString();
      });
    } catch (_) {/* keep the snapshot — better stale than blank */}
  }

  Map<String, dynamic> _addonData(Map<String, dynamic> a) =>
      (a['data'] is Map) ? Map<String, dynamic>.from(a['data']) : a;

  /// "Trolley (Free), Insurance ($4.00)" — for the intake summary.
  String _addonSummary() => _addonCatalog
      .where((a) => _addons.contains((_addonData(a)['name'] ?? '').toString()))
      .map((a) {
        final d = _addonData(a);
        final price = double.tryParse('${d['price'] ?? 0}') ?? 0;
        final title = (d['title'] ?? d['label'] ?? d['name'] ?? '').toString();
        return '$title (${price > 0 ? '\$${price.toStringAsFixed(2)}' : 'Free'})';
      })
      .join(', ');

  /// Pull the catalog add-ons attached to a listing. Selections reset when the
  /// listing changes — a different space can offer different extras.
  Future<void> _loadAddons(String? code) async {
    if (code == null || code.isEmpty) return;
    if (_addonsFor == code) return;
    _addonsFor = code;
    try {
      final wrap = await _api.myListing(code);
      if (!mounted || _addonsFor != code) return;
      setState(() {
        _addonCatalog = ((wrap['addOns'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _addons.clear();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _addonCatalog = [];
        _addons.clear();
      });
    }
  }

  Widget _summary() {
    final d = _rBookingData;
    final ref = (d['name'] ?? '').toString();
    final code = (d['pickupCode'] ?? '').toString();
    final match = _listings.firstWhere((r) => _codeOf(r) == _listing,
        orElse: () => <String, dynamic>{});
    final listingTitle = match.isEmpty ? (_listing ?? '') : _titleOf(match);
    final who = _who.text.trim();
    final plate = _plate.text.trim();
    final open = _openStay;
    return ListView(
      padding: const EdgeInsets.all(SSpace.xl),
      children: [
        const SizedBox(height: SSpace.md),
        Center(
          child: Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(
                color: SColors.greenSoft, shape: BoxShape.circle),
            child: const Icon(Icons.login_rounded,
                color: SColors.green, size: 46),
          ),
        ),
        const SizedBox(height: SSpace.md),
        Center(
          child: Text('Taken in',
              style: Theme.of(context).textTheme.displayLarge),
        ),
        if (ref.isNotEmpty)
          Center(
            child: Text('#$ref',
                style: const TextStyle(color: SColors.muted, fontSize: 14)),
          ),
        const SizedBox(height: SSpace.lg),
        // The code to hand the customer — the whole reason to stay on this screen.
        if (code.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(SSpace.lg),
            decoration: BoxDecoration(
                color: SColors.claySoft,
                borderRadius: BorderRadius.circular(SRadius.lg)),
            child: Column(children: [
              const Text('Retrieve code',
                  style: TextStyle(
                      color: SColors.clay,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6)),
              const SizedBox(height: 4),
              Text(code,
                  style: const TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 3,
                      color: SColors.ink)),
              const SizedBox(height: 2),
              const Text('Show this at pickup',
                  style: TextStyle(color: SColors.muted, fontSize: 12)),
            ]),
          ),
        const SizedBox(height: SSpace.lg),
        _sumRow('Space', listingTitle),
        if (who.isNotEmpty) _sumRow('Customer', who),
        if (plate.isNotEmpty) _sumRow('Plate / tag', plate),
        _sumRow('Quantity', '$_qty'),
        if (_addons.isNotEmpty) _sumRow('Add-ons', _addonSummary()),
        _sumRow('Stay', open ? 'Open — charged at pickup' : 'Until ${_fmt(_end!)}'),
        _sumRow(
            _rPaid ? 'Paid' : (_effDue > 0 ? 'Due now' : 'Total'),
            _rPaid
                ? '\$${_rDueNow.toStringAsFixed(2)} ✓'
                : (_effDue > 0
                    ? '\$${_effDue.toStringAsFixed(2)}'
                    : (open ? 'Meter running' : '\$${_rTotal.toStringAsFixed(2)}')),
            strong: true),
        const SizedBox(height: SSpace.xl),
        // Once the booking owes nothing, the CTA becomes a paid confirmation, not
        // another "Take payment · $X" that would re-charge a settled booking.
        if (_rPaid || (_liveDue != null && _liveDue! <= 0.01 && _rDueNow > 0))
          Container(
            padding: const EdgeInsets.symmetric(vertical: SSpace.md),
            decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.lg)),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_rounded, color: SColors.green, size: 20),
                SizedBox(width: SSpace.sm),
                Text('Paid in full',
                    style: TextStyle(
                        color: SColors.green, fontWeight: FontWeight.w700)),
              ],
            ),
          )
        else if (_effDue > 0 || _rTotal > 0)
          ElevatedButton.icon(
            onPressed: _takePaymentOnResult,
            style: ElevatedButton.styleFrom(
                backgroundColor: SColors.clay,
                minimumSize: const Size.fromHeight(54)),
            icon: const Icon(Icons.contactless_rounded, color: Colors.white),
            label: Text(
                _effDue > 0
                    ? 'Take payment · \$${_effDue.toStringAsFixed(2)}'
                    : 'Take payment',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        const SizedBox(height: SSpace.sm),
        OutlinedButton.icon(
          onPressed: () {
            // Take in another — reset the form, keep the listing.
            setState(() {
              _result = null;
              _liveDue = null; // don't carry the last booking's paid state over
              _livePayState = null;
              _who.clear();
              _plate.clear();
              _note.clear();
              _platePhotoUrl = null;
              _qty = 1;
              for (final r in _unitRows) {
                r.dispose();
              }
              _unitRows.clear();
              _start = DateTime.now();
              _end = null;
              _openStay = true;
            });
          },
          icon: const Icon(Icons.add_rounded, size: 18),
          label: const Text('Take in another'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
        ),
        const SizedBox(height: SSpace.sm),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  Widget _sumRow(String k, String v, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: const TextStyle(color: SColors.muted, fontSize: 13)),
            Flexible(
              child: Text(v,
                  textAlign: TextAlign.right,
                  style: TextStyle(
                      fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
                      fontSize: strong ? 16 : 14,
                      color: SColors.ink)),
            ),
          ],
        ),
      );

  String _fmt(DateTime dt) {
    final l = dt.toLocal();
    final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
    final ap = l.hour < 12 ? 'AM' : 'PM';
    final m = l.minute.toString().padLeft(2, '0');
    return '${l.month}/${l.day} $h:$m $ap';
  }

  Future<void> _pickEnd() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _end ?? now.add(const Duration(hours: 2)),
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_end ?? now.add(const Duration(hours: 2))),
    );
    if (!mounted) return;
    setState(() {
      _end = DateTime(date.year, date.month, date.day, time?.hour ?? 17,
          time?.minute ?? 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(_result != null ? 'Taken in' : 'Take someone in')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : _result != null
              ? _summary()
              : _listings.isEmpty
              ? const EmptyState(
                  icon: Icons.storefront_outlined,
                  title: 'No space to take into',
                  subtitle: 'Create a listing first, then walk-ins can come in.',
                )
              : ListView(
                  padding: const EdgeInsets.all(SSpace.xl),
                  children: [
                    if (_listings.length > 1) ...[
                      _label('Which space'),
                      Wrap(
                        spacing: SSpace.sm,
                        runSpacing: SSpace.sm,
                        children: _listings.map((r) {
                          final code = _codeOf(r);
                          final sel = _listing == code || _listing == r['sk']?.toString();
                          return ChoiceChip(
                            label: Text(_titleOf(r)),
                            selected: sel,
                            onSelected: (_) {
                              setState(() {
                                _listing = code;
                                for (final r in _unitRows) {
                                  r.type = _defaultUnitType();
                                }
                              });
                              _loadAddons(code);
                            },
                            selectedColor: SColors.claySoft,
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: SSpace.lg),
                    ],
                    _label('Phone number'),
                    TextField(
                      controller: _who,
                      keyboardType: TextInputType.phone,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                          hintText: 'So they get the retrieve link',
                          prefixIcon: Icon(Icons.phone_outlined)),
                    ),
                    const SizedBox(height: SSpace.sm),
                    TextField(
                      controller: _coupon,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                          hintText: 'Coupon code (optional)',
                          prefixIcon: Icon(Icons.confirmation_number_outlined)),
                    ),
                    const SizedBox(height: SSpace.md),
                    _label('Plate / tag (optional)'),
                    TextField(
                      controller: _plate,
                      textCapitalization: TextCapitalization.characters,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                          hintText: 'Plate, bag tag, box number',
                          prefixIcon: Icon(Icons.tag_rounded)),
                    ),
                    if (_platePhotoUrl != null) ...[
                      const SizedBox(height: SSpace.sm),
                      Row(children: const [
                        Icon(Icons.photo_camera_rounded,
                            size: 16, color: SColors.green),
                        SizedBox(width: 6),
                        Text('Plate photo attached',
                            style: TextStyle(
                                color: SColors.green,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600)),
                      ]),
                    ],
                    const SizedBox(height: SSpace.lg),
                    _label('How many'),
                    Row(children: [
                      _StepBtn(
                          icon: Icons.remove_rounded,
                          onTap: _qty > 1
                              ? () => setState(() {
                                    _qty--;
                                    _syncUnitRows();
                                  })
                              : null),
                      Expanded(
                        child: Center(
                          child: Text('$_qty',
                              style: Theme.of(context).textTheme.headlineMedium),
                        ),
                      ),
                      _StepBtn(
                          icon: Icons.add_rounded,
                          onTap: () => setState(() {
                                _qty++;
                                _syncUnitRows();
                              })),
                    ]),
                    // Per-unit details — each thing its own type + registration —
                    // only when there's more than one. (One unit uses the single
                    // Plate/tag field above.)
                    if (_qty > 1) ...[
                      const SizedBox(height: SSpace.md),
                      _label('Each unit'),
                      ...List.generate(_unitRows.length, (i) {
                        final r = _unitRows[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: SSpace.sm),
                          child: Row(children: [
                            SizedBox(
                              width: 26,
                              child: Text('${i + 1}',
                                  style: const TextStyle(
                                      color: SColors.muted,
                                      fontWeight: FontWeight.w700)),
                            ),
                            SizedBox(
                              width: 120,
                              child: DropdownButtonFormField<String>(
                                initialValue: r.type,
                                isDense: true,
                                // Fill the 120px box and ellipsize — otherwise the widest item
                                // (\"Motorcycle\" + caret) overflows it by ~24px.
                                isExpanded: true,
                                decoration: const InputDecoration(isDense: true),
                                items: _unitTypes.entries
                                    .map((e) => DropdownMenuItem(
                                        value: e.key, child: Text(e.value)))
                                    .toList(),
                                onChanged: (v) =>
                                    setState(() => r.type = v ?? r.type),
                              ),
                            ),
                            const SizedBox(width: SSpace.sm),
                            Expanded(
                              child: TextField(
                                controller: r.reg,
                                textCapitalization:
                                    TextCapitalization.characters,
                                decoration: const InputDecoration(
                                    isDense: true,
                                    hintText: 'Plate / tag / reg'),
                              ),
                            ),
                          ]),
                        );
                      }),
                    ],
                    const SizedBox(height: SSpace.lg),
                    // Extras — the listing's catalog add-ons. Free ones are real
                    // offers (a trolley, a box); paid ones go on the bill now.
                    if (_addonCatalog.isNotEmpty) ...[
                      _label('Extras'),
                      Wrap(
                        spacing: SSpace.sm,
                        runSpacing: SSpace.sm,
                        children: _addonCatalog.map((a) {
                          final d = _addonData(a);
                          final name = (d['name'] ?? '').toString();
                          final price = double.tryParse('${d['price'] ?? 0}') ?? 0;
                          final title = (d['title'] ?? d['label'] ?? name).toString();
                          final on = _addons.contains(name);
                          return FilterChip(
                            label: Text(
                                '$title · ${price > 0 ? '\$${price.toStringAsFixed(2)}' : 'Free'}'),
                            selected: on,
                            selectedColor: SColors.claySoft,
                            checkmarkColor: SColors.clay,
                            onSelected: (v) => setState(() {
                              if (v) {
                                _addons.add(name);
                              } else {
                                _addons.remove(name);
                              }
                            }),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: SSpace.lg),
                    ],
                    // Stay window — open by default, but editable. No fake 12h.
                    _label('Stay'),
                    Row(children: [
                      Expanded(
                        child: _stayChip('Open — pay at pickup', _openStay,
                            () => setState(() => _openStay = true)),
                      ),
                      const SizedBox(width: SSpace.sm),
                      Expanded(
                        child: _stayChip('Set a checkout', !_openStay, () {
                          setState(() {
                            _openStay = false;
                            _end ??= DateTime.now().add(const Duration(hours: 2));
                          });
                        }),
                      ),
                    ]),
                    if (!_openStay) ...[
                      const SizedBox(height: SSpace.sm),
                      InkWell(
                        onTap: _pickEnd,
                        borderRadius: BorderRadius.circular(SRadius.md),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: SSpace.md, vertical: SSpace.md),
                          decoration: BoxDecoration(
                              border:
                                  Border.all(color: SColors.line, width: 1.3),
                              borderRadius: BorderRadius.circular(SRadius.md)),
                          child: Row(children: [
                            const Icon(Icons.event_rounded,
                                size: 18, color: SColors.muted),
                            const SizedBox(width: SSpace.sm),
                            Text(
                                _end == null
                                    ? 'Pick a checkout time'
                                    : 'Until ${_fmt(_end!)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            const Spacer(),
                            const Icon(Icons.edit_rounded,
                                size: 16, color: SColors.faint),
                          ]),
                        ),
                      ),
                    ],
                    const SizedBox(height: SSpace.lg),
                    _label('Note (optional)'),
                    TextField(
                      controller: _note,
                      decoration: const InputDecoration(
                          hintText: 'Condition, where it went, anything'),
                    ),
                    const SizedBox(height: SSpace.xl),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: (_saving || !_canSave) ? null : _save,
                        style: ElevatedButton.styleFrom(
                            backgroundColor: SColors.green),
                        child: _saving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2.4))
                            : const Text('Take in'),
                      ),
                    ),
                    const SizedBox(height: SSpace.sm),
                    Center(
                      child: Text(
                          _openStay
                              ? 'Open stay · priced by your rate schedule at pickup'
                              : 'Fixed window · priced for the booked time',
                          style: const TextStyle(
                              color: SColors.muted, fontSize: 13)),
                    ),
                  ],
                ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t,
            style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: SColors.ink2,
                fontSize: 13)),
      );

  Widget _stayChip(String label, bool on, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: SSpace.md),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? SColors.claySoft : SColors.card,
            borderRadius: BorderRadius.circular(SRadius.md),
            border: Border.all(
                color: on ? SColors.clay : SColors.line, width: 1.3),
          ),
          child: Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 12.5,
                  color: on ? SColors.clay : SColors.ink2)),
        ),
      );
}

/// One unit's identity in a multi-unit intake — its type + registration/plate.
class _UnitRow {
  String type = 'vehicle';
  final reg = TextEditingController();
  void dispose() => reg.dispose();
}

const _unitTypes = <String, String>{
  'vehicle': 'Vehicle',
  'sedan': 'Sedan',
  'suv': 'SUV',
  'truck': 'Truck',
  'lorry': 'Lorry',
  'motorcycle': 'Motorcycle',
  'electric': 'Electric',
  'bike': 'Bike',
  'locker': 'Locker',
  'bag': 'Bag',
  'box': 'Box',
  'other': 'Other',
};

class _StepBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _StepBtn({required this.icon, this.onTap});
  @override
  Widget build(BuildContext context) {
    final on = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: on ? SColors.card : SColors.paper2,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line, width: 1.3),
        ),
        child: Icon(icon, color: on ? SColors.ink : SColors.faint),
      ),
    );
  }
}
