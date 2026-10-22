import '../../models/stowbo_host.dart';
import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import 'take_payment_sheet.dart';

/// Reserve a FUTURE window for a customer — the flow that didn't exist (BKG-1/2).
/// Pick a space → a date range → how many (each unit its own type + registration)
/// → check live availability + price → reserve → collect now or send a link.
class HostReserveScreen extends StatefulWidget {
  final String? initialListing;
  const HostReserveScreen({super.key, this.initialListing});
  @override
  State<HostReserveScreen> createState() => _HostReserveScreenState();
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

class _URow {
  String type = 'vehicle';
  final reg = TextEditingController();
  void dispose() => reg.dispose();
}

class _HostReserveScreenState extends State<HostReserveScreen> {
  final _api = StowboApi();
  final _who = TextEditingController(); // phone
  final _coupon = TextEditingController(); // storefront discount code
  final _email = TextEditingController();

  List<Map<String, dynamic>> _listings = [];
  String? _listing;
  bool _loading = true;

  late DateTime _start;
  late DateTime _end;
  int _qty = 1;

  // Catalog add-ons attached to the chosen listing, and which the host ticked.
  // Sent as `addOns` so the server prices them into the reservation from the
  // start — free ones at $0, paid ones onto the bill.
  List<Map<String, dynamic>> _addonCatalog = [];
  final Set<String> _addons = {};
  String? _addonsFor;
  final List<_URow> _unitRows = [];

  Map<String, dynamic>? _avail; // availability + quote for the current window
  bool _checking = false;
  String? _availError;

  bool _saving = false;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _start = DateTime(now.year, now.month, now.day + 1, 9); // tomorrow 9am
    _end = _start.add(const Duration(hours: 3));
    _listing = widget.initialListing;
    _load();
  }

  @override
  void dispose() {
    _who.dispose();
    _coupon.dispose();
    _email.dispose();
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
        if (_listing == null && rows.isNotEmpty) {
          final d = (rows.first['data'] is Map)
              ? Map<String, dynamic>.from(rows.first['data'])
              : const {};
          _listing = (d['name'] ?? rows.first['sk']).toString();
        }
        _loading = false;
      });
      _loadAddons(_listing);
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
      _unitRows.add(_URow()..type = _defaultUnitType());
    }
    while (_unitRows.length > _qty) {
      _unitRows.removeLast().dispose();
    }
  }

  // Any change to space/dates/qty invalidates a prior availability check.
  void _invalidate() => setState(() {
        _avail = null;
        _availError = null;
      });

  double get _quoteTotal {
    final q = _avail?['quote'];
    if (q is Map) {
      return double.tryParse('${q['total'] ?? q['amount'] ?? ''}') ?? 0;
    }
    return 0;
  }

  int get _free => (_avail?['available'] as num?)?.toInt() ?? 0;

  double get _quoteDiscount {
    final q = _avail?['quote'];
    return (q is Map) ? (double.tryParse('${q['discount'] ?? ''}') ?? 0) : 0;
  }

  String get _quoteDiscountLabel {
    final q = _avail?['quote'];
    final d = (q is Map && q['discounts'] is List && (q['discounts'] as List).isNotEmpty)
        ? (q['discounts'] as List).first
        : null;
    return (d is Map ? (d['code'] ?? d['name'] ?? '') : '').toString();
  }

  String? get _quoteRejected {
    final q = _avail?['quote'];
    final r = (q is Map) ? q['discountRejected'] : null;
    return (r is Map) ? (r['message'] ?? 'not valid').toString() : null;
  }
  bool get _sufficient => _avail?['sufficient'] == true;

  Future<void> _checkAvailability() async {
    if (_listing == null) return;
    if (!_end.isAfter(_start)) {
      setState(() => _availError = 'Check-out must be after check-in.');
      return;
    }
    setState(() {
      _checking = true;
      _availError = null;
      _avail = null;
    });
    try {
      final res = await _api.availability(
        _listing!,
        startDate: _start.toUtc().toIso8601String(),
        endDate: _end.toUtc().toIso8601String(),
        quantity: _qty,
        discountCode: _coupon.text.trim(),
        customer: _who.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _avail = res;
        _checking = false;
        if (res['sufficient'] != true) {
          _availError =
              'Only ${(res['available'] as num?)?.toInt() ?? 0} free for that window — reduce the quantity or change dates.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _checking = false;
        _availError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _reserve() async {
    if (_listing == null || !_sufficient) return;
    setState(() => _saving = true);
    try {
      final res = await _api.hostBook({
        'listing': _listing,
        'reserve': true,
        'quantity': _qty,
        // Add-ons chosen up front — priced by the server from the catalog.
        if (_addons.isNotEmpty)
          'addOns': [for (final n in _addons) {'name': n, 'quantity': 1}],
        if (_qty > 1)
          'units': [
            for (final r in _unitRows)
              {
                'type': r.type,
                if (r.reg.text.trim().isNotEmpty) 'identifier': r.reg.text.trim(),
              }
          ],
        'startDate': _start.toUtc().toIso8601String(),
        'endDate': _end.toUtc().toIso8601String(),
        if (_who.text.trim().isNotEmpty) 'customer': _who.text.trim(),
        if (_coupon.text.trim().isNotEmpty) 'discountCode': _coupon.text.trim(),
      });
      if (!mounted) return;
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

  // ── result summary ─────────────────────────────────────────────────────────
  Map<String, dynamic> get _rBooking {
    final b = _result?['booking'];
    return (b is Map) ? Map<String, dynamic>.from(b) : {};
  }

  double get _rDueNow => double.tryParse('${_result?['dueNow'] ?? ''}') ?? 0;
  double get _rTotal =>
      double.tryParse('${_result?['total'] ?? ''}') ?? _quoteTotal;

  // Live balance after money lands — `dueNow` in the reserve result is a
  // snapshot; once a collection succeeds we re-read what's owed so the summary
  // doesn't keep offering "Take payment · $X" on a booking that's paid.
  double? _liveDue;
  String? _livePayState;
  bool get _rPaid => _livePayState == 'paid';
  double get _effDue => _liveDue ?? _rDueNow;

  Future<void> _takePaymentOnResult() async {
    final id = (_rBooking['sk'] ?? '').toString();
    if (id.isEmpty) return;
    final due = _effDue;
    final paid = await TakePaymentSheet.show(
      context,
      bookingId: id,
      listingId: _listing,
      presetAmount: due > 0 ? due : (_rTotal > 0 ? _rTotal : null),
      presetCategory: 'booking',
    );
    if (paid == true) await _refreshResultDue(id);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_result != null ? 'Reserved' : 'Reserve a space')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : _result != null
              ? _summary()
              : _listings.isEmpty
                  ? const EmptyState(
                      icon: Icons.storefront_outlined,
                      title: 'No space to reserve',
                      subtitle: 'Create a listing first.')
                  : _form(),
    );
  }

  Map<String, dynamic> _addonData(Map<String, dynamic> a) =>
      (a['data'] is Map) ? Map<String, dynamic>.from(a['data']) : a;

  /// "Trolley (Free), Insurance ($4.00)" — for the quote line and the summary.
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

  Widget _form() {
    final rd = _rangeLabel();
    return ListView(
      padding: const EdgeInsets.all(SSpace.xl),
      children: [
        _label('Which space'),
        Wrap(
          spacing: SSpace.sm,
          runSpacing: SSpace.sm,
          children: _listings.map((r) {
            final code = _codeOf(r);
            return ChoiceChip(
              label: Text(_titleOf(r)),
              selected: _listing == code || _listing == r['sk']?.toString(),
              selectedColor: SColors.claySoft,
              onSelected: (_) {
                setState(() {
                  _listing = code;
                  // A different kind of space → different kind of unit.
                  for (final r in _unitRows) r.type = _defaultUnitType();
                });
                _invalidate();
                _loadAddons(code);
              },
            );
          }).toList(),
        ),
        const SizedBox(height: SSpace.lg),
        _label('When'),
        Row(children: [
          Expanded(child: _dateField('Check-in', _start, (d) {
            setState(() {
              _start = d;
              if (!_end.isAfter(_start)) {
                _end = _start.add(const Duration(hours: 3));
              }
            });
            _invalidate();
          })),
          const SizedBox(width: SSpace.sm),
          Expanded(child: _dateField('Check-out', _end, (d) {
            setState(() => _end = d);
            _invalidate();
          })),
        ]),
        const SizedBox(height: SSpace.lg),
        _label('How many'),
        Row(children: [
          _StepBtn(
              icon: Icons.remove_rounded,
              onTap: _qty > 1
                  ? () {
                      setState(() {
                        _qty--;
                        _syncUnitRows();
                      });
                      _invalidate();
                    }
                  : null),
          Expanded(
              child: Center(
                  child: Text('$_qty',
                      style: Theme.of(context).textTheme.headlineMedium))),
          _StepBtn(
              icon: Icons.add_rounded,
              onTap: () {
                setState(() {
                  _qty++;
                  _syncUnitRows();
                });
                _invalidate();
              }),
        ]),
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
                            color: SColors.muted, fontWeight: FontWeight.w700))),
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
                        .map((e) =>
                            DropdownMenuItem(value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) => setState(() => r.type = v ?? r.type),
                  ),
                ),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: TextField(
                    controller: r.reg,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                        isDense: true, hintText: 'Plate / tag / reg'),
                  ),
                ),
              ]),
            );
          }),
        ],
        const SizedBox(height: SSpace.lg),
        // Extras — the listing's catalog add-ons, priced in from the start.
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
        _label('Customer'),
        TextField(
          controller: _who,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
              hintText: 'Phone (for the retrieve link)',
              prefixIcon: Icon(Icons.phone_outlined)),
        ),
        const SizedBox(height: SSpace.sm),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
              hintText: 'Email (optional)',
              prefixIcon: Icon(Icons.mail_outline_rounded)),
        ),
        const SizedBox(height: SSpace.sm),
        // Coupon — validated and priced by the server (storefront discounts).
        TextField(
          controller: _coupon,
          textCapitalization: TextCapitalization.characters,
          onChanged: (_) => _invalidate(),
          decoration: const InputDecoration(
              hintText: 'Coupon code (optional)',
              prefixIcon: Icon(Icons.confirmation_number_outlined)),
        ),
        const SizedBox(height: SSpace.lg),

        // Availability + price for the chosen window.
        if (_availError != null)
          Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
                color: SColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: Row(children: [
              const Icon(Icons.error_outline_rounded,
                  color: SColors.danger, size: 18),
              const SizedBox(width: SSpace.sm),
              Expanded(
                  child: Text(_availError!,
                      style: const TextStyle(
                          color: SColors.danger, fontSize: 13))),
            ]),
          ),
        if (_avail != null && _sufficient) ...[
          Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$_free free · $rd',
                    style: const TextStyle(
                        color: SColors.green, fontWeight: FontWeight.w700)),
                if (_addons.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('+ add-ons: ${_addonSummary()}',
                      style: const TextStyle(color: SColors.ink2, fontSize: 12.5)),
                ],
                if (_quoteDiscount > 0) ...[
                  const SizedBox(height: 4),
                  Text('Coupon ${_quoteDiscountLabel}: −\$${_quoteDiscount.toStringAsFixed(2)}',
                      style: const TextStyle(
                          color: SColors.green, fontSize: 12.5, fontWeight: FontWeight.w700)),
                ],
                if (_quoteRejected != null) ...[
                  const SizedBox(height: 4),
                  Text('Coupon not applied: $_quoteRejected',
                      style: const TextStyle(color: SColors.danger, fontSize: 12.5)),
                ],
                if (_quoteTotal > 0) ...[
                  const SizedBox(height: 4),
                  Text('Price: \$${_quoteTotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 16)),
                ],
              ],
            ),
          ),
          const SizedBox(height: SSpace.md),
        ],

        if (_avail == null || !_sufficient)
          ElevatedButton.icon(
            onPressed: _checking ? null : _checkAvailability,
            style: ElevatedButton.styleFrom(
                backgroundColor: SColors.ink,
                minimumSize: const Size.fromHeight(52)),
            icon: _checking
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.event_available_rounded, color: Colors.white),
            label: Text(_checking ? 'Checking…' : 'Check availability & price',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700)),
          )
        else
          ElevatedButton(
            onPressed: _saving ? null : _reserve,
            style: ElevatedButton.styleFrom(
                backgroundColor: SColors.green,
                minimumSize: const Size.fromHeight(52)),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.4))
                : Text(
                    _quoteTotal > 0
                        ? 'Reserve · \$${_quoteTotal.toStringAsFixed(2)}'
                        : 'Reserve',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700)),
          ),
      ],
    );
  }

  Widget _summary() {
    final d = (_rBooking['data'] is Map)
        ? Map<String, dynamic>.from(_rBooking['data'])
        : {};
    final ref = (d['name'] ?? '').toString();
    final code = (d['dropoffCode'] ?? '').toString();
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
            child: const Icon(Icons.event_available_rounded,
                color: SColors.green, size: 46),
          ),
        ),
        const SizedBox(height: SSpace.md),
        Center(
            child: Text('Reserved',
                style: Theme.of(context).textTheme.displayLarge)),
        if (ref.isNotEmpty)
          Center(
              child: Text('#$ref',
                  style: const TextStyle(color: SColors.muted, fontSize: 14))),
        const SizedBox(height: SSpace.lg),
        if (code.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(SSpace.lg),
            decoration: BoxDecoration(
                color: SColors.claySoft,
                borderRadius: BorderRadius.circular(SRadius.lg)),
            child: Column(children: [
              const Text('Drop-off code',
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
                      letterSpacing: 3)),
            ]),
          ),
        const SizedBox(height: SSpace.lg),
        _sumRow('When', _rangeLabel()),
        _sumRow('Units', '$_qty'),
        if (_addons.isNotEmpty) _sumRow('Add-ons', _addonSummary()),
        _sumRow(
            _rPaid ? 'Paid' : (_effDue > 0 ? 'Due now' : 'Total'),
            _rPaid
                ? '\$${_rTotal.toStringAsFixed(2)} ✓'
                : '\$${(_effDue > 0 ? _effDue : _rTotal).toStringAsFixed(2)}',
            strong: true),
        const SizedBox(height: SSpace.xl),
        // Once it owes nothing the CTA is a paid confirmation, not another
        // "Take payment" that would re-charge a settled reservation.
        if (_rPaid || (_liveDue != null && _liveDue! <= 0))
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
                color: SColors.greenSoft,
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.check_circle_rounded, color: SColors.green, size: 18),
              SizedBox(width: 6),
              Text('Paid — nothing due',
                  style: TextStyle(
                      color: SColors.green, fontWeight: FontWeight.w700)),
            ]),
          )
        else if (_rTotal > 0 || _effDue > 0)
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
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child:
              const Text('Done', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  Widget _dateField(String label, DateTime dt, ValueChanged<DateTime> onPick) {
    return InkWell(
      onTap: () async {
        final now = DateTime.now();
        final date = await showDatePicker(
          context: context,
          initialDate: dt,
          firstDate: now.subtract(const Duration(days: 1)),
          lastDate: now.add(const Duration(days: 365)),
        );
        if (date == null || !mounted) return;
        final time = await showTimePicker(
            context: context, initialTime: TimeOfDay.fromDateTime(dt));
        onPick(DateTime(
            date.year, date.month, date.day, time?.hour ?? dt.hour, time?.minute ?? 0));
      },
      borderRadius: BorderRadius.circular(SRadius.md),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.md),
        decoration: BoxDecoration(
            border: Border.all(color: SColors.line, width: 1.3),
            borderRadius: BorderRadius.circular(SRadius.md)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(color: SColors.faint, fontSize: 11)),
            const SizedBox(height: 2),
            Text(_fmt(dt),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  String _rangeLabel() => '${_fmt(_start)} → ${_fmt(_end)}';

  String _fmt(DateTime dt) {
    final l = dt.toLocal();
    const mo = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
    final ap = l.hour < 12 ? 'AM' : 'PM';
    final m = l.minute.toString().padLeft(2, '0');
    return '${mo[l.month]} ${l.day}, $h:$m $ap';
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t,
            style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: SColors.ink2,
                fontSize: 13)),
      );

  Widget _sumRow(String k, String v, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: const TextStyle(color: SColors.muted, fontSize: 13)),
            Text(v,
                style: TextStyle(
                    fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
                    fontSize: strong ? 16 : 14)),
          ],
        ),
      );
}

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
