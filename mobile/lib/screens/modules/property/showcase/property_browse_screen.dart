import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../../../widgets/map_canvas.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';
import 'property_detail_screen.dart';

/// What is available to rent. The front door of the module for anyone who
/// does not live here yet.
class PropertyBrowseScreen extends StatefulWidget {
  /// True when this is a tab inside a shell, which supplies its own padding.
  final bool embedded;
  const PropertyBrowseScreen({super.key, this.embedded = false});

  @override
  State<PropertyBrowseScreen> createState() => _PropertyBrowseScreenState();
}

class _PropertyBrowseScreenState extends State<PropertyBrowseScreen> {
  final _search = TextEditingController();
  String _filter = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<PropertyProvider>();
      if (p.offers.isEmpty && !p.offersLoading) p.loadOffers();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  /// Space types the server actually returned. Filters invented in the app
  /// would offer choices that match nothing.
  List<String> _types(List<Map<String, dynamic>> offers) {
    final seen = <String>{};
    for (final o in offers) {
      final t = '${o['spaceType'] ?? ''}'.trim();
      if (t.isNotEmpty) seen.add(t);
    }
    final list = seen.toList()..sort();
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final words = CurrentSetup.words;
    final types = _types(p.offers);
    final shown = _filter.isEmpty
        ? p.offers
        : [
            for (final o in p.offers)
              if ('${o['spaceType'] ?? ''}' == _filter) o,
          ];

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: CurrentSetup.brand.primary,
        onRefresh: () => p.loadOffers(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _Hero(count: p.offers.length)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    SSpace.lg, SSpace.lg, SSpace.lg, SSpace.sm),
                child: _SearchBar(
                  controller: _search,
                  hint: 'Search ${words.lower(LexiconKeys.properties)}, area or city',
                  onSubmit: (v) => p.loadOffers(keyword: v),
                ),
              ),
            ),
            if (types.isNotEmpty)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                    children: [
                      _Chip(
                        label: 'All',
                        selected: _filter.isEmpty,
                        onTap: () => setState(() => _filter = ''),
                      ),
                      for (final t in types)
                        _Chip(
                          label: t,
                          selected: _filter == t,
                          onTap: () => setState(() => _filter = t),
                        ),
                    ],
                  ),
                ),
              ),
            if (p.offersError != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleError(
                      message: p.offersError!, onRetry: () => p.loadOffers()),
                ),
              )
            else if (p.offersLoading && p.offers.isEmpty)
              const SliverToBoxAdapter(child: _BrowseSkeleton())
            else if (shown.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleEmpty(
                    icon: Icons.apartment_rounded,
                    title: 'Nothing listed yet',
                    body:
                        'When a ${words.lower(LexiconKeys.property)} is published it '
                        'shows here, with photos, rent and what is free to move into.',
                  ),
                ),
              )
            else ...[
              SliverToBoxAdapter(
                child: SectionHead(
                  title: '${shown.length} '
                      '${shown.length == 1 ? words.lower(LexiconKeys.property) : words.lower(LexiconKeys.properties)}'
                      ' to see',
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                    SSpace.lg, 0, SSpace.lg, SSpace.xxl),
                sliver: SliverList.separated(
                  itemCount: shown.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: SSpace.lg),
                  itemBuilder: (_, i) => PropertyCard(
                    listing: shown[i],
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => PropertyDetailScreen(listing: shown[i]),
                    )),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The header. A map behind the words says "places", which is what this is,
/// without claiming to be an interactive map it is not yet.
class _Hero extends StatelessWidget {
  final int count;
  const _Hero({required this.count});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;

    return SizedBox(
      height: 184,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const MapCanvas(seed: 11),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  brand.primary.withValues(alpha: 0.92),
                  brand.primary.withValues(alpha: 0.62),
                ],
              ),
            ),
          ),
          Positioned(
            right: SSpace.lg,
            top: SSpace.xxl + SSpace.lg,
            child: MapPin(colour: brand.accent, icon: Icons.apartment_rounded),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(SSpace.lg, SSpace.lg, SSpace.lg, SSpace.lg),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(brand.name.toUpperCase(),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 11,
                        letterSpacing: 2.2,
                        fontWeight: FontWeight.w700,
                      )),
                  const SizedBox(height: SSpace.sm),
                  Text(
                    'Find your next place',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      height: 1.1,
                      fontWeight: FontWeight.w800,
                      fontFamily: brand.displayFont,
                    ),
                  ),
                  const SizedBox(height: SSpace.xs),
                  Text(
                    count == 0
                        ? 'Tour, apply and sign from your phone'
                        : '$count ${words.lower(LexiconKeys.properties)} · tour, apply and sign from your phone',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmit;
  const _SearchBar(
      {required this.controller, required this.hint, required this.onSubmit});

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.pill),
          boxShadow: SShadow.soft,
        ),
        child: TextField(
          controller: controller,
          textInputAction: TextInputAction.search,
          onSubmitted: onSubmit,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: SColors.faint, fontSize: 14),
            prefixIcon: const Icon(Icons.search_rounded,
                color: SColors.muted, size: 20),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      );
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    return Padding(
      padding: const EdgeInsets.only(right: SSpace.sm),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
          decoration: BoxDecoration(
            color: selected ? brand.primary : SColors.card,
            borderRadius: BorderRadius.circular(SRadius.pill),
            border: Border.all(
                color: selected ? brand.primary : SColors.line, width: 1),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : SColors.ink2,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

/// The shape of the screen, drawn while the real thing loads. A spinner tells
/// somebody to wait; this tells them what they are waiting for.
class _BrowseSkeleton extends StatelessWidget {
  const _BrowseSkeleton();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.xl, SSpace.lg, SSpace.xxl),
        child: Column(
          children: [
            for (var i = 0; i < 3; i++) ...[
              Container(
                height: 248,
                decoration: BoxDecoration(
                  color: SColors.card,
                  borderRadius: BorderRadius.circular(SRadius.xl),
                  boxShadow: SShadow.soft,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 172,
                      decoration: const BoxDecoration(
                        color: SColors.paper2,
                        borderRadius: BorderRadius.vertical(
                            top: Radius.circular(SRadius.xl)),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.all(SSpace.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _Bar(width: 170),
                          SizedBox(height: SSpace.sm),
                          _Bar(width: 110, height: 10),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SSpace.lg),
            ],
          ],
        ),
      );
}

class _Bar extends StatelessWidget {
  final double width, height;
  const _Bar({required this.width, this.height = 13});

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: SColors.paper2,
          borderRadius: BorderRadius.circular(SRadius.pill),
        ),
      );
}
