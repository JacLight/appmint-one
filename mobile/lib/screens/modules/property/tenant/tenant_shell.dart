import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/tenancy_provider.dart';
import '../../../account_screen.dart';
import 'notices_screen.dart';
import 'tenant_home_screen.dart';
import 'tenant_pay_screen.dart';
import 'tenant_requests_screen.dart';

/// The resident's app: home, rent, repairs, notices, account.
class TenantShell extends StatefulWidget {
  const TenantShell({super.key});

  @override
  State<TenantShell> createState() => _TenantShellState();
}

class _TenantShellState extends State<TenantShell> {
  int _index = 0;

  void _go(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    final t = context.watch<TenancyProvider>();
    final words = CurrentSetup.words;
    final brand = CurrentSetup.brand;

    return TenantShellScope(
      goToPay: () => _go(1),
      goToRequests: () => _go(2),
      goToNotices: () => _go(3),
      child: Scaffold(
        backgroundColor: SColors.paper,
        body: IndexedStack(
          index: _index,
          children: const [
            TenantHomeScreen(),
            TenantPayScreen(),
            TenantRequestsScreen(),
            NoticesScreen(),
            AccountScreen(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _go,
          backgroundColor: SColors.card,
          indicatorColor: brand.accent.withValues(alpha: 0.22),
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            const NavigationDestination(
              icon: Icon(Icons.payments_outlined),
              selectedIcon: Icon(Icons.payments_rounded),
              label: 'Rent',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: t.openRequests.isNotEmpty,
                label: Text('${t.openRequests.length}'),
                child: const Icon(Icons.build_outlined),
              ),
              selectedIcon: Badge(
                isLabelVisible: t.openRequests.isNotEmpty,
                label: Text('${t.openRequests.length}'),
                child: const Icon(Icons.build_rounded),
              ),
              label: words.term(LexiconKeys.requests),
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: t.unreadNotices > 0,
                label: Text('${t.unreadNotices}'),
                child: const Icon(Icons.campaign_outlined),
              ),
              selectedIcon: Badge(
                isLabelVisible: t.unreadNotices > 0,
                label: Text('${t.unreadNotices}'),
                child: const Icon(Icons.campaign_rounded),
              ),
              label: 'Notices',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded),
              label: 'Account',
            ),
          ],
        ),
      ),
    );
  }
}
