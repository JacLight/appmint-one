import 'package:flutter/foundation.dart';
import '../services/storage_service.dart';

enum AppRole { guest, host }

/// Which side of the marketplace the user is currently in. Persisted so the
/// app reopens where they left off. Same person can switch freely.
class RoleProvider extends ChangeNotifier {
  final StorageService _storage = storageService;
  AppRole? _role;

  AppRole? get role => _role;
  bool get chosen => _role != null;

  void load() {
    final saved = _storage.getRole();
    _role = saved == 'host'
        ? AppRole.host
        : saved == 'guest'
            ? AppRole.guest
            : null;
    notifyListeners();
  }

  Future<void> setRole(AppRole role) async {
    _role = role;
    await _storage.saveRole(role == AppRole.host ? 'host' : 'guest');
    notifyListeners();
  }

  void clear() {
    _role = null;
    notifyListeners();
  }
}
