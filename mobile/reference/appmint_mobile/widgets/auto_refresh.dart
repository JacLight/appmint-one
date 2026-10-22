import 'dart:async';

import 'package:flutter/widgets.dart';

/// Poll only while this route is visible and the app is in the foreground.
/// Read callbacks own their loading/error state; never overlap two polls.
class AutoRefresh extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Duration interval;
  const AutoRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
    this.interval = const Duration(seconds: 5),
  });
  @override
  State<AutoRefresh> createState() => _AutoRefreshState();
}

class _AutoRefreshState extends State<AutoRefresh> with WidgetsBindingObserver {
  Timer? _timer;
  bool _pending = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(widget.interval, (_) => _refresh());
  }

  Future<void> _refresh() async {
    if (!mounted || _pending || !(ModalRoute.of(context)?.isCurrent ?? true))
      return;
    final state = WidgetsBinding.instance.lifecycleState;
    if (state != null && state != AppLifecycleState.resumed) return;
    _pending = true;
    try {
      await widget.onRefresh();
    } finally {
      _pending = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
