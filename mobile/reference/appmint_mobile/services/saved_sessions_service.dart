import 'storage_service.dart';

/// One remembered account the user has signed into. Mirrors the desktop
/// `orgSessions` store (websitemint AccountPage) so the user can sign back in
/// with a single tap after logout.
class SavedSession {
  final String orgId;
  final String email;
  final String name;
  final String? avatar;
  final String accessToken;
  final String refreshToken;
  final int lastUsed;
  final bool expired;

  const SavedSession({
    required this.orgId,
    required this.email,
    required this.name,
    this.avatar,
    required this.accessToken,
    required this.refreshToken,
    required this.lastUsed,
    this.expired = false,
  });

  /// A tap can sign in silently only when we still hold a refresh token.
  bool get canQuickSignIn => !expired && refreshToken.isNotEmpty;

  String get initials {
    final source = name.trim().isNotEmpty ? name.trim() : email.trim();
    if (source.isEmpty) return 'U';
    final parts = source.split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[1].isNotEmpty) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.substring(0, source.length >= 2 ? 2 : 1).toUpperCase();
  }

  Map<String, dynamic> toJson() => {
        'orgId': orgId,
        'email': email,
        'name': name,
        'avatar': avatar,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'lastUsed': lastUsed,
        'expired': expired,
      };

  factory SavedSession.fromJson(Map<String, dynamic> json) => SavedSession(
        orgId: json['orgId']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        avatar: json['avatar']?.toString(),
        accessToken: json['accessToken']?.toString() ?? '',
        refreshToken: json['refreshToken']?.toString() ?? '',
        lastUsed: (json['lastUsed'] is num) ? (json['lastUsed'] as num).toInt() : 0,
        expired: json['expired'] == true,
      );

  SavedSession copyWith({
    String? email,
    String? name,
    String? avatar,
    String? accessToken,
    String? refreshToken,
    int? lastUsed,
    bool? expired,
  }) =>
      SavedSession(
        orgId: orgId,
        email: email ?? this.email,
        name: name ?? this.name,
        avatar: avatar ?? this.avatar,
        accessToken: accessToken ?? this.accessToken,
        refreshToken: refreshToken ?? this.refreshToken,
        lastUsed: lastUsed ?? this.lastUsed,
        expired: expired ?? this.expired,
      );
}

/// Persistent list of accounts the user has signed into. Stored under a key
/// that logout's [StorageService.clearAll] deliberately preserves, so the
/// login screen can offer one-tap sign-in after signing out.
class SavedSessionsService {
  static const storageKey = 'saved_sessions';
  final StorageService _storage = StorageService();

  Future<Map<String, SavedSession>> _readAll() async {
    await _storage.initialize();
    final raw = await _storage.getSetting(storageKey);
    final out = <String, SavedSession>{};
    if (raw is Map) {
      raw.forEach((k, v) {
        if (v is Map) {
          out[k.toString()] = SavedSession.fromJson(Map<String, dynamic>.from(v));
        }
      });
    }
    return out;
  }

  Future<void> _writeAll(Map<String, SavedSession> all) async {
    final map = all.map((k, v) => MapEntry(k, v.toJson()));
    await _storage.saveSetting(storageKey, map);
  }

  /// Sessions, most recently used first.
  Future<List<SavedSession>> getAllSorted() async {
    final all = await _readAll();
    final list = all.values.toList()
      ..sort((a, b) => b.lastUsed.compareTo(a.lastUsed));
    return list;
  }

  /// Save/update the session for an org — call on every successful sign-in and
  /// token refresh so the saved tokens stay fresh.
  Future<void> save(SavedSession session) async {
    final all = await _readAll();
    all[session.orgId] = session;
    await _writeAll(all);
  }

  Future<void> remove(String orgId) async {
    final all = await _readAll();
    all.remove(orgId);
    await _writeAll(all);
  }

  /// Tokens are dead — keep the row (so the user sees the account) but force a
  /// password sign-in next time.
  Future<void> markExpired(String orgId) async {
    final all = await _readAll();
    final s = all[orgId];
    if (s == null) return;
    all[orgId] = s.copyWith(accessToken: '', refreshToken: '', expired: true);
    await _writeAll(all);
  }
}

final savedSessionsService = SavedSessionsService();
