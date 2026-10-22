import 'package:flutter/material.dart';

import '../../../config/setup.dart';
import '../../../config/sla_policy.dart';
import '../../../config/stowbo_theme.dart';
import '../../../widgets/thumb.dart';

/// The state of a request's clock, as a chip.
///
/// Colour is the whole point: a queue is read at a glance, and "overdue" has
/// to be visible before the words are.
class SlaChip extends StatelessWidget {
  final SlaClock clock;
  final bool dense;
  const SlaChip({super.key, required this.clock, this.dense = false});

  @override
  Widget build(BuildContext context) {
    late final Color fg, bg;
    late final IconData icon;
    if (clock.finished) {
      fg = SColors.muted;
      bg = SColors.paper2;
      icon = Icons.check_rounded;
    } else if (clock.breached) {
      fg = SColors.danger;
      bg = const Color(0xFFFBE9E7);
      icon = Icons.warning_amber_rounded;
    } else if (clock.closeToBreach) {
      fg = const Color(0xFF8A5B16);
      bg = const Color(0xFFFDF1DC);
      icon = Icons.timer_rounded;
    } else {
      fg = SColors.green;
      bg = SColors.greenSoft;
      icon = Icons.schedule_rounded;
    }

    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: dense ? SSpace.sm : SSpace.md,
          vertical: dense ? 4 : SSpace.xs + 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(SRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: dense ? 12 : 14, color: fg),
          const SizedBox(width: SSpace.xs + 1),
          Text(
            clock.line,
            style: TextStyle(
              color: fg,
              fontSize: dense ? 11 : 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// How full a building is, as one bar.
class OccupancyBar extends StatelessWidget {
  final int occupied, vacant, down;
  final bool showLegend;
  const OccupancyBar({
    super.key,
    required this.occupied,
    required this.vacant,
    required this.down,
    this.showLegend = true,
  });

  int get total => occupied + vacant + down;

  @override
  Widget build(BuildContext context) {
    final t = total;
    final pct = t == 0 ? 0 : (occupied * 100 / t).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('$pct% occupied',
                style: const TextStyle(
                    fontWeight: FontWeight.w700, color: SColors.ink)),
            const Spacer(),
            Text(t == 0 ? 'No units yet' : '$occupied of $t',
                style: const TextStyle(color: SColors.muted, fontSize: 12.5)),
          ],
        ),
        const SizedBox(height: SSpace.sm),
        ClipRRect(
          borderRadius: BorderRadius.circular(SRadius.pill),
          child: SizedBox(
            height: 8,
            child: t == 0
                ? Container(color: SColors.line)
                : Row(
                    children: [
                      if (occupied > 0)
                        Expanded(flex: occupied, child: Container(color: SColors.green)),
                      if (vacant > 0)
                        Expanded(flex: vacant, child: Container(color: SColors.lime)),
                      if (down > 0)
                        Expanded(flex: down, child: Container(color: SColors.amber)),
                    ],
                  ),
          ),
        ),
        if (showLegend) ...[
          const SizedBox(height: SSpace.sm),
          Row(
            children: [
              _Dot(SColors.green, 'Occupied $occupied'),
              const SizedBox(width: SSpace.md),
              _Dot(SColors.lime, 'Vacant $vacant'),
              if (down > 0) ...[
                const SizedBox(width: SSpace.md),
                _Dot(SColors.amber, 'Down $down'),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  final Color colour;
  final String label;
  const _Dot(this.colour, this.label);

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: colour, shape: BoxShape.circle),
          ),
          const SizedBox(width: SSpace.xs + 1),
          Text(label,
              style: const TextStyle(color: SColors.muted, fontSize: 11.5)),
        ],
      );
}

/// Everything about a record's price, read without guessing.
///
/// A listing's rates are a schedule, not a number — [RateScheduleSchema] on
/// the server. A card must not invent "from $X" out of a banded rate, so this
/// returns null when there is no single figure to show, and the card then
/// says what it actually knows.
String? monthlyRate(Map<String, dynamic> listing) {
  final rates = listing['rates'];
  if (rates is! Map) return null;
  final flat = rates['flatRate'] ?? rates['amount'] ?? rates['monthly'];
  final n = flat is num ? flat : num.tryParse('$flat');
  if (n == null || n <= 0) return null;
  return '\$${n.round()}';
}

/// What a listing is, in the words of its own record.
String listingSubtitle(Map<String, dynamic> listing) {
  final bits = <String>[];
  final type = '${listing['spaceType'] ?? ''}'.trim();
  final size = '${listing['size'] ?? ''}'.trim();
  final cap = listing['capacity'];
  final address = listing['address'];
  final city = address is Map ? '${address['city'] ?? ''}'.trim() : '';
  if (type.isNotEmpty) bits.add(type);
  if (size.isNotEmpty) bits.add(size);
  if (cap is num && cap > 1) bits.add('${cap.toInt()} units');
  if (city.isNotEmpty) bits.add(city);
  return bits.join(' · ');
}

String? firstImage(Map<String, dynamic> record) {
  final images = record['images'];
  if (images is List) {
    for (final i in images) {
      if (i is Map) {
        final url = i['url'] ?? i['path'] ?? i['src'];
        if (url != null && '$url'.isNotEmpty) return '$url';
      } else if (i is String && i.isNotEmpty) {
        return i;
      }
    }
  }
  final one = record['image'];
  if (one is String && one.isNotEmpty) return one;
  return null;
}

/// A property as the showcase presents it: picture first, price unmissable.
class PropertyCard extends StatelessWidget {
  final Map<String, dynamic> listing;
  final VoidCallback? onTap;
  const PropertyCard({super.key, required this.listing, this.onTap});

  @override
  Widget build(BuildContext context) {
    final title = '${listing['title'] ?? listing['name'] ?? 'Untitled'}';
    final rate = monthlyRate(listing);
    final accent = CurrentSetup.brand.accent;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          boxShadow: SShadow.soft,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ThumbArt(
                  name: title,
                  imageUrl: firstImage(listing),
                  height: 172,
                  width: double.infinity,
                  radius: 0,
                  icon: Icons.apartment_rounded,
                ),
                if (rate != null)
                  Positioned(
                    left: SSpace.md,
                    bottom: SSpace.md,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.md, vertical: SSpace.xs + 2),
                      decoration: BoxDecoration(
                        color: SColors.white,
                        borderRadius: BorderRadius.circular(SRadius.pill),
                        boxShadow: SShadow.soft,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(rate,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: SColors.ink)),
                          const Text(' /mo',
                              style: TextStyle(
                                  color: SColors.muted, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                Positioned(
                  right: SSpace.md,
                  top: SSpace.md,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: SSpace.sm + 2, vertical: 4),
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: BorderRadius.circular(SRadius.pill),
                    ),
                    child: const Text('Available',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(SSpace.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: SColors.ink)),
                  const SizedBox(height: 2),
                  Text(
                    listingSubtitle(listing).isEmpty
                        ? 'Tap for details'
                        : listingSubtitle(listing),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: SColors.muted, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One unit on the board. Status is the colour; the number is the label.
class UnitTile extends StatelessWidget {
  final Map<String, dynamic> unit;
  final VoidCallback? onTap;
  const UnitTile({super.key, required this.unit, this.onTap});

  static ({Color fg, Color bg, String label}) look(String status) =>
      switch (status.toLowerCase().trim()) {
        'occupied' => (fg: SColors.green2, bg: SColors.greenSoft, label: 'Occupied'),
        'reserved' => (fg: SColors.green2, bg: const Color(0xFFDDEBE2), label: 'Reserved'),
        'maintenance' => (fg: const Color(0xFF8A5B16), bg: const Color(0xFFFDF1DC), label: 'Down'),
        'overlocked' => (fg: SColors.danger, bg: const Color(0xFFFBE9E7), label: 'Locked'),
        _ => (fg: SColors.ink2, bg: SColors.paper2, label: 'Vacant'),
      };

  @override
  Widget build(BuildContext context) {
    final status = '${unit['status'] ?? 'vacant'}';
    final l = look(status);
    final number = '${unit['unitNumber'] ?? unit['name'] ?? '—'}';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.sm, vertical: SSpace.md),
        decoration: BoxDecoration(
          color: l.bg,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: l.fg.withValues(alpha: 0.18)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(number,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontWeight: FontWeight.w800, color: l.fg, fontSize: 14)),
            const SizedBox(height: 2),
            Text(l.label,
                style: TextStyle(
                    color: l.fg.withValues(alpha: 0.75), fontSize: 10.5)),
          ],
        ),
      ),
    );
  }
}

/// A heading with an optional action, used by every screen in the module so
/// the rhythm is the same on all of them.
class SectionHead extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry padding;
  const SectionHead({
    super.key,
    required this.title,
    this.action,
    this.onAction,
    this.padding = const EdgeInsets.fromLTRB(SSpace.lg, SSpace.xl, SSpace.lg, SSpace.md),
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: padding,
        child: Row(
          children: [
            Expanded(
              child: Text(title,
                  style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink)),
            ),
            if (action != null)
              GestureDetector(
                onTap: onAction,
                child: Text(action!,
                    style: TextStyle(
                        color: CurrentSetup.brand.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13)),
              ),
          ],
        ),
      );
}
