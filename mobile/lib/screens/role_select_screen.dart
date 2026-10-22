import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/setup.dart';
import '../config/stowbo_theme.dart';
import '../providers/role_provider.dart';
import 'root_screen.dart';

/// Which side of the business the person is on.
///
/// The words come from the setup's lexicon — a muvmnt build asks about Driver
/// and Customer, a rentals build about Host and Guest — so this screen is
/// shared rather than duplicated per setup. A setup with no provider side
/// never reaches here: [RootScreen] goes straight to the customer shell.
class RoleSelectScreen extends StatelessWidget {
  const RoleSelectScreen({super.key});

  /// An icon that suits the provider side of the setup's home module.
  IconData get _providerIcon => switch (CurrentSetup.value.home) {
        PortalModule.logistics => Icons.local_shipping_rounded,
        PortalModule.rentals => Icons.storefront_rounded,
        PortalModule.scheduling => Icons.event_available_rounded,
        PortalModule.store => Icons.inventory_2_rounded,
        PortalModule.lms => Icons.school_rounded,
        PortalModule.money => Icons.account_balance_rounded,
        PortalModule.property => Icons.domain_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final role = context.read<RoleProvider>();
    final setup = CurrentSetup.value;
    final brand = setup.brand.name;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: SSpace.xl),
              const StowboWordmark(size: 34),
              const SizedBox(height: SSpace.sm),
              Text(
                brand.isEmpty
                    ? 'How are you using the app today?'
                    : 'How are you using $brand today?',
                style: const TextStyle(color: SColors.muted, fontSize: 15),
              ),
              const SizedBox(height: SSpace.xxl),
              _RoleCard(
                icon: Icons.person_rounded,
                accent: SColors.clay,
                title: setup.blurbFor(PortalRole.customer),
                cta: 'Continue as ${setup.labelFor(PortalRole.customer)}',
                onTap: () => role.setRole(AppRole.guest),
              ),
              if (setup.hasProviderSide) ...[
                const SizedBox(height: SSpace.lg),
                _RoleCard(
                  icon: _providerIcon,
                  accent: SColors.green,
                  title: setup.blurbFor(PortalRole.provider),
                  cta: 'Continue as ${setup.labelFor(PortalRole.provider)}',
                  onTap: () => role.setRole(AppRole.host),
                ),
              ],
              const Spacer(),
              const Text(
                'You can switch sides anytime from your account.',
                textAlign: TextAlign.center,
                style: TextStyle(color: SColors.faint, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final IconData icon;
  final Color accent;
  final String title, cta;
  final VoidCallback onTap;

  const _RoleCard({
    required this.icon,
    required this.accent,
    required this.title,
    required this.cta,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: SColors.card,
      borderRadius: BorderRadius.circular(SRadius.xl),
      child: InkWell(
        borderRadius: BorderRadius.circular(SRadius.xl),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(SSpace.xl),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(SRadius.xl),
            border: Border.all(color: SColors.line, width: 1.2),
            boxShadow: SShadow.soft,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(SRadius.md)),
                child: Icon(icon, color: accent, size: 26),
              ),
              const SizedBox(height: SSpace.lg),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: SSpace.lg),
              Row(
                children: [
                  Text(cta,
                      style: TextStyle(
                          color: accent, fontWeight: FontWeight.w700)),
                  const SizedBox(width: 4),
                  Icon(Icons.arrow_forward_rounded, color: accent, size: 18),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
