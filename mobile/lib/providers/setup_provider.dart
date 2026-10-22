import 'package:flutter/foundation.dart';

import '../config/setup.dart';
import '../services/storage_service.dart';

/// Holds the active setup and persists the choice.
///
/// Only meaningful on a build that allows switching — the demo build, or any
/// debug build. A customer's build is locked to its own setup.
class SetupProvider extends ChangeNotifier {
  static const _key = 'active_setup';
  static const _chosenKey = 'setup_chosen';

  PortalSetup get active => CurrentSetup.value;
  bool get switchable => CurrentSetup.switchable;

  bool _chosen = false;

  /// Whether anyone has picked a setup on this install. A demo build asks once
  /// and then behaves like the chosen business until it is changed.
  bool get chosen => _chosen || !CurrentSetup.switchable;

  void load() {
    if (!CurrentSetup.switchable) return;
    try {
      _chosen = storageService.prefs.getBool(_chosenKey) ?? false;
      final saved = storageService.prefs.getString(_key);
      if (saved == null || saved.isEmpty) return;
      final setup = CurrentSetup.byId(saved);
      if (setup != null) {
        CurrentSetup.use(setup);
        notifyListeners();
      }
    } catch (_) {
      // No stored preference, or storage unavailable — stay on the build's.
    }
  }

  Future<void> select(PortalSetup setup) async {
    if (!CurrentSetup.switchable) return;
    CurrentSetup.use(setup);
    _chosen = true;
    notifyListeners();
    try {
      await storageService.prefs.setString(_key, setup.id);
      await storageService.prefs.setBool(_chosenKey, true);
    } catch (_) {
      // The switch still applies for this session.
    }
  }
}
