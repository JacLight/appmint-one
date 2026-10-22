import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/store_provider.dart';
import '../../../account_screen.dart';
import '../../../chat/inbox_screen.dart';
import 'browse_screen.dart';
import 'cart_screen.dart';

/// Customer side of the store module.
class StoreCustomerShell extends StatefulWidget {
  const StoreCustomerShell({super.key});
  @override
  State<StoreCustomerShell> createState() => _StoreCustomerShellState();
}

class _StoreCustomerShellState extends State<StoreCustomerShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final count = context.watch<StoreProvider>().cartCount;
    const tabs = [
      BrowseScreen(),
      CartScreen(),
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
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront_rounded),
            label: 'Browse',
          ),
          NavigationDestination(
            // The badge is the one thing people look for after adding
            // something, so it belongs on the icon, not a separate banner.
            icon: Badge(
              isLabelVisible: count > 0,
              label: Text('$count'),
              child: const Icon(Icons.shopping_bag_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: count > 0,
              label: Text('$count'),
              child: const Icon(Icons.shopping_bag_rounded),
            ),
            label: 'Cart',
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
