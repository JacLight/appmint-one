import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../../../widgets/thumb.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';
import 'building_detail_screen.dart';

/// What we run, and how full it is.
class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key});

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<PropertyProvider>();
      if (p.buildings.isEmpty && !p.loading) p.loadPortfolio();
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final roll = p.rollup;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: p.loadPortfolio,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(brand.name.toUpperCase(),
                            style: const TextStyle(
                                color: SColors.faint,
                                fontSize: 10.5,
                                letterSpacing: 2,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: SSpace.xs + 2),
                        Text(
                          words.term(LexiconKeys.properties),
                          style: TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w800,
                            color: SColors.ink,
                            fontFamily: brand.displayFont,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (roll.total > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Container(
                  padding: const EdgeInsets.all(SSpace.lg),
                  decoration: BoxDecoration(
                    color: SColors.card,
                    borderRadius: BorderRadius.circular(SRadius.xl),
                    boxShadow: SShadow.soft,
                  ),
                  child: OccupancyBar(
                    occupied: roll.occupied,
                    vacant: roll.vacant,
                    down: roll.down,
                  ),
                ),
              ),
            if (p.loading && p.buildings.isEmpty)
              const ModuleLoading()
            else if (p.error != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child:
                    ModuleError(message: p.error!, onRetry: p.loadPortfolio),
              )
            else if (p.buildings.isEmpty)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.domain_rounded,
                  title: 'No ${words.lower(LexiconKeys.properties)} yet',
                  body:
                      'A ${words.lower(LexiconKeys.property)} you manage shows '
                      'here with its ${words.lower(LexiconKeys.units)}, who is '
                      'in them and what is empty.',
                ),
              )
            else ...[
              SectionHead(title: '${p.buildings.length} managed'),
              for (final b in p.buildings)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, 0, SSpace.lg, SSpace.md),
                  child: _BuildingRow(
                    building: b,
                    units: p.unitsOf('${b['name'] ?? ''}'),
                    onTap: () {
                      final id = '${b['name'] ?? b['sk'] ?? ''}';
                      context.read<PropertyProvider>().openBuilding(id, known: b);
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => const BuildingDetailScreen(),
                      ));
                    },
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BuildingRow extends StatelessWidget {
  final Map<String, dynamic> building;
  final List<Map<String, dynamic>> units;
  final VoidCallback onTap;
  const _BuildingRow(
      {required this.building, required this.units, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final title = '${building['title'] ?? building['name'] ?? 'Untitled'}';
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

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          boxShadow: SShadow.soft,
        ),
        child: Row(
          children: [
            ThumbArt(
              name: title,
              imageUrl: firstImage(building),
              width: 72,
              height: 72,
              radius: SRadius.md,
              icon: Icons.domain_rounded,
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
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: SColors.ink)),
                  const SizedBox(height: 2),
                  Text(
                    listingSubtitle(building).isEmpty
                        ? 'No details yet'
                        : listingSubtitle(building),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(color: SColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: SSpace.sm),
                  if (units.isEmpty)
                    const Text('No units recorded',
                        style: TextStyle(color: SColors.faint, fontSize: 11.5))
                  else
                    OccupancyBar(
                      occupied: occupied,
                      vacant: vacant,
                      down: down,
                      showLegend: false,
                    ),
                ],
              ),
            ),
            const SizedBox(width: SSpace.sm),
            const Icon(Icons.chevron_right_rounded, color: SColors.faint),
          ],
        ),
      ),
    );
  }
}
