import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/sla_policy.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../../account_screen.dart';
import 'announcements_screen.dart';
import 'leasing_screen.dart';
import 'manager_requests_screen.dart';
import 'portfolio_screen.dart';

/// The manager's app: portfolio, leasing, request queue, announcements.
class ManagerShell extends StatefulWidget {
  const ManagerShell({super.key});

  @override
  State<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends State<ManagerShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final words = CurrentSetup.words;
    final brand = CurrentSetup.brand;

    final overdue = [
      for (final r in p.requests)
        if (!SlaPolicy.closed('${r['status'] ?? ''}') &&
            SlaClock.of(r).breached)
          r
    ].length;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: IndexedStack(
        index: _index,
        children: const [
          PortfolioScreen(),
          LeasingScreen(),
          ManagerRequestsScreen(),
          AnnouncementsScreen(),
          AccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: SColors.card,
        indicatorColor: brand.accent.withValues(alpha: 0.22),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.domain_outlined),
            selectedIcon: const Icon(Icons.domain_rounded),
            label: words.term(LexiconKeys.properties),
          ),
          const NavigationDestination(
            icon: Icon(Icons.how_to_reg_outlined),
            selectedIcon: Icon(Icons.how_to_reg_rounded),
            label: 'Leasing',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: overdue > 0,
              backgroundColor: SColors.danger,
              label: Text('$overdue'),
              child: const Icon(Icons.build_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: overdue > 0,
              backgroundColor: SColors.danger,
              label: Text('$overdue'),
              child: const Icon(Icons.build_rounded),
            ),
            label: words.term(LexiconKeys.requests),
          ),
          const NavigationDestination(
            icon: Icon(Icons.campaign_outlined),
            selectedIcon: Icon(Icons.campaign_rounded),
            label: 'Notices',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}
