import 'dart:convert';
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
