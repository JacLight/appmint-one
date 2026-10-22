import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/stripe_terminal_service.dart';
import '../../providers/custody_provider.dart';
import '../../widgets/stowbo_widgets.dart';
import 'host_control_center_screen.dart';
import 'host_bookings_screen.dart';
import 'host_money_screen.dart';
import 'host_listings_screen.dart';
import '../chat/inbox_screen.dart';
import '../account_screen.dart';

/// The host shell's selected tab. Any screen can switch tabs by setting this
/// (e.g. a home summary card jumping to Money) — which keeps the bottom nav
/// and makes "back to home" one tap on the Home tab, instead of pushing a
/// dead-end route. Indices: 0 Home · 1 Queue · 2 Money · 3 Messages ·
/// 4 Listings · 5 Account.
final ValueNotifier<int> hostTabIndex = ValueNotifier<int>(0);

/// The bottom nav is a FIXED floating pill (the shell uses extendBody: true, so
/// tab content runs behind it). Any bottom-anchored button on a tab screen — a
/// FAB, a pinned bar — must clear it or it sits UNDER the nav. Add this to the
/// device's bottom safe-area for the total clearance:
///   EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom + kHostNavClearance)
const double kHostNavClearance = 74;

class HostShell extends StatefulWidget {
  const HostShell({super.key});
  @override
  State<HostShell> createState() => _HostShellState();
}

class _HostShellState extends State<HostShell> {
  int _index = 0;
  bool _navVisible = true;

  void _onTabSignal() {
    if (mounted && hostTabIndex.value != _index) {
      setState(() {
        _index = hostTabIndex.value;
        _navVisible = true;
      });
    }
  }

  bool _onScroll(ScrollNotification n) {
    if (n is UserScrollNotification && n.metrics.axis == Axis.vertical) {
      if (n.direction == ScrollDirection.reverse && _navVisible) {
        setState(() => _navVisible = false);
      } else if (n.direction == ScrollDirection.forward && !_navVisible) {
        setState(() => _navVisible = true);
      }
    }
    if (n is ScrollUpdateNotification && !_navVisible) {
      final m = n.metrics;
      if (m.pixels <= m.minScrollExtent + 4 ||
          m.pixels >= m.maxScrollExtent - 4) {
        setState(() => _navVisible = true);
      }
    }
    return false;
  }

  @override
  void initState() {
    super.initState();
    hostTabIndex.value = _index;
    hostTabIndex.addListener(_onTabSignal);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _reload();
      stripeTerminalService.restoreConnection();
    });
  }

  @override
  void dispose() {
    hostTabIndex.removeListener(_onTabSignal);
    super.dispose();
  }

  void _reload() {
    final uid = context.read<AuthProvider>().user?.id;
    if (uid != null) context.read<CustodyProvider>().loadForHost(uid);
  }

  @override
  Widget build(BuildContext context) {
    final pages = const [
      HostControlCenterScreen(),
      HostBookingsScreen(),
      HostMoneyScreen(),
      InboxScreen(),
      HostListingsScreen(),
      AccountScreen(),
    ];
    return Scaffold(
      extendBody: true,
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: IndexedStack(index: _index, children: pages),
      ),
      bottomNavigationBar: AnimatedSlide(
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
        offset: _navVisible ? Offset.zero : const Offset(0, 1.6),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: _navVisible ? 1 : 0,
          child: IgnorePointer(
            ignoring: !_navVisible,
            child: StowboNavBar(
              index: _index,
              onSelect: (i) => hostTabIndex.value = i,
              items: const [
                StowboNavItem(Icons.dashboard_outlined,
                    Icons.dashboard_rounded, 'Home'),
                StowboNavItem(Icons.event_note_outlined,
                    Icons.event_note_rounded, 'Bookings'),
                StowboNavItem(Icons.account_balance_wallet_outlined,
                    Icons.account_balance_wallet_rounded, 'Money'),
                StowboNavItem(
                    Icons.forum_outlined, Icons.forum_rounded, 'Messages'),
                StowboNavItem(Icons.storefront_outlined,
                    Icons.storefront_rounded, 'Listings'),
                StowboNavItem(Icons.person_outline_rounded,
                    Icons.person_rounded, 'Account'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
