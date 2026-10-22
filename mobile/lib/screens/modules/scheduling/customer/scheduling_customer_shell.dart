import 'package:flutter/material.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../account_screen.dart';
import '../../../chat/inbox_screen.dart';
import 'my_bookings_screen.dart';

/// Customer side of the scheduling module.
class SchedulingCustomerShell extends StatefulWidget {
  const SchedulingCustomerShell({super.key});
  @override
  State<SchedulingCustomerShell> createState() =>
      _SchedulingCustomerShellState();
}

class _SchedulingCustomerShellState extends State<SchedulingCustomerShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    const tabs = [MyBookingsScreen(), InboxScreen(), AccountScreen()];

    return Scaffold(
      backgroundColor: SColors.paper,
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: SColors.card,
        indicatorColor: SColors.claySoft,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.event_available_outlined),
            selectedIcon: const Icon(Icons.event_available_rounded),
            label: CurrentSetup.term(LexiconKeys.bookings),
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
