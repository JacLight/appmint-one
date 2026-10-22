import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/module_features.dart';
import '../config/setup.dart';
import '../config/stowbo_theme.dart';
import '../providers/role_provider.dart';
import '../providers/setup_provider.dart';

/// Everything one setup offers, without having to run it.
///
/// The point of the directory is that you can read the offering and then
/// decide to try it — not install your way through seven businesses to find
/// out what each one does.
class SetupDetailScreen extends StatelessWidget {
  final PortalSetup setup;
  const SetupDetailScreen({super.key, required this.setup});

  @override
  Widget build(BuildContext context) {
    final brand = setup.brand;
    final active = context.watch<SetupProvider>().active.id == setup.id;

    final customerFeatures =
        ModuleFeatures.forSetup(setup, asProvider: false);
    final providerFeatures =
        ModuleFeatures.forSetup(setup, asProvider: true);

    Future<void> tryIt() async {
      final setups = context.read<SetupProvider>();
      await setups.select(setup);
      if (!context.mounted) return;
      context.read<RoleProvider>().clear();
      // Back past the directory too — the app is now this business.
      Navigator.of(context).popUntil((r) => r.isFirst);
    }

    return Scaffold(
      backgroundColor: SColors.paper,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 230,
            pinned: true,
            backgroundColor: brand.primary,
            foregroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(color: brand.primary),
                  Positioned(
                    right: -60,
                    top: -40,
                    child: Container(
                      width: 220,
                      height: 220,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: brand.accent.withValues(alpha: 0.18),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.xl, 0, SSpace.xl, SSpace.xl),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(brand.name.toUpperCase(),
                            style: TextStyle(
                                color: brand.accent,
                                fontSize: 11,
                                letterSpacing: 2,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: SSpace.sm),
                        Text(
                          setup.pitch.isEmpty ? brand.name : setup.pitch,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              height: 1.25,
                              fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(SSpace.xl),
            sliver: SliverList.list(children: [
              _Section(
                title: 'For ${setup.labelFor(PortalRole.customer).toLowerCase()}s',
                features: customerFeatures,
                accent: brand.accent,
              ),
              if (setup.hasProviderSide && providerFeatures.isNotEmpty) ...[
                const SizedBox(height: SSpace.xl),
                _Section(
                  title:
                      'For ${setup.labelFor(PortalRole.provider).toLowerCase()}s',
                  features: providerFeatures,
                  accent: brand.accent,
                ),
              ],
              const SizedBox(height: SSpace.xl),
              _Section(
                title: 'In every setup',
                features: ModuleFeatures.common,
                accent: brand.accent,
              ),
              const SizedBox(height: SSpace.xxl),
            ]),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(SSpace.xl),
        child: FilledButton.icon(
          onPressed: active ? null : tryIt,
          style: FilledButton.styleFrom(
            backgroundColor: brand.primary,
            foregroundColor: Colors.white,
            disabledBackgroundColor: SColors.line,
            disabledForegroundColor: SColors.muted,
            minimumSize: const Size.fromHeight(54),
          ),
          icon: Icon(active
              ? Icons.check_circle_rounded
              : Icons.play_arrow_rounded),
          label: Text(active ? 'You are in this one' : 'Try it live'),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Feature> features;
  final Color accent;
  const _Section({
    required this.title,
    required this.features,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    if (features.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: SSpace.md),
        for (final f in features)
          Padding(
            padding: const EdgeInsets.only(bottom: SSpace.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: f.live
                        ? accent.withValues(alpha: 0.18)
                        : SColors.line2,
                    borderRadius: BorderRadius.circular(SRadius.sm),
                  ),
                  child: Icon(f.icon,
                      size: 17,
                      color: f.live ? SColors.ink : SColors.faint),
                ),
                const SizedBox(width: SSpace.md),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      f.label,
                      style: TextStyle(
                          color: f.live ? SColors.ink : SColors.faint,
                          height: 1.3),
                    ),
                  ),
                ),
                // Say plainly which parts are not built, rather than letting
                // the list read as a promise.
                if (!f.live)
                  Padding(
                    padding: const EdgeInsets.only(top: 7),
                    child: Text('soon',
                        style: const TextStyle(
                            color: SColors.faint,
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
