import 'package:flutter/material.dart';
import '../config/stowbo_theme.dart';
import '../models/custody.dart';

/// Warm card surface with the brand's 22px radius + soft shadow.
class SCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  const SCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(SSpace.lg),
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.line, width: 1.2),
        boxShadow: SShadow.soft,
      ),
      child: child,
    );
    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(SRadius.xl),
        onTap: onTap,
        child: content,
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  final String text;
  final Widget? trailing;
  const SectionLabel(this.text, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md, top: SSpace.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(text.toUpperCase(),
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(
                        fontSize: 12,
                        letterSpacing: 1,
                        color: SColors.faint)),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Compact pill action button — icon + label, sized to its content so several
/// sit in a row (use inside a Wrap) with room to add more later. `filled` for
/// the primary action, tinted otherwise.
class SActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color color;
  final bool filled;
  const SActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = SColors.clay,
    this.filled = true,
  });

  @override
  Widget build(BuildContext context) {
    final bg = filled ? color : color.withValues(alpha: 0.12);
    final fg = filled ? Colors.white : color;
    return Material(
      color: onTap == null ? bg.withValues(alpha: 0.5) : bg,
      borderRadius: BorderRadius.circular(SRadius.pill),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SRadius.pill),
        child: Padding(
          padding:
              const EdgeInsets.symmetric(horizontal: SSpace.md, vertical: 9),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      color: fg, fontWeight: FontWeight.w700, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;
  const EmptyState(
      {super.key,
      required this.icon,
      required this.title,
      this.subtitle,
      this.action});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SSpace.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                  color: SColors.claySoft,
                  borderRadius: BorderRadius.circular(SRadius.lg)),
              child: Icon(icon, color: SColors.clay, size: 30),
            ),
            const SizedBox(height: SSpace.lg),
            Text(title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge),
            if (subtitle != null) ...[
              const SizedBox(height: SSpace.sm),
              Text(subtitle!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: SColors.muted)),
            ],
            if (action != null) ...[
              const SizedBox(height: SSpace.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class CustodyBadge extends StatelessWidget {
  final CustodyStatus status;
  const CustodyBadge(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    late Color bg, fg;
    switch (status) {
      case CustodyStatus.reserved:
        bg = SColors.claySoft;
        fg = SColors.clay2;
        break;
      case CustodyStatus.stored:
        bg = SColors.green;
        fg = Colors.white;
        break;
      case CustodyStatus.retrieved:
        bg = SColors.greenSoft;
        fg = SColors.green2;
        break;
      case CustodyStatus.closed:
        bg = SColors.line;
        fg = SColors.muted;
        break;
      case CustodyStatus.cancelled:
        bg = const Color(0xFFF3DAD3);
        fg = SColors.danger;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(SRadius.pill)),
      child: Text(status.label,
          style: TextStyle(
              color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

/// Big monospace-ish handoff code display.
class HandoffCode extends StatelessWidget {
  final String code;
  const HandoffCode(this.code, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.ink,
        borderRadius: BorderRadius.circular(SRadius.lg),
      ),
      child: Column(
        children: [
          const Text('HANDOFF CODE',
              style: TextStyle(
                  color: SColors.lime,
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(
            code.split('').join(' '),
            style: const TextStyle(
                color: Colors.white,
                fontSize: 34,
                fontWeight: FontWeight.w700,
                letterSpacing: 4),
          ),
        ],
      ),
    );
  }
}

/// One destination in [StowboNavBar].
class StowboNavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const StowboNavItem(this.icon, this.activeIcon, this.label);
}

/// Modern floating bottom nav — a rounded, shadowed bar that sits above the
/// content (use with `Scaffold(extendBody: true)`). The active tab gets a soft
/// clay pill behind the icon + label; inactive tabs are icon-only and muted.
class StowboNavBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onSelect;
  final List<StowboNavItem> items;
  const StowboNavBar({
    super.key,
    required this.index,
    required this.onSelect,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(SSpace.xl, 0, SSpace.xl, SSpace.sm),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.pill),
          border: Border.all(color: SColors.line, width: 1),
          boxShadow: SShadow.lg,
        ),
        // Active tab sizes to its content (icon + label pill, never clipped);
        // the other tabs share the leftover width as icon-only buttons.
        child: Row(
          children: [
            for (int i = 0; i < items.length; i++)
              if (i == index)
                _ActiveTab(item: items[i])
              else
                Expanded(
                  child: _IconTab(
                    item: items[i],
                    onTap: () => onSelect(i),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _ActiveTab extends StatelessWidget {
  final StowboNavItem item;
  const _ActiveTab({required this.item});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      margin: const EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        color: SColors.claySoft,
        borderRadius: BorderRadius.circular(SRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(item.activeIcon, size: 21, color: SColors.clay2),
          const SizedBox(width: 7),
          Text(
            item.label,
            style: const TextStyle(
                color: SColors.clay2,
                fontWeight: FontWeight.w700,
                fontSize: 13.5),
          ),
        ],
      ),
    );
  }
}

class _IconTab extends StatelessWidget {
  final StowboNavItem item;
  final VoidCallback onTap;
  const _IconTab({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: 46,
        child: Icon(item.icon, size: 23, color: SColors.muted),
      ),
    );
  }
}

String money(num v) => '\$${v.toStringAsFixed(2)}';

String humanDuration(Duration d) {
  if (d.inMinutes < 1) return 'just now';
  final h = d.inHours;
  final m = d.inMinutes % 60;
  if (h == 0) return '${m}m';
  if (m == 0) return '${h}h';
  return '${h}h ${m}m';
}

/// A clear money-state pill for a booking — so every row and the detail page
/// SAYS where it stands: free / metered / unpaid / partly paid / paid.
/// Drives off the server's `payState`.
Widget payStatePill(String state) {
  late final Color c;
  late final String label;
  switch (state) {
    case 'paid':
      c = SColors.green;
      label = 'Paid';
      break;
    case 'partial':
      c = SColors.amber;
      label = 'Part-paid';
      break;
    case 'unpaid':
      c = SColors.clay;
      label = 'Unpaid';
      break;
    case 'metered':
      c = SColors.ink2;
      label = 'Metered';
      break;
    case 'free':
      c = SColors.muted;
      label = 'Free';
      break;
    default:
      c = SColors.muted;
      label = state.isEmpty ? '—' : state;
  }
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
        color: c.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(SRadius.pill)),
    child: Text(label,
        style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
  );
}

/// "Paused" marker for a listing that isn't taking guest bookings. `full`
/// renders the explanatory strip (space dashboard); otherwise a small tag
/// that sits inline in a list row.
class PausedTag extends StatelessWidget {
  final bool full;
  const PausedTag({super.key, this.full = false});

  @override
  Widget build(BuildContext context) {
    final bg = SColors.danger.withValues(alpha: 0.10);
    if (!full) {
      return Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
            color: bg, borderRadius: BorderRadius.circular(6)),
        child: const Text('Paused',
            style: TextStyle(
                color: SColors.danger,
                fontSize: 11,
                fontWeight: FontWeight.w700)),
      );
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: const Row(children: [
        Icon(Icons.pause_circle_filled_rounded,
            size: 16, color: SColors.danger),
        SizedBox(width: 6),
        Expanded(
          child: Text(
              'Paused — hidden from guests, no new bookings. '
              'Walk-ins and your own reservations still work.',
              style: TextStyle(
                  color: SColors.danger,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ),
      ]),
    );
  }
}
