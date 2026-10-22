import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

/// In-app toast notifications fired from anywhere (providers, services)
/// without needing a BuildContext. Used for chat queue alerts, chat-ended
/// notices, and other events the user should see when a phone-level push
/// notification isn't possible (app foregrounded, on a different screen).
///
/// Usage:
///   1. Attach `appNotificationService.scaffoldMessengerKey` to MaterialApp's
///      `scaffoldMessengerKey:` parameter in main.dart.
///   2. From anywhere call `appNotificationService.show('text')`.
///
/// Screens that "own" certain events can register their visibility via
/// `pushScreen('chat:CUSTOMER_EMAIL')` so duplicate toasts can be suppressed
/// while the user is already looking at that conversation.
class AppNotificationService {
  static final AppNotificationService _instance = AppNotificationService._internal();
  factory AppNotificationService() => _instance;
  AppNotificationService._internal();

  /// Attach to MaterialApp(scaffoldMessengerKey: this).
  final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
      GlobalKey<ScaffoldMessengerState>();

  /// Attach to MaterialApp(navigatorKey: this). Lets services pop back to
  /// the root route (e.g. on forced logout) without needing a BuildContext.
  /// Without this, an auth-expired error inside a pushed screen would leave
  /// the user staring at a frozen page even after AuthProvider has flipped
  /// to unauthenticated — the AuthWrapper is buried under the nav stack.
  final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  // Track which screens are currently visible. The latest pushed screen is
  // the one the user can see. Screens self-register in initState/dispose.
  // Format is freeform: e.g. 'chat:demo@appmint.io', 'queue', 'home'.
  final List<String> _visibleScreens = [];

  void pushScreen(String screen) {
    _visibleScreens.add(screen);
  }

  void popScreen(String screen) {
    final i = _visibleScreens.lastIndexOf(screen);
    if (i >= 0) _visibleScreens.removeAt(i);
  }

  /// True if any screen matching [match] is currently visible.
  /// Used by event handlers to decide whether to show a toast or stay silent.
  bool isAnyVisible(bool Function(String screen) match) {
    return _visibleScreens.any(match);
  }

  String? get topScreen => _visibleScreens.isNotEmpty ? _visibleScreens.last : null;

  /// Whether this device is set up for live chat (main.dart wires it to the
  /// device's app switches). A device without it, such as a prep display or a
  /// front desk, gets no chat or queue toasts: they belong to the agents'
  /// devices, and the person's other devices would otherwise all pop them.
  bool Function()? liveChatOnDevice;

  /// Show a toast/snackbar. Safe to call from any provider, any thread.
  /// Returns true if shown, false if no Scaffold is mounted yet.
  /// [chatEvent] marks a live-chat alert of another kind (chat ended).
  bool show(
    String message, {
    NotificationKind kind = NotificationKind.info,
    Duration duration = const Duration(seconds: 4),
    SnackBarAction? action,
    bool chatEvent = false,
  }) {
    if ((chatEvent ||
            kind == NotificationKind.chat ||
            kind == NotificationKind.queue) &&
        liveChatOnDevice?.call() == false) {
      return false;
    }
    final messenger = scaffoldMessengerKey.currentState;
    if (messenger == null) {
      if (kDebugMode) debugPrint('AppNotificationService: no ScaffoldMessenger mounted; dropping "$message"');
      return false;
    }

    Color bg;
    IconData icon;
    switch (kind) {
      case NotificationKind.info:
        bg = const Color(0xFF1F2937); // dark slate
        icon = Icons.info_outline;
        break;
      case NotificationKind.success:
        bg = const Color(0xFF065F46); // emerald-800
        icon = Icons.check_circle_outline;
        break;
      case NotificationKind.warning:
        bg = const Color(0xFFB45309); // amber-700
        icon = Icons.warning_amber_outlined;
        break;
      case NotificationKind.error:
        bg = const Color(0xFFB91C1C); // red-700
        icon = Icons.error_outline;
        break;
      case NotificationKind.chat:
        bg = const Color(0xFF1D4ED8); // blue-700
        icon = Icons.chat_bubble_outline;
        break;
      case NotificationKind.queue:
        bg = const Color(0xFF7C3AED); // violet-600
        icon = Icons.people_alt_outlined;
        break;
    }

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Row(children: [
          Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(message, style: const TextStyle(color: Colors.white, fontSize: 14)),
          ),
        ]),
        backgroundColor: bg,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(12),
        duration: duration,
        action: action,
      ),
    );
    return true;
  }
}

enum NotificationKind { info, success, warning, error, chat, queue }

final appNotificationService = AppNotificationService();
