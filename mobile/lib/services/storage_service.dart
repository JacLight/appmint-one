import 'dart:convert';
import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/environment.dart';
import '../models/app_user.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  final _secure = const FlutterSecureStorage();
  SharedPreferences? _prefs;

  // Payment payloads and keys belong in the same secure store as credentials,
  // never SharedPreferences. Serialize changes so concurrent intents cannot
  // overwrite each other's recovery records.
  static const _bankingIntentKey = 'appmint.banking.unresolved-intents.v1';
  Future<void> _bankingIntentQueue = Future.value();

  Future<T> _withBankingIntents<T>(
    Future<T> Function(Map<String, String>) run,
  ) {
    final result = Completer<T>();
    _bankingIntentQueue = _bankingIntentQueue.then((_) async {
      try {
        final raw = await _secure.read(key: _bankingIntentKey);
        final decoded = raw == null ? <String, dynamic>{} : jsonDecode(raw);
        if (decoded is! Map || decoded.values.any((value) => value is! String))
          throw StateError('Payment recovery storage is invalid.');
        final intents = Map<String, String>.from(decoded);
        result.complete(await run(intents));
      } catch (error, stack) {
        result.completeError(error, stack);
      }
    });
    return result.future;
  }

  Future<String> getOrCreateBankingIntent(
    String scopedIntent,
    String Function() makeKey,
  ) => _withBankingIntents((intents) async {
    final existing = intents[scopedIntent];
    if (existing != null && existing.isNotEmpty) return existing;
    final key = makeKey();
    intents[scopedIntent] = key;
    await _secure.write(key: _bankingIntentKey, value: jsonEncode(intents));
    return key;
  });

  Future<void> removeBankingIntent(String scopedIntent) => _withBankingIntents((
    intents,
  ) async {
    intents.remove(scopedIntent);
    if (intents.isEmpty) {
      await _secure.delete(key: _bankingIntentKey);
    } else {
      await _secure.write(key: _bankingIntentKey, value: jsonEncode(intents));
    }
  });

  Future<String?> bankingProof(String scopedKey) =>
      _withBankingIntents((intents) async => intents['proof:$scopedKey']);

  Future<void> saveBankingProof(String scopedKey, String proof) =>
      _withBankingIntents((intents) async {
        intents['proof:$scopedKey'] = proof;
        await _secure.write(key: _bankingIntentKey, value: jsonEncode(intents));
      });

  Future<void> removeBankingProof(String scopedKey) =>
      removeBankingIntent('proof:$scopedKey');

  Future<void> initialize() async =>
      _prefs = await SharedPreferences.getInstance();

  SharedPreferences get prefs {
    final p = _prefs;
    if (p == null) throw Exception('StorageService not initialized');
    return p;
  }

  Future<void> saveTokens(String access, String refresh) async {
    await _secure.write(key: EnvironmentConfig.accessTokenKey, value: access);
    await _secure.write(key: EnvironmentConfig.refreshTokenKey, value: refresh);
  }

  Future<String?> getAccessToken() =>
      _secure.read(key: EnvironmentConfig.accessTokenKey);
  Future<String?> getRefreshToken() =>
      _secure.read(key: EnvironmentConfig.refreshTokenKey);

  Future<void> clearTokens() async {
    await _secure.delete(key: EnvironmentConfig.accessTokenKey);
    await _secure.delete(key: EnvironmentConfig.refreshTokenKey);
  }

  Future<void> saveUser(AppUser user) async =>
      prefs.setString(EnvironmentConfig.userDataKey, jsonEncode(user.toJson()));

  AppUser? getUser() {
    final raw = prefs.getString(EnvironmentConfig.userDataKey);
    if (raw == null) return null;
    return AppUser.fromJson(jsonDecode(raw));
  }

  Future<void> clearUser() => prefs.remove(EnvironmentConfig.userDataKey);

  String? getRole() => prefs.getString(EnvironmentConfig.roleKey);
  Future<void> saveRole(String role) =>
      prefs.setString(EnvironmentConfig.roleKey, role);

  Future<void> clearAll() async {
    await clearTokens();
    await prefs.clear();
  }

  Future<bool> isLoggedIn() async {
    final t = await getAccessToken();
    return t != null && t.isNotEmpty;
  }
}

final storageService = StorageService();
