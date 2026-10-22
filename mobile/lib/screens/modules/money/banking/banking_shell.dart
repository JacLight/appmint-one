import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../account_screen.dart';
import 'accounts_screen.dart';
import 'loans_screen.dart';
import 'move_money_screen.dart';
import 'payees_screen.dart';

/// The bank app: accounts, moving money, borrowing, payees, account.
class BankingShell extends StatefulWidget {
  const BankingShell({super.key});

  @override
  State<BankingShell> createState() => _BankingShellState();
}

class _BankingShellState extends State<BankingShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final unverified = b.payees.length - b.verifiedPayees.length;
    // A loan behind on payment, or an offer the bank is waiting on an answer
    // to, are both things somebody needs to see without opening the tab.
    final needsAttention = b.pastDueLoans.length + b.counteroffersPending.length;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: IndexedStack(
        index: _index,
        children: [
          const AccountsScreen(),
          // Opening Move money from the bar always starts on a transfer; the
          // screen itself switches between the three.
          MoveMoneyScreen(
            mode: MoveMode.transfer,
            key: ValueKey('move-${b.accounts.length}'),
          ),
          const LoansScreen(),
          const PayeesScreen(),
          const AccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: SColors.card,
        indicatorColor: brand.accent.withValues(alpha: 0.22),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.account_balance_outlined),
            selectedIcon: Icon(Icons.account_balance_rounded),
            label: 'Accounts',
          ),
          const NavigationDestination(
            icon: Icon(Icons.swap_horiz_outlined),
            selectedIcon: Icon(Icons.swap_horiz_rounded),
            label: 'Move',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: needsAttention > 0,
              label: Text('$needsAttention'),
              child: const Icon(Icons.request_quote_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: needsAttention > 0,
              label: Text('$needsAttention'),
              child: const Icon(Icons.request_quote_rounded),
            ),
            label: 'Loans',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unverified > 0,
              label: Text('$unverified'),
              child: const Icon(Icons.people_alt_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: unverified > 0,
              label: Text('$unverified'),
              child: const Icon(Icons.people_alt_rounded),
            ),
            label: 'Payees',
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
