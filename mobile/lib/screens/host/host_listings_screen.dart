import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../providers/auth_provider.dart';
import '../../providers/custody_provider.dart';
import '../../services/address_service.dart';
import '../../widgets/stowbo_widgets.dart';
import 'host_addons_screen.dart';
import 'host_coupons_screen.dart';
import 'host_shell.dart' show kHostNavClearance;
import 'space_dashboard_screen.dart';

class HostListingsScreen extends StatefulWidget {
  const HostListingsScreen({super.key});
  @override
  State<HostListingsScreen> createState() => _HostListingsScreenState();
}

class _HostListingsScreenState extends State<HostListingsScreen> {
  final _query = TextEditingController();
  String? _cityFilter; // a city label, or null = all

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _create(BuildContext context) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _NewListingSheet(),
    );
  }

  /// Last comma-separated chunk of the address is usually the city/area — a
  /// pragmatic key to group listings by until the model carries a city field.
  String _cityOf(StowboHost h) {
    final parts = h.address
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    return parts.isEmpty ? '' : parts.last;
  }

  @override
  Widget build(BuildContext context) {
    final cp = context.watch<CustodyProvider>();
    final all = cp.hostListings;
    final q = _query.text.trim().toLowerCase();
    final cities = <String>{for (final h in all) if (_cityOf(h).isNotEmpty) _cityOf(h)}
        .toList()
      ..sort();
    final listings = all.where((h) {
      if (_cityFilter != null && _cityOf(h) != _cityFilter) return false;
      if (q.isEmpty) return true;
      return h.name.toLowerCase().contains(q) ||
          h.address.toLowerCase().contains(q) ||
          h.kind.toLowerCase().contains(q);
    }).toList();

    return Scaffold(
      // Lift the FAB above the shell's fixed floating nav pill so it's reachable.
      floatingActionButton: Padding(
        padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).padding.bottom + kHostNavClearance),
        child: FloatingActionButton.extended(
          heroTag: 'listings_create',
          onPressed: () => _create(context),
          backgroundColor: SColors.green,
          icon: const Icon(Icons.add_rounded, color: Colors.white),
          label: const Text('New listing',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
      ),
      body: SafeArea(
        child: all.isEmpty
            ? EmptyState(
                icon: Icons.storefront_outlined,
                title: 'No listings yet',
                subtitle:
                    'List a spot — a shop counter, a tent, a lot — and set your hourly rate. Guests can then book and drop off.',
                action: ElevatedButton.icon(
                  onPressed: () => _create(context),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Create your first listing'),
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.xl, SSpace.lg, SSpace.xl, SSpace.sm),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('Listings',
                              style: Theme.of(context).textTheme.displayLarge),
                        ),
                        TextButton.icon(
                          onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const HostAddonsScreen())),
                          icon: const Icon(Icons.extension_rounded,
                              size: 18, color: SColors.green),
                          label: const Text('Add-ons',
                              style: TextStyle(
                                  color: SColors.green,
                                  fontWeight: FontWeight.w700)),
                        ),
                        IconButton(
                          tooltip: 'Coupons',
                          visualDensity: VisualDensity.compact,
                          onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const HostCouponsScreen())),
                          icon: const Icon(Icons.confirmation_number_outlined,
                              size: 20, color: SColors.green),
                        ),
                      ],
                    ),
                  ),
                  // Search listings by name, address, or type.
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: SSpace.xl),
                    child: Container(
                      decoration: BoxDecoration(
                        color: SColors.card,
                        borderRadius: BorderRadius.circular(SRadius.pill),
                        border: Border.all(color: SColors.line, width: 1.2),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                      child: Row(children: [
                        const Icon(Icons.search_rounded,
                            color: SColors.muted, size: 20),
                        const SizedBox(width: SSpace.sm),
                        Expanded(
                          child: TextField(
                            controller: _query,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              hintText: 'Search listings…',
                              contentPadding:
                                  EdgeInsets.symmetric(vertical: 13),
                            ),
                          ),
                        ),
                        if (_query.text.isNotEmpty)
                          GestureDetector(
                            onTap: () => setState(() => _query.clear()),
                            child: const Icon(Icons.close_rounded,
                                color: SColors.muted, size: 18),
                          ),
                      ]),
                    ),
                  ),
                  // Filter by city — only when there's more than one to choose from.
                  if (cities.length > 1)
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(
                            SSpace.xl, SSpace.sm, SSpace.xl, 0),
                        children: [
                          _cityChip(null, 'All'),
                          for (final c in cities) _cityChip(c, c),
                        ],
                      ),
                    ),
                  Expanded(
                    child: listings.isEmpty
                        ? const EmptyState(
                            icon: Icons.search_off_rounded,
                            title: 'No matching listings',
                            subtitle: 'Try a different name, city, or type.',
                          )
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(
                                SSpace.xl, SSpace.md, SSpace.xl, 96),
                            children: [
                              ...listings.map((h) => _ListingTile(h)),
                            ],
                          ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _cityChip(String? city, String label) {
    final on = _cityFilter == city;
    return Padding(
      padding: const EdgeInsets.only(right: SSpace.sm),
      child: ChoiceChip(
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        selected: on,
        showCheckmark: false,
        selectedColor: SColors.ink,
        backgroundColor: SColors.card,
        labelStyle: TextStyle(
            color: on ? Colors.white : SColors.ink2,
            fontWeight: FontWeight.w600,
            fontSize: 12.5),
        onSelected: (_) => setState(() => _cityFilter = city),
      ),
    );
  }
}

class _ListingTile extends StatelessWidget {
  final StowboHost h;
  const _ListingTile(this.h);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: SCard(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => SpaceDashboardScreen(host: h)),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                  color: SColors.greenSoft,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: const Icon(Icons.storefront_rounded,
                  color: SColors.green),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(h.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  Row(children: [
                    if (h.status != 'active') const PausedTag(),
                    Expanded(
                      child: Text(
                          '${h.kind} · ${h.priceLabel} · ${h.capacity} spaces',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: SColors.muted, fontSize: 13)),
                    ),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NewListingSheet extends StatefulWidget {
  const _NewListingSheet();
  @override
  State<_NewListingSheet> createState() => _NewListingSheetState();
}

class _NewListingSheetState extends State<_NewListingSheet> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _desc = TextEditingController();
  final _rate = TextEditingController(text: '3');
  final _capacity = TextEditingController(text: '20');
  final _hours = TextEditingController();
  String _kind = StowboHost.kinds.first;
  bool _saving = false;
  List<AddressPrediction> _preds = [];
  double? _lat;
  double? _lng;
  int _addrSeq = 0;

  Future<void> _onAddressChanged(String q) async {
    final seq = ++_addrSeq;
    if (q.trim().length < 3) {
      setState(() => _preds = []);
      return;
    }
    try {
      final preds = await addressService.autocomplete(q);
      if (mounted && seq == _addrSeq) setState(() => _preds = preds);
    } catch (_) {}
  }

  Future<void> _pickAddress(AddressPrediction p) async {
    _address.text = p.description;
    setState(() => _preds = []);
    FocusScope.of(context).unfocus();
    try {
      final details = await addressService.placeDetails(p.placeId);
      if (details != null && mounted) {
        // Shape: { placeId, formattedAddress, address:{...}, location:{lat,lng} }
        final loc = details['location'];
        final lat = loc is Map ? loc['lat'] : null;
        final lng = loc is Map ? loc['lng'] : null;
        final formatted = details['formattedAddress'];
        setState(() {
          _lat = lat is num ? lat.toDouble() : null;
          _lng = lng is num ? lng.toDouble() : null;
          if (formatted is String && formatted.isNotEmpty) {
            _address.text = formatted;
          }
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    for (final c in [_name, _address, _desc, _rate, _capacity, _hours]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    // Coordinates come only from tapping an address suggestion. Without them the
    // listing won't surface in nearby/map search — warn instead of silently
    // publishing something guests can't find.
    if ((_lat == null || _lng == null) && _address.text.trim().isNotEmpty) {
      final go = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: SColors.card,
          title: const Text('No map location'),
          content: const Text(
              'Pick the address from the suggestions to place it on the map — '
              'otherwise it won\'t show in nearby search. Publish anyway?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Fix address')),
            TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Publish anyway')),
          ],
        ),
      );
      if (go != true) return;
    }
    final user = context.read<AuthProvider>().user;
    setState(() => _saving = true);
    final host = StowboHost(
      sk: '',
      name: _name.text.trim(),
      kind: _kind,
      address: _address.text.trim(),
      description: _desc.text.trim(),
      ratePerHour: double.tryParse(_rate.text.trim()) ?? 3,
      capacity: int.tryParse(_capacity.text.trim()) ?? 20,
      hours: _hours.text.trim(),
      ownerUserId: user?.id ?? '',
      ownerEmail: user?.email ?? '',
      lat: _lat,
      lng: _lng,
    );
    final created =
        await context.read<CustodyProvider>().createListing(host);
    if (!mounted) return;
    setState(() => _saving = false);
    if (created != null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Listing created ✓'),
          backgroundColor: SColors.green));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not create listing. Try again.'),
          backgroundColor: SColors.danger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: const BoxDecoration(
          color: SColors.paper,
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
        ),
        padding: const EdgeInsets.all(SSpace.xl),
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                        color: SColors.line,
                        borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: SSpace.lg),
                Text('New listing',
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: SSpace.lg),
                _label('Name'),
                TextFormField(
                  controller: _name,
                  decoration:
                      const InputDecoration(hintText: 'e.g. Main St. Coffee'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: SSpace.md),
                _label('Type'),
                Wrap(
                  spacing: SSpace.sm,
                  children: StowboHost.kinds
                      .map((k) => ChoiceChip(
                            label: Text(k),
                            selected: _kind == k,
                            onSelected: (_) => setState(() => _kind = k),
                            selectedColor: SColors.green,
                            labelStyle: TextStyle(
                                color: _kind == k
                                    ? Colors.white
                                    : SColors.ink2,
                                fontWeight: FontWeight.w600),
                          ))
                      .toList(),
                ),
                const SizedBox(height: SSpace.md),
                _label('Address'),
                TextFormField(
                  controller: _address,
                  onChanged: _onAddressChanged,
                  decoration: InputDecoration(
                    hintText: 'Start typing an address…',
                    prefixIcon: const Icon(Icons.place_outlined,
                        color: SColors.muted),
                    suffixIcon: _lat != null
                        ? const Icon(Icons.check_circle_rounded,
                            color: SColors.green)
                        : null,
                  ),
                ),
                if (_preds.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 6),
                    decoration: BoxDecoration(
                      color: SColors.card,
                      borderRadius: BorderRadius.circular(SRadius.md),
                      border: Border.all(color: SColors.line, width: 1.2),
                    ),
                    child: Column(
                      children: [
                        for (final p in _preds.take(5))
                          ListTile(
                            dense: true,
                            leading: const Icon(Icons.location_on_outlined,
                                size: 18, color: SColors.muted),
                            title: Text(p.description,
                                style: const TextStyle(fontSize: 13.5)),
                            onTap: () => _pickAddress(p),
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: SSpace.md),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Rate / item · hour (\$)'),
                          TextFormField(
                            controller: _rate,
                            keyboardType: TextInputType.number,
                            validator: (v) =>
                                (double.tryParse(v ?? '') == null)
                                    ? '#'
                                    : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: SSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Capacity'),
                          TextFormField(
                            controller: _capacity,
                            keyboardType: TextInputType.number,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SSpace.md),
                _label('Hours (optional)'),
                TextFormField(
                  controller: _hours,
                  decoration:
                      const InputDecoration(hintText: 'e.g. 9:00–23:00'),
                ),
                const SizedBox(height: SSpace.md),
                _label('Description (optional)'),
                TextFormField(
                  controller: _desc,
                  maxLines: 3,
                  decoration: const InputDecoration(
                      hintText: 'What guests should know'),
                ),
                const SizedBox(height: SSpace.xl),
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style:
                      ElevatedButton.styleFrom(backgroundColor: SColors.green),
                  child: _saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.4))
                      : const Text('Publish listing'),
                ),
                const SizedBox(height: SSpace.sm),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t,
            style: const TextStyle(
                fontWeight: FontWeight.w600, color: SColors.ink2, fontSize: 13)),
      );
}
