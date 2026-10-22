import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../../../widgets/thumb.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';

/// One building: the unit board, and who is in it.
///
/// The board is the screen a property manager actually works from — which
/// doors are empty, which are let, which are out of service — so it is the
/// first thing on it, not a tab three levels down.
class BuildingDetailScreen extends StatelessWidget {
  const BuildingDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final b = p.open;
    final title = '${b['title'] ?? b['name'] ?? words.term(LexiconKeys.property)}';
    final units = p.openUnits;

    var occupied = 0, vacant = 0, down = 0;
    for (final u in units) {
      switch ('${u['status'] ?? ''}'.toLowerCase()) {
        case 'occupied':
        case 'reserved':
          occupied++;
        case 'maintenance':
        case 'overlocked':
          down++;
        default:
          vacant++;
      }
    }

    return Scaffold(
      backgroundColor: SColors.paper,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            backgroundColor: brand.primary,
            foregroundColor: Colors.white,
            title: Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700)),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  ThumbArt(
                    name: title,
                    imageUrl: firstImage(b),
                    radius: 0,
                    icon: Icons.domain_rounded,
                  ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          brand.primary.withValues(alpha: 0.75),
                          Colors.transparent,
                          Colors.black45,
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (p.openError != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(message: p.openError!),
              ),
            ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.lg, SSpace.lg, 0),
              child: Container(
                padding: const EdgeInsets.all(SSpace.lg),
                decoration: BoxDecoration(
                  color: SColors.card,
                  borderRadius: BorderRadius.circular(SRadius.xl),
                  boxShadow: SShadow.soft,
                ),
                child: OccupancyBar(
                    occupied: occupied, vacant: vacant, down: down),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: SectionHead(
              title: '${words.term(LexiconKeys.units)} · ${units.length}',
            ),
          ),
          if (p.openLoading && units.isEmpty)
            const SliverToBoxAdapter(child: ModuleLoading())
          else if (units.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.grid_view_rounded,
                  title: 'No ${words.lower(LexiconKeys.units)} recorded',
                  body:
                      'A ${words.lower(LexiconKeys.property)} can be let whole, '
                      'or split into numbered ${words.lower(LexiconKeys.units)} '
                      'with their own status. Add them in Studio and the board '
                      'fills in.',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              sliver: SliverGrid.builder(
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  mainAxisSpacing: SSpace.sm,
                  crossAxisSpacing: SSpace.sm,
                  childAspectRatio: 1.05,
                ),
                itemCount: units.length,
                itemBuilder: (_, i) => UnitTile(
                  unit: units[i],
                  onTap: () => _unitSheet(context, units[i]),
                ),
              ),
            ),
          if (p.openTenancies.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: SectionHead(
                  title: '${words.term(LexiconKeys.leases)} · ${p.openTenancies.length}'),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, 0, SSpace.lg, SSpace.xxl),
              sliver: SliverList.separated(
                itemCount: p.openTenancies.length,
                separatorBuilder: (_, __) => const SizedBox(height: SSpace.sm),
                itemBuilder: (_, i) =>
                    TenancyRow(tenancy: p.openTenancies[i]),
              ),
            ),
          ] else
            const SliverToBoxAdapter(child: SizedBox(height: SSpace.xxl)),
        ],
      ),
    );
  }

  /// Taking a unit out of service, and putting it back, is the one change a
  /// manager makes from the board itself.
  void _unitSheet(BuildContext context, Map<String, dynamic> unit) {
    final p = context.read<PropertyProvider>();
    final id = '${unit['sk'] ?? unit['name'] ?? ''}';
    final status = '${unit['status'] ?? 'vacant'}'.toLowerCase();

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${unit['unitNumber'] ?? unit['name'] ?? 'Unit'}',
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink)),
              const SizedBox(height: SSpace.xs),
              Text(UnitTile.look(status).label,
                  style: const TextStyle(color: SColors.muted, fontSize: 13)),
              if ('${unit['accessCode'] ?? ''}'.isNotEmpty) ...[
                const SizedBox(height: SSpace.md),
                Row(
                  children: [
                    const Icon(Icons.pin_rounded, size: 15, color: SColors.muted),
                    const SizedBox(width: SSpace.sm),
                    Text('Access ${unit['accessCode']}',
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 13)),
                  ],
                ),
              ],
              const SizedBox(height: SSpace.xl),
              if (status == 'maintenance' || status == 'overlocked')
                _SheetAction(
                  label: 'Back in service',
                  icon: Icons.check_circle_rounded,
                  colour: SColors.green,
                  onTap: () async {
                    Navigator.of(sheet).pop();
                    final err = await p.setUnitStatus(id, 'vacant');
                    if (err != null && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          backgroundColor: SColors.danger,
                          content: Text(err)));
                    }
                  },
                )
              else
                _SheetAction(
                  label: 'Take out of service',
                  icon: Icons.build_rounded,
                  colour: SColors.amber,
                  onTap: () async {
                    Navigator.of(sheet).pop();
                    final err = await p.setUnitStatus(id, 'maintenance');
                    if (err != null && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          backgroundColor: SColors.danger,
                          content: Text(err)));
                    }
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SheetAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color colour;
  final VoidCallback onTap;
  const _SheetAction({
    required this.label,
    required this.icon,
    required this.colour,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: colour,
            side: BorderSide(color: colour.withValues(alpha: 0.5)),
            padding: const EdgeInsets.symmetric(vertical: SSpace.md + 2),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(SRadius.pill)),
          ),
          onPressed: onTap,
          icon: Icon(icon, size: 18),
          label: Text(label,
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      );
}

/// A tenancy as a row: who, which unit, how long left, what is owed.
class TenancyRow extends StatelessWidget {
  final Map<String, dynamic> tenancy;
  final VoidCallback? onTap;
  const TenancyRow({super.key, required this.tenancy, this.onTap});

  static DateTime? _d(dynamic v) => DateTime.tryParse('${v ?? ''}');

  @override
  Widget build(BuildContext context) {
    final customer = tenancy['customer'];
    final who = customer is Map
        ? '${customer['name'] ?? customer['firstName'] ?? customer['email'] ?? ''}'
        : '${tenancy['customerName'] ?? tenancy['reportedBy'] ?? ''}';

    final items = tenancy['items'];
    final first = items is List && items.isNotEmpty && items.first is Map
        ? Map<String, dynamic>.from(items.first)
        : const {};
    final unit = '${first['unitNumber'] ?? first['unit'] ?? tenancy['unit'] ?? ''}'.trim();
    final end = _d(first['endDate'] ?? tenancy['endDate']);

    final s = tenancy['paymentSummary'];
    final sum = s is Map ? Map<String, dynamic>.from(s) : const {};
    final balRaw = sum['balance'] ?? tenancy['balance'];
    final bal = balRaw is num ? balRaw.toDouble() : null;
    final arrears = bal != null && bal > 0.004;

    final daysLeft = end == null ? null : end.difference(DateTime.now()).inDays;
    final expiring = daysLeft != null && daysLeft >= 0 && daysLeft <= 60;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: arrears
                  ? SColors.danger.withValues(alpha: 0.3)
                  : SColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: SColors.paper2,
                borderRadius: BorderRadius.circular(SRadius.sm),
              ),
              child: Text(
                (who.isEmpty ? '?' : who.trim()[0]).toUpperCase(),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, color: SColors.ink2),
              ),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(who.isEmpty ? 'Tenant' : who,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: SColors.ink)),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (unit.isNotEmpty) unit,
                      if (daysLeft != null)
                        daysLeft < 0
                            ? 'ended'
                            : daysLeft == 0
                                ? 'ends today'
                                : '$daysLeft days left',
                    ].join(' · '),
                    style: TextStyle(
                        color: expiring ? SColors.amber : SColors.muted,
                        fontSize: 11.5,
                        fontWeight:
                            expiring ? FontWeight.w700 : FontWeight.w400),
                  ),
                ],
              ),
            ),
            if (arrears)
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: SSpace.sm + 2, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBE9E7),
                  borderRadius: BorderRadius.circular(SRadius.pill),
                ),
                child: Text('owes ${bal.toStringAsFixed(0)}',
                    style: const TextStyle(
                        color: SColors.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.w800)),
              )
            else
              const Icon(Icons.check_circle_rounded,
                  size: 17, color: SColors.green),
          ],
        ),
      ),
    );
  }
}
