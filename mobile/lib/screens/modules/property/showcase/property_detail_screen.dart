import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../../../services/property_api.dart';
import '../../../../widgets/thumb.dart';
import '../property_widgets.dart';
import 'apply_screen.dart';

/// One property, in full. The listing record is passed in from the card so
/// there is something to read immediately, then the full record replaces it.
class PropertyDetailScreen extends StatefulWidget {
  final Map<String, dynamic> listing;
  const PropertyDetailScreen({super.key, required this.listing});

  @override
  State<PropertyDetailScreen> createState() => _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends State<PropertyDetailScreen> {
  late Map<String, dynamic> _listing = widget.listing;
  List<Map<String, dynamic>> _nearby = const [];
  String? _error;

  String get _id => '${_listing['name'] ?? _listing['sk'] ?? ''}';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = _id;
    if (id.isEmpty) return;
    try {
      final full = await propertyApi.listing(id);
      if (!mounted) return;
      if (full.isNotEmpty) setState(() => _listing = {..._listing, ...full});
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    }
    try {
      final near = await propertyApi.nearby(id);
      if (!mounted) return;
      setState(() => _nearby = near);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final title = '${_listing['title'] ?? _listing['name'] ?? 'Untitled'}';
    final rate = monthlyRate(_listing);
    final address = _listing['address'];
    final features = _listing['features'];
    final description = '${_listing['description'] ?? ''}'.trim();

    return Scaffold(
      backgroundColor: SColors.paper,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: brand.primary,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  ThumbArt(
                    name: title,
                    imageUrl: firstImage(_listing),
                    radius: 0,
                    icon: Icons.apartment_rounded,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.black26, Colors.transparent, Colors.black54],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.lg, SSpace.lg, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                        fontSize: 24,
                        height: 1.15,
                        fontWeight: FontWeight.w800,
                        color: SColors.ink,
                        fontFamily: brand.displayFont,
                      )),
                  const SizedBox(height: SSpace.xs),
                  Text(
                    listingSubtitle(_listing).isEmpty
                        ? words.term(LexiconKeys.property)
                        : listingSubtitle(_listing),
                    style: const TextStyle(color: SColors.muted, fontSize: 14),
                  ),
                  const SizedBox(height: SSpace.lg),
                  _Facts(listing: _listing, rate: rate),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: SSpace.xl),
                    const Text('About this place',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: SColors.ink)),
                    const SizedBox(height: SSpace.sm),
                    Text(description,
                        style: const TextStyle(
                            color: SColors.ink2, height: 1.5, fontSize: 14)),
                  ],
                  if (features is List && features.isNotEmpty) ...[
                    const SizedBox(height: SSpace.xl),
                    const Text('What is here',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: SColors.ink)),
                    const SizedBox(height: SSpace.md),
                    Wrap(
                      spacing: SSpace.sm,
                      runSpacing: SSpace.sm,
                      children: [
                        for (final f in features)
                          _Pill(label: '$f'),
                      ],
                    ),
                  ],
                  if (address is Map) ...[
                    const SizedBox(height: SSpace.xl),
                    const Text('Where it is',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: SColors.ink)),
                    const SizedBox(height: SSpace.sm),
                    Text(
                      [
                        address['address'] ?? address['street'] ?? '',
                        address['city'] ?? '',
                        address['state'] ?? '',
                        address['postcode'] ?? address['zip'] ?? '',
                      ]
                          .map((e) => '$e'.trim())
                          .where((e) => e.isNotEmpty)
                          .join(', '),
                      style: const TextStyle(
                          color: SColors.ink2, height: 1.4, fontSize: 14),
                    ),
                  ],
                  if ('${_listing['accessHours'] ?? ''}'.isNotEmpty ||
                      '${_listing['staffing'] ?? ''}'.isNotEmpty) ...[
                    const SizedBox(height: SSpace.lg),
                    Row(
                      children: [
                        if ('${_listing['accessHours'] ?? ''}'.isNotEmpty)
                          _Pill(
                              label: 'Access ${_listing['accessHours']}',
                              icon: Icons.schedule_rounded),
                        if ('${_listing['staffing'] ?? ''}'.isNotEmpty) ...[
                          const SizedBox(width: SSpace.sm),
                          _Pill(
                              label: '${_listing['staffing']}',
                              icon: Icons.badge_rounded),
                        ],
                      ],
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: SSpace.lg),
                    Text(
                      // The card's own data is still on screen, so this is a
                      // note, not a failure state.
                      'Could not load the full listing: $_error',
                      style: const TextStyle(
                          color: SColors.danger, fontSize: 12.5, height: 1.35),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_nearby.isNotEmpty) ...[
            const SliverToBoxAdapter(
              child: SectionHead(title: 'Nearby'),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 232,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                  itemCount: _nearby.length,
                  separatorBuilder: (_, __) => const SizedBox(width: SSpace.md),
                  itemBuilder: (_, i) => SizedBox(
                    width: 240,
                    child: PropertyCard(
                      listing: _nearby[i],
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              PropertyDetailScreen(listing: _nearby[i]),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: SSpace.xxl * 2)),
        ],
      ),
      bottomNavigationBar: _ApplyBar(listing: _listing, rate: rate),
    );
  }
}

/// Rent, size, capacity — the three numbers somebody decides on.
class _Facts extends StatelessWidget {
  final Map<String, dynamic> listing;
  final String? rate;
  const _Facts({required this.listing, this.rate});

  @override
  Widget build(BuildContext context) {
    final cap = listing['capacity'];
    final facts = <({String label, String value})>[
      if (rate != null) (label: 'Rent', value: '$rate/mo'),
      if ('${listing['size'] ?? ''}'.trim().isNotEmpty)
        (label: 'Size', value: '${listing['size']}'),
      if (cap is num && cap > 0)
        (label: listing['unitLabel'] == null ? 'Units' : '${listing['unitLabel']}s',
            value: '${cap.toInt()}'),
    ];
    if (facts.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: SSpace.lg, vertical: SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        boxShadow: SShadow.soft,
      ),
      child: Row(
        children: [
          for (var i = 0; i < facts.length; i++) ...[
            if (i > 0)
              Container(width: 1, height: 34, color: SColors.line),
            Expanded(
              child: Column(
                children: [
                  Text(facts[i].value,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: SColors.ink)),
                  const SizedBox(height: 2),
                  Text(facts[i].label,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 11.5)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final IconData? icon;
  const _Pill({required this.label, this.icon});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.sm),
        decoration: BoxDecoration(
          color: SColors.paper2,
          borderRadius: BorderRadius.circular(SRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: SColors.ink2),
              const SizedBox(width: SSpace.xs + 1),
            ],
            Text(label,
                style: const TextStyle(
                    color: SColors.ink2,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      );
}

/// Rent on the left, the one action on the right — the bar every rental app
/// ends with, because the decision is "how much" and "can I have it".
class _ApplyBar extends StatelessWidget {
  final Map<String, dynamic> listing;
  final String? rate;
  const _ApplyBar({required this.listing, this.rate});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;

    return Container(
      padding: const EdgeInsets.fromLTRB(
          SSpace.lg, SSpace.md, SSpace.lg, SSpace.md),
      decoration: const BoxDecoration(
        color: SColors.card,
        border: Border(top: BorderSide(color: SColors.line)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(rate ?? 'Rent on request',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: SColors.ink)),
                Text(rate == null ? 'Ask the office' : 'per month',
                    style:
                        const TextStyle(color: SColors.muted, fontSize: 11.5)),
              ],
            ),
            const Spacer(),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: brand.primary,
                padding: const EdgeInsets.symmetric(
                    horizontal: SSpace.xl, vertical: SSpace.md + 2),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill)),
              ),
              onPressed: () {
                final p = context.read<PropertyProvider>();
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => ApplyScreen(
                    listing: listing,
                    units: p.unitsOf('${listing['name'] ?? ''}'),
                  ),
                ));
              },
              child: const Text('Apply to rent',
                  style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
