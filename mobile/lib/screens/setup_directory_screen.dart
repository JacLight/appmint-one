import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/module_features.dart';
import '../config/setup.dart';
import '../config/stowbo_theme.dart';
import '../providers/role_provider.dart';
import '../providers/setup_provider.dart';
import 'setup_detail_screen.dart';

/// The one place setups are browsed.
///
/// This is both the welcome a demo build opens on and the switcher reached
/// from the account screen — the same rich cards either way. They used to be
/// two screens showing the same thing differently, which meant a setup could
/// look like one product on the way in and another when switching.
class SetupDirectoryScreen extends StatelessWidget {
  /// First run: a hero header instead of an app bar, and no way back, because
  /// there is nothing behind it yet.
  final bool welcome;

  const SetupDirectoryScreen({super.key, this.welcome = false});

  @override
  Widget build(BuildContext context) {
    final setups = context.watch<SetupProvider>();
    final active = setups.active;

    // The all-modules build is not a business; it sits apart at the end.
    final businesses = kSetups.where((s) => s.id != 'demo').toList();
    final everything = kSetups.where((s) => s.id == 'demo').toList();

    Future<void> choose(PortalSetup s) async {
      await setups.select(s);
      if (!context.mounted) return;
      // The side they were on may not exist in the new setup.
      context.read<RoleProvider>().clear();
      if (!welcome) Navigator.of(context).maybePop();
    }

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: welcome
          ? null
          : AppBar(
              backgroundColor: SColors.paper,
              surfaceTintColor: Colors.transparent,
              title: const Text('Switch setup'),
            ),
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.fromLTRB(
              SSpace.xl, welcome ? SSpace.xxl : SSpace.lg, SSpace.xl, SSpace.xxl),
          children: [
            if (welcome) ...[
              const Text('ONE APP',
                  style: TextStyle(
                      fontSize: 12,
                      letterSpacing: 2.2,
                      fontWeight: FontWeight.w700,
                      color: SColors.clay)),
              const SizedBox(height: SSpace.sm),
              Text('Many businesses',
                  style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.sm),
            ],
            Text(
              welcome
                  ? 'Each one switches different modules on, speaks its own '
                      "trade's words and wears its own brand. Pick one to see "
                      'the app become it.'
                  : 'Pick one to see the app as that business — its brand, its '
                      'modules and its words.',
              style: const TextStyle(
                  color: SColors.muted, height: 1.45, fontSize: 15),
            ),
            const SizedBox(height: SSpace.xl),
            for (final s in businesses) ...[
              _SetupCard(
                setup: s,
                active: s.id == active.id,
                onOpen: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => SetupDetailScreen(setup: s))),
                onTry: () => choose(s),
              ),
              const SizedBox(height: SSpace.md),
            ],
            const SizedBox(height: SSpace.lg),
            const Text('OR SEE EVERYTHING',
                style: TextStyle(
                    fontSize: 11,
                    letterSpacing: 1.8,
                    fontWeight: FontWeight.w700,
                    color: SColors.faint)),
            const SizedBox(height: SSpace.md),
            for (final s in everything)
              _SetupCard(
                setup: s,
                active: s.id == active.id,
                onOpen: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => SetupDetailScreen(setup: s))),
                onTry: () => choose(s),
              ),
          ],
        ),
      ),
    );
  }
}

/// One setup, drawn in its own colours, carrying everything worth knowing
/// before you tap: what it is, what it switches on, and who uses it.
class _SetupCard extends StatelessWidget {
  final PortalSetup setup;
  final bool active;

  /// Read about it first.
  final VoidCallback onOpen;

  /// Or go straight in.
  final VoidCallback onTry;

  const _SetupCard({
    required this.setup,
    required this.active,
    required this.onOpen,
    required this.onTry,
  });

  static const _moduleWords = {
    PortalModule.scheduling: 'Scheduling',
    PortalModule.logistics: 'Delivery',
    PortalModule.rentals: 'Rentals',
    PortalModule.store: 'Store',
    PortalModule.money: 'Money',
    PortalModule.lms: 'Learning',
    PortalModule.property: 'Property',
  };

  @override
  Widget build(BuildContext context) {
    final brand = setup.brand;
    final modules = setup.modules.map((m) => _moduleWords[m] ?? m.name).toList()
      ..sort();

    // Who this setup is for, in its own words.
    final sides = [
      setup.labelFor(PortalRole.customer),
      if (setup.hasProviderSide) setup.labelFor(PortalRole.provider),
    ].join(' · ');

    return Material(
      color: brand.primary,
      borderRadius: BorderRadius.circular(SRadius.xl),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Stack(
          children: [
            // A wash of the accent so two setups with similar primaries still
            // read as different products.
            Positioned(
              right: -46,
              top: -46,
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: brand.accent.withValues(alpha: 0.16),
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(SRadius.xl),
                border: active
                    ? Border.all(color: brand.accent, width: 2)
                    : null,
              ),
              padding: const EdgeInsets.all(SSpace.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          brand.name.toUpperCase(),
                          style: TextStyle(
                            color: brand.accent,
                            fontSize: 11,
                            letterSpacing: 2,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      if (active)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 3),
                          decoration: BoxDecoration(
                            color: brand.accent,
                            borderRadius:
                                BorderRadius.circular(SRadius.pill),
                          ),
                          child: Text('ON NOW',
                              style: TextStyle(
                                  color: brand.primary,
                                  fontSize: 10,
                                  letterSpacing: 1,
                                  fontWeight: FontWeight.w800)),
                        ),
                    ],
                  ),
                  const SizedBox(height: SSpace.sm),
                  Text(
                    setup.pitch.isEmpty ? brand.name : setup.pitch,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SSpace.md),
                  Row(
                    children: [
                      Icon(Icons.people_outline_rounded,
                          size: 13,
                          color: Colors.white.withValues(alpha: 0.55)),
                      const SizedBox(width: 5),
                      Text(sides,
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.65),
                              fontSize: 12.5)),
                    ],
                  ),
                  const SizedBox(height: SSpace.md),
                  for (final f in ModuleFeatures.highlights(setup))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 5),
                      child: Row(
                        children: [
                          Icon(f.icon,
                              size: 14,
                              color: brand.accent.withValues(alpha: 0.9)),
                          const SizedBox(width: 7),
                          Expanded(
                            child: Text(f.label,
                                style: TextStyle(
                                    color:
                                        Colors.white.withValues(alpha: 0.85),
                                    fontSize: 12.5)),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: SSpace.md),
                  Row(
                    children: [
                      Expanded(
                        child: Wrap(
                          spacing: SSpace.xs,
                          runSpacing: SSpace.xs,
                          children: [
                            for (final m in modules)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 9, vertical: 4),
                                decoration: BoxDecoration(
                                  color:
                                      Colors.white.withValues(alpha: 0.14),
                                  borderRadius:
                                      BorderRadius.circular(SRadius.pill),
                                ),
                                child: Text(m,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600)),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: SSpace.sm),
                      Material(
                        color: brand.accent,
                        borderRadius: BorderRadius.circular(SRadius.pill),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(SRadius.pill),
                          onTap: active ? null : onTry,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 8),
                            child: Text(active ? 'Open' : 'Try it',
                                style: TextStyle(
                                    color: brand.primary,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800)),
                          ),
                        ),
                      ),
                    ],
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
