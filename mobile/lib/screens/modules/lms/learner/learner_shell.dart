import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/learning_provider.dart';
import '../../../account_screen.dart';
import '../../../chat/inbox_screen.dart';
import 'catalog_screen.dart';
import 'my_learning_screen.dart';

/// The learner's app: browse, what I am on, messages, account.
class LearnerShell extends StatefulWidget {
  const LearnerShell({super.key});

  @override
  State<LearnerShell> createState() => _LearnerShellState();
}

class _LearnerShellState extends State<LearnerShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l = context.watch<LearningProvider>();
    final brand = CurrentSetup.brand;
    final going = l.inProgress.length;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: IndexedStack(
        index: _index,
        children: const [
          CatalogScreen(),
          MyLearningScreen(),
          InboxScreen(),
          AccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: SColors.card,
        indicatorColor: brand.accent.withValues(alpha: 0.22),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded),
            label: 'Browse',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: going > 0,
              label: Text('$going'),
              child: const Icon(Icons.school_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: going > 0,
              label: Text('$going'),
              child: const Icon(Icons.school_rounded),
            ),
            label: 'Learning',
          ),
          const NavigationDestination(
            icon: Icon(Icons.forum_outlined),
            selectedIcon: Icon(Icons.forum_rounded),
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
