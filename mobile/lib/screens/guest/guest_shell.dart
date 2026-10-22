import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/checkout_provider.dart';
import '../../providers/custody_provider.dart';
import '../../providers/discovery_provider.dart';
import '../../widgets/stowbo_widgets.dart';
import 'browse_screen.dart';
import 'my_stuff_screen.dart';
import '../chat/inbox_screen.dart';
import '../account_screen.dart';

class GuestShell extends StatefulWidget {
  const GuestShell({super.key});
  @override
  State<GuestShell> createState() => _GuestShellState();
}

class _GuestShellState extends State<GuestShell> {
  int _index = 0;
  bool _navVisible = true;

  // Auto-hide the floating nav: hide while scrolling down into content, reveal
  // when scrolling back up or resting at the very top / bottom of the list.
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DiscoveryProvider>().load();
      context.read<DiscoveryProvider>().locate();
      // Ask the server whether this customer has an unfinished purchase, so we
      // can offer to resume it (started on this or another device).
      context.read<CheckoutProvider>().refreshResume();
      final uid = context.read<AuthProvider>().user?.id;
      if (uid != null) context.read<CustodyProvider>().loadForGuest(uid);
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = const [
      BrowseScreen(),
      MyStuffScreen(),
      InboxScreen(),
      AccountScreen()
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
              onSelect: (i) => setState(() => _index = i),
              items: const [
                StowboNavItem(
                    Icons.search_rounded, Icons.search_rounded, 'Browse'),
                StowboNavItem(Icons.backpack_outlined,
                    Icons.backpack_rounded, 'My stuff'),
                StowboNavItem(
                    Icons.forum_outlined, Icons.forum_rounded, 'Messages'),
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
