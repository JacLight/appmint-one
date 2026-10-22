import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';

/// Host add-on management. Two entry points, one screen:
///   • from Listings → the whole catalog (create / edit / retire add-ons).
///   • from a listing (host != null) → the same catalog, plus a checkbox per
///     add-on to choose which apply to THIS listing, saved via setListingAddons.
///
/// An add-on is a reusable `stowbo_addon` the host owns; listings reference it
/// by NAME (slug). price 0 = a free add-on; `service` = the host physically
/// does something, so buying it raises a fulfilment request.
class HostAddonsScreen extends StatefulWidget {
  final StowboHost? host; // non-null → per-listing attach mode
  const HostAddonsScreen({super.key, this.host});
  @override
  State<HostAddonsScreen> createState() => _HostAddonsScreenState();
}

/// Charge cadences the pricing engine understands (stowbo.service elapsed()).
const _chargeEvery = <String, String>{
  'once': 'One-time',
  'day': 'Per day',
  'hour': 'Per hour',
  'week': 'Per week',
  'month': 'Per month',
  'item': 'Per item',
  'person': 'Per person',
};

class _HostAddonsScreenState extends State<HostAddonsScreen> {
  final StowboApi _api = StowboApi();
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<Map<String, dynamic>> _addons = [];
  final Set<String> _applied = {}; // add-on names attached to this listing

  bool get _listingMode => widget.host != null;

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
      final addons = await _api.hostAddons();
      if (_listingMode) {
        final listing = await _api.myListing(widget.host!.sk);
        final l = listing['listing'];
        final ld = (l is Map && l['data'] is Map)
            ? Map<String, dynamic>.from(l['data'])
            : (l is Map ? Map<String, dynamic>.from(l) : {});
        final applied = (ld['addOns'] is List)
            ? List.from(ld['addOns']).map((e) => e.toString())
            : <String>[];
        _applied
          ..clear()
          ..addAll(applied);
      }
      if (!mounted) return;
      setState(() {
        _addons = addons;
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

  Future<void> _saveApplied() async {
    setState(() => _saving = true);
    try {
      await _api.setListingAddons(widget.host!.sk, _applied.toList());
      if (!mounted) return;
      setState(() => _saving = false);
      // Grab the messenger BEFORE pop — after pop this context is defunct and the
      // confirmation never renders.
      final messenger = ScaffoldMessenger.of(context);
      Navigator.pop(context, true);
      messenger.showSnackBar(const SnackBar(
          content: Text('Add-ons updated for this listing ✓'),
          backgroundColor: SColors.green));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not save: $e'), backgroundColor: SColors.danger));
    }
  }

  Future<void> _edit([Map<String, dynamic>? existing]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddonSheet(
          api: _api, existing: existing == null ? null : _data(existing),
          id: existing == null ? null : _id(existing)),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> rec) async {
    final d = _data(rec);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Retire this add-on?'),
        content: Text(
            '"${d['title'] ?? d['label'] ?? 'Add-on'}" will stop being offered on your listings. Bookings that already bought it keep it.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: SColors.danger),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Retire')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.deleteAddon(_id(rec));
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not retire: $e'),
          backgroundColor: SColors.danger));
    }
  }

  String _priceLabel(Map<String, dynamic> d) {
    final p = (d['price'] is num) ? (d['price'] as num).toDouble() : 0.0;
    if (p <= 0) return 'Free';
    final every = _chargeEvery[(d['chargeEvery'] ?? 'once').toString()] ?? '';
    return '\$${p.toStringAsFixed(2)}${every == 'One-time' ? '' : ' · ${every.toLowerCase()}'}';
  }

  @override
  Widget build(BuildContext context) {
    final title = _listingMode ? '${widget.host!.name} · Add-ons' : 'Add-ons';
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(),
        backgroundColor: SColors.green,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('New add-on',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      bottomNavigationBar: _listingMode
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ElevatedButton(
                  onPressed: _saving ? null : _saveApplied,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: SColors.clay,
                      minimumSize: const Size.fromHeight(52)),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text('Save ${_applied.length} to this listing',
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : _error != null
              ? EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'Could not load add-ons',
                  subtitle: _error!,
                  action: ElevatedButton(
                      onPressed: _load, child: const Text('Retry')))
              : _addons.isEmpty
                  ? EmptyState(
                      icon: Icons.extension_outlined,
                      title: 'No add-ons yet',
                      subtitle:
                          'Create extras guests can buy — insurance, priority retrieval, a padlock. Reuse them across any listing.',
                      action: ElevatedButton.icon(
                          onPressed: () => _edit(),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Create an add-on')),
                    )
                  : ListView(
                      padding: const EdgeInsets.all(SSpace.xl),
                      children: [
                        if (_listingMode)
                          const Padding(
                            padding: EdgeInsets.only(bottom: SSpace.md),
                            child: Text(
                                'Tick the add-ons guests can buy on this listing.',
                                style: TextStyle(
                                    color: SColors.muted, fontSize: 13)),
                          ),
                        ..._addons.map(_tile),
                        const SizedBox(height: 80),
                      ],
                    ),
    );
  }

  Widget _tile(Map<String, dynamic> rec) {
    final d = _data(rec);
    final name = (d['name'] ?? '').toString();
    final title = (d['title'] ?? d['label'] ?? 'Add-on').toString();
    final desc = (d['description'] ?? '').toString();
    final service = d['service'] == true;
    final checked = _applied.contains(name);
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.sm),
        child: Row(
          children: [
            if (_listingMode)
              Checkbox(
                value: checked,
                activeColor: SColors.clay,
                onChanged: (v) => setState(() =>
                    v == true ? _applied.add(name) : _applied.remove(name)),
              ),
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                  color: SColors.greenSoft,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: Icon(
                  service
                      ? Icons.room_service_rounded
                      : Icons.extension_rounded,
                  color: SColors.green,
                  size: 22),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(
                      child: Text(title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                    if (service)
                      Container(
                        margin: const EdgeInsets.only(left: 6),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                            color: SColors.claySoft,
                            borderRadius: BorderRadius.circular(SRadius.sm)),
                        child: const Text('service',
                            style: TextStyle(
                                color: SColors.clay2,
                                fontSize: 10,
                                fontWeight: FontWeight.w700)),
                      ),
                  ]),
                  Text(
                      desc.isEmpty
                          ? _priceLabel(d)
                          : '${_priceLabel(d)} · $desc',
                      maxLines: 1,
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
              onPressed: () => _delete(rec),
              tooltip: 'Retire',
            ),
          ],
        ),
      ),
    );
  }
}

/// Create / edit one add-on.
class _AddonSheet extends StatefulWidget {
  final StowboApi api;
  final Map<String, dynamic>? existing;
  final String? id;
  const _AddonSheet({required this.api, this.existing, this.id});
  @override
  State<_AddonSheet> createState() => _AddonSheetState();
}

class _AddonSheetState extends State<_AddonSheet> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _title;
  late final TextEditingController _desc;
  late final TextEditingController _price;
  late String _every;
  late bool _service;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing ?? {};
    _title = TextEditingController(
        text: (e['title'] ?? e['label'] ?? '').toString());
    _desc = TextEditingController(text: (e['description'] ?? '').toString());
    final p = (e['price'] is num) ? (e['price'] as num).toDouble() : 0.0;
    _price = TextEditingController(text: p == 0 ? '' : p.toStringAsFixed(2));
    final ev = (e['chargeEvery'] ?? 'once').toString();
    _every = _chargeEvery.containsKey(ev) ? ev : 'once';
    _service = e['service'] == true;
  }

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = {
      'title': _title.text.trim(),
      'description': _desc.text.trim(),
      'price': double.tryParse(_price.text.trim()) ?? 0,
      'chargeEvery': _every,
      'service': _service,
    };
    try {
      if (widget.id != null) {
        await widget.api.updateAddon(widget.id!, body);
      } else {
        await widget.api.createAddon(body);
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

  @override
  Widget build(BuildContext context) {
    final editing = widget.id != null;
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
            color: SColors.paper,
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
        padding: const EdgeInsets.all(SSpace.xl),
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(editing ? 'Edit add-on' : 'New add-on',
                  style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.lg),
              TextFormField(
                controller: _title,
                autofocus: !editing,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                    labelText: 'Name',
                    hintText: 'Insurance / Priority retrieval / Padlock'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'A name is required' : null,
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
                  child: TextFormField(
                    controller: _price,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    decoration: const InputDecoration(
                        labelText: 'Price', hintText: '0 = free', prefixText: '\$ '),
                  ),
                ),
                const SizedBox(width: SSpace.md),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _every,
                    decoration: const InputDecoration(labelText: 'Charge'),
                    items: _chargeEvery.entries
                        .map((e) => DropdownMenuItem(
                            value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) => setState(() => _every = v ?? 'once'),
                  ),
                ),
              ]),
              const SizedBox(height: SSpace.sm),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: SColors.green,
                value: _service,
                onChanged: (v) => setState(() => _service = v),
                title: const Text('This is a service',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text(
                    'Buying it raises a fulfilment request for you to action.',
                    style: TextStyle(color: SColors.muted, fontSize: 12)),
              ),
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
                    : Text(editing ? 'Save changes' : 'Create add-on',
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
