import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import '../../widgets/host_booking_card.dart';

/// Host coupons. A coupon is a storefront discount record the host owns; the
/// server locks it to `products` = the host's OWN listing codes, so a code made
/// here can never discount another host. Validation and pricing happen on the
/// server (quote → booking); this screen only creates, edits and retires codes.
class HostCouponsScreen extends StatefulWidget {
  const HostCouponsScreen({super.key});
  @override
  State<HostCouponsScreen> createState() => _HostCouponsScreenState();
}

class _HostCouponsScreenState extends State<HostCouponsScreen> {
  final StowboApi _api = StowboApi();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _coupons = [];
  List<Map<String, dynamic>> _listings = [];

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
      final results = await Future.wait([_api.hostDiscounts(), _api.hostListings()]);
      if (!mounted) return;
      setState(() {
        _coupons = results[0];
        _listings = results[1];
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
      builder: (_) => _CouponSheet(
          api: _api,
          listings: _listings,
          existing: existing == null ? null : _data(existing),
          id: existing == null ? null : _id(existing)),
    );
    if (saved == true) _load();
  }

  static double? _num(dynamic v) =>
      v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
  static String _trim(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  String _rule(Map<String, dynamic> d) {
    final v = _num(d['value']) ?? 0;
    final parts = <String>[
      d['type'] == 'fixed' ? '\$${_trim(v)} off' : '${_trim(v)}% off'
    ];
    final max = _num(d['maxDiscount']);
    if (d['type'] != 'fixed' && max != null) parts.add('max \$${_trim(max)}');
    final min = _num(d['minCartValue']);
    if (min != null && min > 0) parts.add('orders ≥ \$${_trim(min)}');
    final items = (d['products'] is List) ? List.from(d['products']) : const [];
    parts.add(items.length == _listings.length || items.isEmpty
        ? 'all my listings'
        : '${items.length} listing${items.length == 1 ? '' : 's'}');
    final used = (d['usageCount'] as num?)?.toInt() ?? 0;
    final limit = (d['usageLimit'] as num?)?.toInt();
    parts.add(limit == null ? 'used $used' : 'used $used / $limit');
    if (d['firstOrderOnly'] == true) parts.add('first order only');
    if ((d['endDate'] ?? '').toString().isNotEmpty) {
      parts.add('until ${d['endDate'].toString().substring(0, 10)}');
    }
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Coupons')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(),
        backgroundColor: SColors.green,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New coupon',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : _error != null
              ? EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'Could not load coupons',
                  subtitle: _error!,
                  action: ElevatedButton(
                      onPressed: _load, child: const Text('Retry')))
              : _coupons.isEmpty
                  ? EmptyState(
                      icon: Icons.confirmation_number_outlined,
                      title: 'No coupons yet',
                      subtitle:
                          'Make a code guests can type at booking. It only ever discounts your own listings.',
                      action: ElevatedButton.icon(
                          onPressed: () => _edit(),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Create a coupon')),
                    )
                  : ListView(
                      padding: const EdgeInsets.all(SSpace.xl),
                      children: [
                        ..._coupons.map(_tile),
                        const SizedBox(height: 80),
                      ],
                    ),
    );
  }

  Future<void> _toggle(Map<String, dynamic> rec, bool on) async {
    try {
      await _api.updateDiscount(_id(rec), {'status': on ? 'active' : 'inactive'});
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not update: $e'), backgroundColor: SColors.danger));
    }
  }

  void _stats(Map<String, dynamic> rec) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _StatsSheet(api: _api, id: _id(rec), code: (_data(rec)['code'] ?? '').toString()),
    );
  }

  Widget _tile(Map<String, dynamic> rec) {
    final d = _data(rec);
    final active = (d['status'] ?? 'active') == 'active';
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.sm),
        child: InkWell(
          onTap: () => _stats(rec),
          child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                  color: active ? SColors.greenSoft : SColors.paper2,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: Icon(Icons.confirmation_number_rounded,
                  color: active ? SColors.green : SColors.muted, size: 22),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text((d['code'] ?? '').toString(),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            letterSpacing: .5)),
                    if (!active)
                      Container(
                        margin: const EdgeInsets.only(left: 6),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                            color: SColors.paper2,
                            borderRadius: BorderRadius.circular(SRadius.sm)),
                        child: Text((d['status'] ?? '').toString(),
                            style: const TextStyle(
                                color: SColors.muted,
                                fontSize: 10,
                                fontWeight: FontWeight.w700)),
                      ),
                  ]),
                  Text((d['name'] ?? '').toString(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  Text(_rule(d),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 12.5)),
                ],
              ),
            ),
            Switch(
              value: active,
              activeThumbColor: SColors.green,
              onChanged: (v) => _toggle(rec, v),
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: SColors.muted),
              onPressed: () => _edit(rec),
              tooltip: 'Edit',
            ),
          ],
        ),
        ),
      ),
    );
  }
}

/// Usage & stats for one code — from the bookings' bills.
class _StatsSheet extends StatefulWidget {
  final StowboApi api;
  final String id;
  final String code;
  const _StatsSheet({required this.api, required this.id, required this.code});
  @override
  State<_StatsSheet> createState() => _StatsSheetState();
}

class _StatsSheetState extends State<_StatsSheet> {
  Map<String, dynamic>? _s;
  String? _err;

  @override
  void initState() {
    super.initState();
    widget.api.discountStats(widget.id).then((v) {
      if (mounted) setState(() => _s = v);
    }).catchError((e) {
      if (mounted) setState(() => _err = '$e');
    });
  }

  String _money(dynamic v) =>
      '\$${((v is num) ? v.toDouble() : (double.tryParse('$v') ?? 0)).toStringAsFixed(2)}';

  Widget _stat(String label, String value) => Expanded(
        child: Column(children: [
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          Text(label,
              style: const TextStyle(color: SColors.muted, fontSize: 11.5)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final s = _s;
    return Container(
      decoration: const BoxDecoration(
          color: SColors.paper,
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      padding: const EdgeInsets.all(SSpace.xl),
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * .85),
      child: s == null
          ? SizedBox(
              height: 120,
              child: Center(
                  child: _err != null
                      ? Text(_err!, style: const TextStyle(color: SColors.danger))
                      : const CircularProgressIndicator(color: SColors.clay)))
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.code,
                    style: Theme.of(context).textTheme.displayLarge),
                Text(
                    '${(s['status'] ?? '').toString()} · ${s['type'] == 'fixed' ? _money(s['value']) : '${s['value']}%'} off'
                    '${(s['products'] is List && (s['products'] as List).isNotEmpty) ? ' · ${(s['products'] as List).length} listing${(s['products'] as List).length == 1 ? '' : 's'}' : ' · all my listings'}',
                    style: const TextStyle(color: SColors.muted, fontSize: 13)),
                const SizedBox(height: SSpace.lg),
                Row(children: [
                  _stat('Uses', '${s['uses'] ?? 0}'
                      '${s['usageLimit'] != null ? ' / ${s['usageLimit']}' : ''}'),
                  _stat('Live bookings', '${s['liveUses'] ?? 0}'),
                  _stat('Given away', _money(s['discounted'])),
                  _stat('Revenue', _money(s['revenue'])),
                ]),
                const SizedBox(height: SSpace.lg),
                const Text('BOOKINGS',
                    style: TextStyle(
                        color: SColors.muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: .8)),
                const SizedBox(height: SSpace.xs),
                Flexible(
                  child: (s['bookings'] is List && (s['bookings'] as List).isNotEmpty)
                      ? ListView(
                          shrinkWrap: true,
                          children: [
                            for (final b in (s['bookings'] as List).cast<Map>())
                              HostBookingCard(
                                row: b.cast<String, dynamic>(),
                                note: 'Coupon −${_money(b['discount'])}',
                              ),
                          ],
                        )
                      : const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('Not used yet.',
                              style: TextStyle(color: SColors.muted)),
                        ),
                ),
              ],
            ),
    );
  }
}

/// Create / edit one coupon.
class _CouponSheet extends StatefulWidget {
  final StowboApi api;
  final List<Map<String, dynamic>> listings;
  final Map<String, dynamic>? existing;
  final String? id;
  const _CouponSheet(
      {required this.api, required this.listings, this.existing, this.id});
  @override
  State<_CouponSheet> createState() => _CouponSheetState();
}

class _CouponSheetState extends State<_CouponSheet> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _code;
  late final TextEditingController _name;
  late final TextEditingController _value;
  late final TextEditingController _max;
  late final TextEditingController _min;
  late final TextEditingController _limit;
  late final TextEditingController _perCustomer;
  late String _type;
  late bool _firstOnly;
  late bool _active;
  DateTime? _from;
  DateTime? _to;
  late Set<String> _picked; // listing codes; empty = all mine
  bool _more = false;
  bool _saving = false;

  static String _txt(dynamic v) {
    if (v == null) return '';
    final d = v is num ? v.toDouble() : double.tryParse('$v');
    if (d == null) return '';
    return d == d.roundToDouble() ? d.toStringAsFixed(0) : d.toStringAsFixed(2);
  }

  String _codeOf(Map<String, dynamic> r) {
    final d = (r['data'] is Map) ? Map<String, dynamic>.from(r['data']) : r;
    return (d['name'] ?? r['sk']).toString();
  }

  String _titleOf(Map<String, dynamic> r) {
    final d = (r['data'] is Map) ? Map<String, dynamic>.from(r['data']) : r;
    return (d['title'] ?? d['name'] ?? 'Space').toString();
  }

  @override
  void initState() {
    super.initState();
    final e = widget.existing ?? {};
    _code = TextEditingController(text: (e['code'] ?? '').toString());
    _name = TextEditingController(text: (e['name'] ?? '').toString());
    _value = TextEditingController(text: _txt(e['value']));
    _max = TextEditingController(text: _txt(e['maxDiscount']));
    _min = TextEditingController(text: _txt(e['minCartValue']));
    _limit = TextEditingController(text: _txt(e['usageLimit']));
    _perCustomer = TextEditingController(text: _txt(e['usageLimitPerCustomer']));
    _type = e['type'] == 'fixed' ? 'fixed' : 'percent';
    _firstOnly = e['firstOrderOnly'] == true;
    _active = (e['status'] ?? 'active') == 'active';
    _from = DateTime.tryParse((e['startDate'] ?? '').toString());
    _to = DateTime.tryParse((e['endDate'] ?? '').toString());
    final items = (e['products'] is List)
        ? List.from(e['products']).map((x) => x.toString()).toSet()
        : <String>{};
    // Stored "all my listings" is the full list; show it as nothing ticked.
    _picked = items.length >= widget.listings.length ? <String>{} : items;
    _more = _max.text.isNotEmpty ||
        _min.text.isNotEmpty ||
        _limit.text.isNotEmpty ||
        _perCustomer.text.isNotEmpty ||
        _firstOnly ||
        _from != null ||
        _to != null ||
        _picked.isNotEmpty;
  }

  @override
  void dispose() {
    for (final c in [_code, _name, _value, _max, _min, _limit, _perCustomer]) {
      c.dispose();
    }
    super.dispose();
  }

  double? _numOf(TextEditingController c) =>
      c.text.trim().isEmpty ? null : double.tryParse(c.text.trim());

  Future<void> _pickDate(bool start) async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: (start ? _from : _to) ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
    );
    if (d == null) return;
    setState(() => start ? _from = d : _to = d);
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = <String, dynamic>{
      if (widget.id == null) 'code': _code.text.trim().toUpperCase(),
      'name': _name.text.trim().isEmpty ? _code.text.trim().toUpperCase() : _name.text.trim(),
      'type': _type,
      'value': _numOf(_value) ?? 0,
      'maxDiscount': _numOf(_max),
      'minCartValue': _numOf(_min),
      'usageLimit': _numOf(_limit)?.toInt(),
      'usageLimitPerCustomer': _numOf(_perCustomer)?.toInt(),
      'firstOrderOnly': _firstOnly,
      'startDate': _from?.toUtc().toIso8601String(),
      'endDate': _to
          ?.add(const Duration(hours: 23, minutes: 59))
          .toUtc()
          .toIso8601String(),
      'listings': _picked.toList(),
      'status': _active ? 'active' : 'inactive',
    };
    try {
      if (widget.id != null) {
        await widget.api.updateDiscount(widget.id!, body);
      } else {
        await widget.api.createDiscount(body);
      }
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not save: ${e.toString().replaceFirst('Exception: ', '')}'),
          backgroundColor: SColors.danger));
    }
  }

  String _fmt(DateTime? d) =>
      d == null ? 'any' : '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final editing = widget.id != null;
    final pct = _type == 'percent';
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
                Text(editing ? 'Edit coupon' : 'New coupon',
                    style: Theme.of(context).textTheme.displayLarge),
                const SizedBox(height: SSpace.lg),
                TextFormField(
                  controller: _code,
                  enabled: !editing,
                  autofocus: !editing,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                      labelText: 'Code', hintText: 'SUMMER10'),
                  validator: (v) {
                    final t = (v ?? '').trim();
                    if (t.length < 3) return 'At least 3 characters';
                    if (!RegExp(r'^[A-Za-z0-9_-]{3,24}$').hasMatch(t)) {
                      return 'Letters, numbers, - or _ only';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: SSpace.md),
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                      labelText: 'Name (optional)',
                      hintText: 'Summer regulars'),
                ),
                const SizedBox(height: SSpace.md),
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _type,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Discount'),
                      items: const [
                        DropdownMenuItem(value: 'percent', child: Text('% off')),
                        DropdownMenuItem(value: 'fixed', child: Text('\$ off')),
                      ],
                      onChanged: (v) => setState(() => _type = v ?? 'percent'),
                    ),
                  ),
                  const SizedBox(width: SSpace.md),
                  Expanded(
                    child: TextFormField(
                      controller: _value,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      decoration: InputDecoration(
                          labelText: pct ? 'Percent' : 'Amount',
                          prefixText: pct ? null : '\$ ',
                          suffixText: pct ? '%' : null),
                      validator: (v) {
                        final d = double.tryParse((v ?? '').trim());
                        if (d == null || d <= 0) return 'Enter a number';
                        if (pct && d > 100) return 'Max 100%';
                        return null;
                      },
                    ),
                  ),
                ]),
                const SizedBox(height: SSpace.sm),
                TextButton.icon(
                  onPressed: () => setState(() => _more = !_more),
                  icon: Icon(_more
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded),
                  label: Text(_more ? 'Fewer options' : 'Limits & scope'),
                ),
                if (_more) ...[
                  Row(children: [
                    if (pct)
                      Expanded(
                        child: TextFormField(
                          controller: _max,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration: const InputDecoration(
                              labelText: 'Max discount',
                              hintText: 'none',
                              prefixText: '\$ '),
                        ),
                      ),
                    if (pct) const SizedBox(width: SSpace.md),
                    Expanded(
                      child: TextFormField(
                        controller: _min,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration: const InputDecoration(
                            labelText: 'Min order',
                            hintText: 'none',
                            prefixText: '\$ '),
                      ),
                    ),
                  ]),
                  const SizedBox(height: SSpace.md),
                  Row(children: [
                    Expanded(
                      child: TextFormField(
                        controller: _limit,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Total uses', hintText: 'unlimited'),
                      ),
                    ),
                    const SizedBox(width: SSpace.md),
                    Expanded(
                      child: TextFormField(
                        controller: _perCustomer,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Per customer', hintText: 'unlimited'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: SSpace.md),
                  Row(children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(true),
                        icon: const Icon(Icons.event_outlined, size: 18),
                        label: Text('From ${_fmt(_from)}'),
                      ),
                    ),
                    const SizedBox(width: SSpace.md),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(false),
                        icon: const Icon(Icons.event_outlined, size: 18),
                        label: Text('Until ${_fmt(_to)}'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: SSpace.md),
                  const Text('Listings (none ticked = all of mine)',
                      style: TextStyle(color: SColors.muted, fontSize: 12)),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: widget.listings.map((r) {
                      final code = _codeOf(r);
                      return FilterChip(
                        label: Text(_titleOf(r),
                            overflow: TextOverflow.ellipsis),
                        selected: _picked.contains(code),
                        onSelected: (on) => setState(
                            () => on ? _picked.add(code) : _picked.remove(code)),
                      );
                    }).toList(),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: SColors.green,
                    value: _firstOnly,
                    onChanged: (v) => setState(() => _firstOnly = v),
                    title: const Text('First booking only',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: SColors.green,
                    value: _active,
                    onChanged: (v) => setState(() => _active = v),
                    title: const Text('Active',
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
                      : Text(editing ? 'Save changes' : 'Create coupon',
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
