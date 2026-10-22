import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';

/// The fees on ONE listing. A fee belongs to a listing: "New fee" creates it
/// and attaches it here; the bin removes it from this listing. The fee itself
/// is data (models/stowbo/stowbo-fee.ts); the server prices it.
class HostFeesScreen extends StatefulWidget {
  final StowboHost host;
  const HostFeesScreen({super.key, required this.host});
  @override
  State<HostFeesScreen> createState() => _HostFeesScreenState();
}

const _appliesTo = <String, String>{
  'checkout': 'Per order',
  'item': 'Per item',
};
const _basis = <String, String>{
  'fixed': 'Fixed amount',
  'percent': '% of subtotal',
};
const _paidBy = <String, String>{
  'guest': 'Guest pays (on the bill)',
  'host': 'I pay (off my payout)',
};
const _trigger = <String, String>{
  'booking': 'At booking',
  'cancellation': 'On cancellation',
  'late_pickup': 'On late pickup',
  'no_show': 'On no-show',
};
const _channels = <String, String>{
  'web': 'Web',
  'app': 'App',
  'walkin': 'Walk-in',
  'reservation': 'Reservation',
};

class _HostFeesScreenState extends State<HostFeesScreen> {
  final StowboApi _api = StowboApi();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _fees = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Map<String, dynamic> _data(Map<String, dynamic> rec) =>
      rec['data'] is Map ? Map<String, dynamic>.from(rec['data']) : rec;
  String _id(Map<String, dynamic> rec) =>
      (rec['sk'] ?? rec['id'] ?? '').toString();

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final fees = await _api.listingFees(widget.host.sk);
      if (!mounted) return;
      setState(() {
        _fees = fees;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _edit([Map<String, dynamic>? existing]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FeeSheet(
          api: _api,
          listingId: widget.host.sk,
          existing: existing == null ? null : _data(existing),
          id: existing == null ? null : _id(existing)),
    );
    if (saved == true) _load();
  }

  Future<void> _remove(Map<String, dynamic> rec) async {
    final d = _data(rec);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Remove this fee?'),
        content: Text(
            '"${d['title'] ?? 'Fee'}" will no longer be charged on ${widget.host.name}. Bookings that already carry it keep it.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: SColors.danger),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.removeListingFee(widget.host.sk, _id(rec));
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not remove: $e'),
          backgroundColor: SColors.danger));
    }
  }

  static double? _num(dynamic v) =>
      v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
  static String _trim(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  /// "$3.00 per order · subtotal ≥ $0.01 · at most $5" — the rule, in words.
  String _ruleLabel(Map<String, dynamic> d) {
    final amt = _num(d['amount']) ?? 0;
    final pct = d['basis'] == 'percent';
    final how = pct ? '${_trim(amt)}%' : '\$${amt.toStringAsFixed(2)}';
    final parts = <String>[
      '$how ${d['appliesTo'] == 'item' ? 'per item' : 'per order'}'
    ];
    final when = (d['trigger'] ?? 'booking').toString();
    if (when != 'booking') parts.add((_trigger[when] ?? when).toLowerCase());
    final from = _num(d['priceFrom']), to = _num(d['priceTo']);
    if (from != null && to != null) {
      parts.add('subtotal \$${_trim(from)}–\$${_trim(to)}');
    } else if (from != null) {
      parts.add('subtotal ≥ \$${_trim(from)}');
    } else if (to != null) {
      parts.add('subtotal ≤ \$${_trim(to)}');
    }
    final min = _num(d['minFee']), max = _num(d['maxFee']);
    if (min != null) parts.add('at least \$${_trim(min)}');
    if (max != null) parts.add('at most \$${_trim(max)}');
    if (d['paidBy'] == 'host') parts.add('you pay');
    if (d['taxable'] == false) parts.add('not taxed');
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${widget.host.name} · Fees')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(),
        backgroundColor: SColors.green,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New fee',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : _error != null
              ? EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'Could not load fees',
                  subtitle: _error!,
                  action: ElevatedButton(
                      onPressed: _load, child: const Text('Retry')))
              : _fees.isEmpty
                  ? EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'No fees on this listing',
                      subtitle:
                          'Fees charged here — cleaning, oversize, late pickup. Platform fees are applied for you.',
                      action: ElevatedButton.icon(
                          onPressed: () => _edit(),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Add a fee')),
                    )
                  : ListView(
                      padding: const EdgeInsets.all(SSpace.xl),
                      children: [
                        ..._fees.map(_tile),
                        const SizedBox(height: 80),
                      ],
                    ),
    );
  }

  Widget _tile(Map<String, dynamic> rec) {
    final d = _data(rec);
    final title = (d['title'] ?? 'Fee').toString();
    final hostPays = d['paidBy'] == 'host';
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.sm),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                  color: hostPays ? SColors.claySoft : SColors.greenSoft,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: Icon(Icons.receipt_long_rounded,
                  color: hostPays ? SColors.clay : SColors.green, size: 22),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(_ruleLabel(d),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 13)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: SColors.muted),
              onPressed: () => _edit(rec),
              tooltip: 'Edit',
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded,
                  color: SColors.danger),
              onPressed: () => _remove(rec),
              tooltip: 'Remove from this listing',
            ),
          ],
        ),
      ),
    );
  }
}

/// Create / edit one fee — the fields of models/stowbo/stowbo-fee.ts.
class _FeeSheet extends StatefulWidget {
  final StowboApi api;
  final String listingId;
  final Map<String, dynamic>? existing;
  final String? id;
  const _FeeSheet(
      {required this.api, required this.listingId, this.existing, this.id});
  @override
  State<_FeeSheet> createState() => _FeeSheetState();
}

class _FeeSheetState extends State<_FeeSheet> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _title;
  late final TextEditingController _desc;
  late final TextEditingController _amount;
  late final TextEditingController _from;
  late final TextEditingController _to;
  late final TextEditingController _min;
  late final TextEditingController _max;
  late String _applies;
  late String _basisV;
  late String _paid;
  late String _when;
  late bool _taxable;
  late bool _refundable;
  late Set<String> _chan;
  bool _more = false;
  bool _saving = false;

  static String _txt(dynamic v) {
    if (v == null) return '';
    final d = v is num ? v.toDouble() : double.tryParse('$v');
    if (d == null) return '';
    return d == d.roundToDouble() ? d.toStringAsFixed(0) : d.toStringAsFixed(2);
  }

  @override
  void initState() {
    super.initState();
    final e = widget.existing ?? {};
    _title = TextEditingController(text: (e['title'] ?? '').toString());
    _desc = TextEditingController(text: (e['description'] ?? '').toString());
    _amount = TextEditingController(text: _txt(e['amount']));
    _from = TextEditingController(text: _txt(e['priceFrom']));
    _to = TextEditingController(text: _txt(e['priceTo']));
    _min = TextEditingController(text: _txt(e['minFee']));
    _max = TextEditingController(text: _txt(e['maxFee']));
    _applies = _appliesTo.containsKey(e['appliesTo']) ? e['appliesTo'] : 'checkout';
    _basisV = _basis.containsKey(e['basis']) ? e['basis'] : 'fixed';
    _paid = _paidBy.containsKey(e['paidBy']) ? e['paidBy'] : 'guest';
    _when = _trigger.containsKey(e['trigger']) ? e['trigger'] : 'booking';
    _taxable = e['taxable'] != false;
    _refundable = e['refundable'] == true;
    _chan = (e['channels'] is List)
        ? List.from(e['channels']).map((c) => c.toString()).toSet()
        : <String>{};
    _more = _from.text.isNotEmpty ||
        _to.text.isNotEmpty ||
        _min.text.isNotEmpty ||
        _max.text.isNotEmpty ||
        _chan.isNotEmpty ||
        _paid == 'host' ||
        _when != 'booking';
  }

  @override
  void dispose() {
    for (final c in [_title, _desc, _amount, _from, _to, _min, _max]) {
      c.dispose();
    }
    super.dispose();
  }

  double? _numOf(TextEditingController c) =>
      c.text.trim().isEmpty ? null : double.tryParse(c.text.trim());

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = <String, dynamic>{
      'title': _title.text.trim(),
      'description': _desc.text.trim(),
      'trigger': _when,
      'appliesTo': _applies,
      'basis': _basisV,
      'amount': _numOf(_amount) ?? 0,
      'paidBy': _paid,
      'taxable': _taxable,
      'refundable': _refundable,
      'priceFrom': _numOf(_from),
      'priceTo': _numOf(_to),
      'minFee': _numOf(_min),
      'maxFee': _numOf(_max),
      'channels': _chan.toList(),
    };
    try {
      if (widget.id != null) {
        await widget.api.updateFee(widget.id!, body);
      } else {
        await widget.api.createListingFee(widget.listingId, body);
      }
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not save: $e'), backgroundColor: SColors.danger));
    }
  }

  Widget _money(TextEditingController c, String label, {String? hint}) =>
      TextFormField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration:
            InputDecoration(labelText: label, hintText: hint, prefixText: '\$ '),
      );

  @override
  Widget build(BuildContext context) {
    final editing = widget.id != null;
    final pct = _basisV == 'percent';
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
            color: SColors.paper,
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
        padding: const EdgeInsets.all(SSpace.xl),
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(editing ? 'Edit fee' : 'New fee',
                    style: Theme.of(context).textTheme.displayLarge),
                const SizedBox(height: SSpace.lg),
                TextFormField(
                  controller: _title,
                  autofocus: !editing,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                      labelText: 'Name',
                      hintText: 'Cleaning fee / Oversize / Late pickup'),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'A name is required'
                      : null,
                ),
                const SizedBox(height: SSpace.md),
                TextFormField(
                  controller: _desc,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                      labelText: 'Description (optional)'),
                ),
                const SizedBox(height: SSpace.md),
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _basisV,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Charge'),
                      items: _basis.entries
                          .map((e) => DropdownMenuItem(
                              value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: (v) => setState(() => _basisV = v ?? 'fixed'),
                    ),
                  ),
                  const SizedBox(width: SSpace.md),
                  Expanded(
                    child: TextFormField(
                      controller: _amount,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      decoration: InputDecoration(
                          labelText: pct ? 'Percent' : 'Amount',
                          prefixText: pct ? null : '\$ ',
                          suffixText: pct ? '%' : null),
                      validator: (v) {
                        final d = double.tryParse((v ?? '').trim());
                        if (d == null || d < 0) return 'Enter a number';
                        if (pct && d > 100) return 'Max 100%';
                        return null;
                      },
                    ),
                  ),
                ]),
                const SizedBox(height: SSpace.md),
                DropdownButtonFormField<String>(
                  initialValue: _applies,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Applies'),
                  items: _appliesTo.entries
                      .map((e) =>
                          DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _applies = v ?? 'checkout'),
                ),
                const SizedBox(height: SSpace.sm),
                TextButton.icon(
                  onPressed: () => setState(() => _more = !_more),
                  icon: Icon(_more
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded),
                  label: Text(_more ? 'Fewer options' : 'Limits & rules'),
                ),
                if (_more) ...[
                  DropdownButtonFormField<String>(
                    initialValue: _when,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'When'),
                    items: _trigger.entries
                        .map((e) => DropdownMenuItem(
                            value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) => setState(() => _when = v ?? 'booking'),
                  ),
                  const SizedBox(height: SSpace.md),
                  const Text('Only when the order subtotal is…',
                      style: TextStyle(color: SColors.muted, fontSize: 12)),
                  const SizedBox(height: SSpace.xs),
                  Row(children: [
                    Expanded(child: _money(_from, 'At least', hint: 'any')),
                    const SizedBox(width: SSpace.md),
                    Expanded(child: _money(_to, 'At most', hint: 'any')),
                  ]),
                  const SizedBox(height: SSpace.md),
                  const Text('Clamp the fee itself to…',
                      style: TextStyle(color: SColors.muted, fontSize: 12)),
                  const SizedBox(height: SSpace.xs),
                  Row(children: [
                    Expanded(child: _money(_min, 'Minimum fee', hint: 'none')),
                    const SizedBox(width: SSpace.md),
                    Expanded(child: _money(_max, 'Maximum fee', hint: 'none')),
                  ]),
                  const SizedBox(height: SSpace.md),
                  DropdownButtonFormField<String>(
                    initialValue: _paid,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Who pays'),
                    items: _paidBy.entries
                        .map((e) => DropdownMenuItem(
                            value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) => setState(() => _paid = v ?? 'guest'),
                  ),
                  const SizedBox(height: SSpace.md),
                  const Text('Booking channels (none ticked = all)',
                      style: TextStyle(color: SColors.muted, fontSize: 12)),
                  Wrap(
                    spacing: 6,
                    children: _channels.entries
                        .map((e) => FilterChip(
                              label: Text(e.value),
                              selected: _chan.contains(e.key),
                              onSelected: (on) => setState(() =>
                                  on ? _chan.add(e.key) : _chan.remove(e.key)),
                            ))
                        .toList(),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: SColors.green,
                    value: _taxable,
                    onChanged: (v) => setState(() => _taxable = v),
                    title: const Text('Taxable',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: SColors.green,
                    value: _refundable,
                    onChanged: (v) => setState(() => _refundable = v),
                    title: const Text('Refunded on cancellation',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ],
                const SizedBox(height: SSpace.lg),
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: SColors.clay,
                      minimumSize: const Size.fromHeight(52)),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text(editing ? 'Save changes' : 'Add fee',
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
