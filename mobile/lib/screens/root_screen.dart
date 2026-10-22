import 'package:flutter/material.dart';
import 'setup_directory_screen.dart';
import 'package:provider/provider.dart';
import '../config/setup.dart';
import '../config/stowbo_theme.dart';
import '../widgets/brand_wordmark.dart';
import '../providers/auth_provider.dart';
import '../providers/role_provider.dart';
import '../providers/setup_provider.dart';
import 'auth/login_screen.dart';
import 'role_select_screen.dart';
import 'guest/guest_shell.dart';
import 'host/host_shell.dart';
import 'modules/logistics/customer/logistics_customer_shell.dart';
import 'modules/money/banking/banking_shell.dart';
import 'modules/scheduling/customer/scheduling_customer_shell.dart';
import 'modules/store/customer/store_customer_shell.dart';
import 'modules/scheduling/provider/scheduling_provider_shell.dart';
import 'modules/logistics/provider/driver_shell.dart';
import 'modules/property/manager/manager_shell.dart';
import 'modules/property/tenant/tenant_shell.dart';
import 'modules/lms/learner/learner_shell.dart';

/// Decides what to show based on auth + chosen role.
class RootScreen extends StatelessWidget {
  const RootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final role = context.watch<RoleProvider>();
    final setups = context.watch<SetupProvider>();

    // A demo build opens by asking which business to be — showing a sign-in
    // form first would say nothing about what this app is.
    if (!setups.chosen) return const SetupDirectoryScreen(welcome: true);

    switch (auth.status) {
      case AuthStatus.initial:
        return const _Splash();
      case AuthStatus.unauthenticated:
        return const LoginScreen();
      case AuthStatus.authenticated:
        final setup = CurrentSetup.value;
        // A setup with no provider side never asks which side you are on.
        final Widget shell;
        if (!setup.hasProviderSide) {
          shell = _customerShell(setup);
        } else if (!role.chosen) {
          shell = const RoleSelectScreen();
        } else {
          shell = role.role == AppRole.host
              ? _providerShell(setup)
              : _customerShell(setup);
        }
        // Looking around is never allowed to look like being signed in.
        return auth.exploring ? _Exploring(child: shell) : shell;
    }
  }
}

/// The customer-facing shell for whichever module this setup opens into.
Widget _customerShell(PortalSetup setup) => switch (setup.home) {
      PortalModule.logistics => const LogisticsCustomerShell(),
      PortalModule.rentals => const GuestShell(),
      PortalModule.money => const BankingShell(),
      PortalModule.scheduling => const SchedulingCustomerShell(),
      PortalModule.store => const StoreCustomerShell(),
      PortalModule.property => const TenantShell(),
      PortalModule.lms => const LearnerShell(),
      // No wildcard: every module now has a customer side, and the analyzer
      // is the thing that will say so the next time one is added.
    };

Widget _providerShell(PortalSetup setup) => switch (setup.home) {
      PortalModule.logistics => const DriverShell(),
      PortalModule.rentals => const HostShell(),
      PortalModule.money => const BankingShell(),
      PortalModule.scheduling => const SchedulingProviderShell(),
      PortalModule.property => const ManagerShell(),
      _ => _ModuleNotBuilt(module: setup.home, provider: true),
    };

/// The bar that sits above everything during a look-around.
///
/// It is permanent on purpose. Someone walking the app without an account
/// must never wonder which they are — and the way out is on the same bar,
/// not buried in the account screen.
class _Exploring extends StatelessWidget {
  final Widget child;
  const _Exploring({required this.child});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;

    return Material(
      color: SColors.paper,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            color: brand.primary,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    SSpace.lg, SSpace.sm, SSpace.sm, SSpace.sm),
                child: Row(
                  children: [
                    Icon(Icons.visibility_rounded,
                        size: 15, color: brand.accent),
                    const SizedBox(width: SSpace.sm),
                    const Expanded(
                      child: Text(
                        'Looking around — not signed in',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                    TextButton(
                      onPressed: () =>
                          context.read<AuthProvider>().stopExploring(),
                      style: TextButton.styleFrom(
                        foregroundColor: brand.accent,
                        padding: const EdgeInsets.symmetric(
                            horizontal: SSpace.md, vertical: 0),
                        minimumSize: const Size(0, 32),
                      ),
                      child: const Text('Sign in',
                          style: TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 12.5)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// A module the setup switched on whose screens are not built yet.
///
/// This must never be a dead end. Without a way out, a demo build that opens
/// on an unbuilt module strands the person on a screen with no navigation at
/// all — which is exactly what happened.
class _ModuleNotBuilt extends StatelessWidget {
  final PortalModule module;
  final bool provider;
  const _ModuleNotBuilt({required this.module, required this.provider});

  @override
  Widget build(BuildContext context) {
    final name = module.name;
    final side = provider ? 'provider' : 'customer';
    final role = context.read<RoleProvider>();

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(SSpace.xxl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.construction_rounded,
                    size: 38, color: SColors.faint),
                const SizedBox(height: SSpace.lg),
                Text('Not available yet',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: SSpace.sm),
                Text(
                  'The $name module is switched on for this setup, but its '
                  '$side screens have not been built yet.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: SColors.muted, height: 1.4),
                ),
                const SizedBox(height: SSpace.xxl),
                if (CurrentSetup.switchable)
                  FilledButton.icon(
                    onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const SetupDirectoryScreen())),
                    icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                    label: const Text('Switch setup'),
                  ),
                if (CurrentSetup.value.hasProviderSide) ...[
                  const SizedBox(height: SSpace.sm),
                  TextButton(
                    onPressed: role.clear,
                    child: const Text('Change side'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SColors.paper,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _Wordmark(size: 40),
            const SizedBox(height: SSpace.xl),
            Text('Stow it. Go enjoy. Grab it later.',
                style: TextStyle(color: SColors.muted)),
            const SizedBox(height: SSpace.xxl),
            const CircularProgressIndicator(
                color: SColors.clay, strokeWidth: 2.5),
          ],
        ),
      ),
    );
  }
}

class _Wordmark extends StatelessWidget {
  final double size;
  const _Wordmark({this.size = 32});
  @override
  Widget build(BuildContext context) => BrandWordmark(size: size);
}

/// Kept as a name other screens already import. The artwork itself comes from
/// [BrandWordmark], which resolves per setup.
class StowboWordmark extends StatelessWidget {
  final double size;
  const StowboWordmark({super.key, this.size = 32});
  @override
  Widget build(BuildContext context) => BrandWordmark(size: size);
}
