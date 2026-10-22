import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stripe_terminal_service.dart';
import '../../widgets/stowbo_widgets.dart';
import 'card_reader_screen.dart';
import 'host_payout_methods_screen.dart';
import 'host_transactions_screen.dart';
import 'host_wallet_screen.dart';
import 'take_payment_sheet.dart';

/// The host's money hub — a dedicated section: Wallet (balance + payouts) and
/// Transactions (everything collected + pending, with refunds and cancels).
/// "Take payment" lives here as the primary action.
class HostMoneyScreen extends StatefulWidget {
  const HostMoneyScreen({super.key});
  @override
  State<HostMoneyScreen> createState() => _HostMoneyScreenState();
}

class _HostMoneyScreenState extends State<HostMoneyScreen>
    with SingleTickerProviderStateMixin {
  // Bumped after a collection so the embedded Wallet/Transactions remount and
  // reload — otherwise a payment taken here didn't show until a manual refresh.
  int _rev = 0;
  // Also bumped when the operator switches tabs, so Wallet re-reads its totals
  // after a refund or payment made on the Transactions tab (and vice versa).
  late final TabController _tabs = TabController(length: 2, vsync: this)
    ..addListener(() {
      if (!_tabs.indexIsChanging && mounted) setState(() => _rev++);
    });

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _takePayment() async {
    final ok = await TakePaymentSheet.show(context);
    if (ok == true && mounted) setState(() => _rev++);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text('Money'),
          actions: [
            // Where the money goes. Without a destination here a payout request
            // is refused, so it sits beside the reader rather than buried.
            IconButton(
              tooltip: 'Payout destinations',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const HostPayoutMethodsScreen()),
              ),
              icon: const Icon(Icons.account_balance_outlined),
            ),
            // Live reader status: green + filled when a reader is paired,
            // muted outline when not. Taps through to the pairing screen.
            ValueListenableBuilder<int>(
              valueListenable: stripeTerminalService.connectionRevision,
              builder: (context, _, __) {
                final on = stripeTerminalService.isConnected;
                return IconButton(
                  tooltip: on ? 'Card reader — connected' : 'Pair a card reader',
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CardReaderScreen()),
                  ),
                  icon: Icon(
                    on
                        ? Icons.contactless_rounded
                        : Icons.contactless_outlined,
                    color: on ? SColors.green : SColors.muted,
                  ),
                );
              },
            ),
          ],
          bottom: TabBar(
            controller: _tabs,
            labelColor: SColors.clay,
            unselectedLabelColor: SColors.muted,
            indicatorColor: SColors.clay,
            tabs: [
              Tab(text: 'Wallet'),
              Tab(text: 'Transactions'),
            ],
          ),
        ),
        // Compact action buttons (not a full-width bar, not a hidden FAB) — a
        // Wrap so more actions can join later. Pinned above the tabs so it's
        // always reachable.
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, SSpace.sm, SSpace.lg, SSpace.sm),
                  child: Wrap(
                    spacing: SSpace.sm,
                    runSpacing: SSpace.sm,
                    children: [
                      SActionButton(
                        icon: Icons.contactless_rounded,
                        label: 'Take payment',
                        onTap: _takePayment,
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: [
                    HostWalletScreen(key: ValueKey('wallet_$_rev'), embedded: true),
                    HostTransactionsScreen(
                        key: ValueKey('tx_$_rev'), embedded: true),
                  ],
                ),
              ),
            ],
          ),
        ),
    );
  }
}
