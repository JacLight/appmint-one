import 'package:flutter/material.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../account_screen.dart';
import '../../../chat/inbox_screen.dart';
import 'my_deliveries_screen.dart';
import 'order_screen.dart';

/// Customer side of the logistics module.
///
/// Account, chat and support are the shared screens — this module adds only
/// ordering and tracking.
class LogisticsCustomerShell extends StatefulWidget {
  const LogisticsCustomerShell({super.key});
  @override
  State<LogisticsCustomerShell> createState() =>
      _LogisticsCustomerShellState();
}

class _LogisticsCustomerShellState extends State<LogisticsCustomerShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final jobs = CurrentSetup.term(LexiconKeys.jobs);

    final tabs = const [
      OrderScreen(),
      MyDeliveriesScreen(),
      InboxScreen(),
      AccountScreen(),
    ];

    return Scaffold(
      backgroundColor: SColors.paper,
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: SColors.card,
        indicatorColor: SColors.claySoft,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.add_circle_outline_rounded),
            selectedIcon: Icon(Icons.add_circle_rounded),
            label: 'Book',
          ),
          NavigationDestination(
            icon: const Icon(Icons.local_shipping_outlined),
            selectedIcon: const Icon(Icons.local_shipping_rounded),
            label: jobs,
          ),
          const NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Messages',
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
