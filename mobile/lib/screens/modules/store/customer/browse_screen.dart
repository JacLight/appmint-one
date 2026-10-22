import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/store_provider.dart';
import '../../../../widgets/thumb.dart';

/// Browse the catalog.
///
/// Laid out the way a food or retail app is: address bar, search, a category
/// rail, one featured row, then the full list. Cards carry an image area, a
/// name, a price and the detail line people actually scan — not a bare title.
class BrowseScreen extends StatefulWidget {
  const BrowseScreen({super.key});
  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => context.read<StoreProvider>().load());
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>();
    final featured = store.products.take(5).toList();
    final rest = store.products.skip(5).toList();

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => store.load(),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _Header()),
              if (store.categories.isNotEmpty)
                SliverToBoxAdapter(child: _CategoryRail()),
              if (store.loading)
                const SliverToBoxAdapter(child: _Skeleton())
              else if (store.error != null)
                SliverToBoxAdapter(
                    child: Padding(
                  padding: const EdgeInsets.all(SSpace.xl),
                  child: Text(store.error!,
                      style: const TextStyle(
                          color: SColors.danger, height: 1.4)),
                ))
              else if (store.products.isEmpty)
                const SliverToBoxAdapter(child: _Skeleton(ghost: true))
              else ...[
                if (featured.isNotEmpty) ...[
                  const SliverToBoxAdapter(
                      child: _SectionTitle('Featured')),
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 212,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                            horizontal: SSpace.xl),
                        itemCount: featured.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(width: SSpace.md),
                        itemBuilder: (_, i) =>
                            _FeatureCard(product: featured[i]),
                      ),
                    ),
                  ),
                ],
                const SliverToBoxAdapter(child: _SectionTitle('All')),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.xl, 0, SSpace.xl, SSpace.xxl),
                  sliver: SliverList.separated(
                    itemCount: rest.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: SSpace.md),
                    itemBuilder: (_, i) => _RowCard(product: rest[i]),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.lg, SSpace.xl, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.place_rounded, size: 18, color: SColors.clay),
              const SizedBox(width: 6),
              Text('Deliver to',
                  style: const TextStyle(
                      color: SColors.muted, fontSize: 13)),
              const SizedBox(width: 4),
              const Text('Set address',
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: SColors.ink)),
              const Icon(Icons.keyboard_arrow_down_rounded,
                  size: 18, color: SColors.ink),
            ],
          ),
          const SizedBox(height: SSpace.md),
          Container(
            height: 46,
            padding: const EdgeInsets.symmetric(horizontal: SSpace.md),
            decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.pill),
              border: Border.all(color: SColors.line),
            ),
            child: Row(
              children: [
                const Icon(Icons.search_rounded,
                    size: 19, color: SColors.muted),
                const SizedBox(width: SSpace.sm),
                Text('Search ${CurrentSetup.brand.name}',
                    style: const TextStyle(color: SColors.faint)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryRail extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>();
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.lg, SSpace.xl, 0),
        itemCount: store.categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: SSpace.lg),
        itemBuilder: (_, i) {
          final c = store.categories[i];
          final name = '${c['name'] ?? c['title'] ?? c['label'] ?? ''}';
          final on = store.category == name;
          return GestureDetector(
            onTap: () => store.setCategory(on ? '' : name),
            child: Column(
              children: [
                ThumbArt(
                  name: name,
                  width: 54,
                  height: 54,
                  radius: SRadius.pill,
                  imageUrl: '${c['image'] ?? ''}',
                ),
                const SizedBox(height: 6),
                SizedBox(
                  width: 64,
                  child: Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                      color: on ? SColors.clay : SColors.ink2,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(
            SSpace.xl, SSpace.xl, SSpace.xl, SSpace.md),
        child: Text(text, style: Theme.of(context).textTheme.titleLarge),
      );
}

String _name(Map<String, dynamic> p) =>
    '${p['name'] ?? p['title'] ?? 'Item'}';

String? _price(Map<String, dynamic> p) {
  final v = p['price'] ?? p['amount'] ?? p['cost'];
  if (v == null) return null;
  final n = v is num ? v : num.tryParse('$v');
  return n == null ? '$v' : n.toStringAsFixed(2);
}

class _FeatureCard extends StatelessWidget {
  final Map<String, dynamic> product;
  const _FeatureCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final name = _name(product);
    final price = _price(product);
    return SizedBox(
      width: 268,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ThumbArt(
                name: name,
                width: 268,
                height: 144,
                imageUrl: '${product['image'] ?? product['thumbnail'] ?? ''}',
              ),
              if (price != null)
                Positioned(
                  left: 10,
                  bottom: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: SColors.card,
                      borderRadius: BorderRadius.circular(SRadius.pill),
                    ),
                    child: Text(price,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 12.5,
                            color: SColors.ink)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: SSpace.sm),
          Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: SColors.ink)),
          const SizedBox(height: 2),
          Text(
            '${product['category'] ?? product['brand'] ?? 'In stock'}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: SColors.muted, fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}

class _RowCard extends StatelessWidget {
  final Map<String, dynamic> product;
  const _RowCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final name = _name(product);
    final price = _price(product);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ThumbArt(
          name: name,
          width: 86,
          height: 86,
          radius: SRadius.md,
          imageUrl: '${product['image'] ?? product['thumbnail'] ?? ''}',
        ),
        const SizedBox(width: SSpace.md),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: SColors.ink)),
                const SizedBox(height: 3),
                Text(
                  '${product['description'] ?? product['category'] ?? ''}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: SColors.muted, fontSize: 13, height: 1.3),
                ),
                const SizedBox(height: 6),
                if (price != null)
                  Text(price,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, color: SColors.ink)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Shown while loading, and when the catalog is empty.
///
/// A skeleton rather than a spinner or a blank page: the shape of the screen
/// is visible immediately, so it reads as loading rather than broken — which
/// matters most when there is no server to answer.
class _Skeleton extends StatelessWidget {
  final bool ghost;
  const _Skeleton({this.ghost = false});

  @override
  Widget build(BuildContext context) {
    Widget bar(double w, double h) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
            color: SColors.line2,
            borderRadius: BorderRadius.circular(4),
          ),
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.xl, SSpace.xl, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (ghost) ...[
            const Text('Nothing in the catalog yet',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: SColors.ink)),
            const SizedBox(height: 4),
            const Text(
              'Once products are published they appear here.',
              style: TextStyle(color: SColors.muted, height: 1.4),
            ),
            const SizedBox(height: SSpace.xl),
          ],
          Container(
            height: 144,
            decoration: BoxDecoration(
              color: SColors.line2,
              borderRadius: BorderRadius.circular(SRadius.lg),
            ),
          ),
          const SizedBox(height: SSpace.md),
          bar(180, 14),
          const SizedBox(height: 8),
          bar(120, 12),
          const SizedBox(height: SSpace.xl),
          for (var i = 0; i < 3; i++) ...[
            Row(
              children: [
                Container(
                  width: 86,
                  height: 86,
                  decoration: BoxDecoration(
                    color: SColors.line2,
                    borderRadius: BorderRadius.circular(SRadius.md),
                  ),
                ),
                const SizedBox(width: SSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      bar(double.infinity, 14),
                      const SizedBox(height: 8),
                      bar(200, 12),
                      const SizedBox(height: 8),
                      bar(60, 12),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: SSpace.lg),
          ],
        ],
      ),
    );
  }
}
