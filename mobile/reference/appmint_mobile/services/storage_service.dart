import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import '../models/user_model.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  // The standalone macOS app uses ad-hoc signing and doesn't share credentials
  // with other apps. Use its login Keychain: the data-protection Keychain needs
  // a provisioning profile and otherwise fails with errSecMissingEntitlement.
  // mOptions only affects macOS; iOS keeps its default Keychain configuration.
  final _secureStorage = const FlutterSecureStorage(
    mOptions: MacOsOptions(usesDataProtectionKeychain: false),
  );
  SharedPreferences? _prefs;

  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
  }

  SharedPreferences get prefs {
    if (_prefs == null) {
      throw Exception('StorageService not initialized');
    }
    return _prefs!;
  }

  // Secure Token Storage
  Future<void> saveTokens(String accessToken, String refreshToken) async {
    await _secureStorage.write(
      key: AppConfig.accessTokenKey,
      value: accessToken,
    );
    await _secureStorage.write(
      key: AppConfig.refreshTokenKey,
      value: refreshToken,
    );
  }

  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: AppConfig.accessTokenKey);
  }

  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: AppConfig.refreshTokenKey);
  }

  Future<void> clearTokens() async {
    await _secureStorage.delete(key: AppConfig.accessTokenKey);
    await _secureStorage.delete(key: AppConfig.refreshTokenKey);
  }

  // User Data Storage
  Future<void> saveUser(UserModel user) async {
    await prefs.setString(AppConfig.userDataKey, jsonEncode(user.toJson()));
  }

  Future<UserModel?> getUser() async {
    final userJson = prefs.getString(AppConfig.userDataKey);
    if (userJson == null) return null;
    return UserModel.fromJson(jsonDecode(userJson));
  }

  Future<void> clearUser() async {
    await prefs.remove(AppConfig.userDataKey);
  }

  // App Settings
  Future<void> saveSetting(String key, dynamic value) async {
    if (value is String) {
      await prefs.setString(key, value);
    } else if (value is int) {
      await prefs.setInt(key, value);
    } else if (value is double) {
      await prefs.setDouble(key, value);
    } else if (value is bool) {
      await prefs.setBool(key, value);
    } else {
      await prefs.setString(key, jsonEncode(value));
    }
  }

  Future<dynamic> getSetting(String key, {dynamic defaultValue}) async {
    if (!prefs.containsKey(key)) return defaultValue;

    final value = prefs.get(key);
    if (value is String && (value.startsWith('{') || value.startsWith('['))) {
      return jsonDecode(value);
    }
    return value ?? defaultValue;
  }

  Future<void> removeSetting(String key) async {
    await prefs.remove(key);
  }

  // Clear All
  Future<void> clearAll() async {
    // Preserve the remembered org + saved accounts across logout so the login
    // screen can prefill the org and offer one-tap "sign in again".
    final rememberedOrg = prefs.getString('remembered_org');
    // …and its business name, so Quick Sign-In says "Juniper Street Café", not the org id.
    final rememberedOrgName = prefs.getString('remembered_org_name');
    final savedSessions = prefs.getString('saved_sessions');
    // Device layouts belong to the workstation, including when staff sign out.
    final deviceSettings = <String, Object>{
      for (final key in prefs.getKeys())
        if (key.startsWith('home_') || key.startsWith('kitchen_station:') ||
            // The hardware paired with this device (receipt printer, scanner,
            // NFC reader) stays with the device: at a shared counter the next
            // person must not have to pair the printer again.
            key.startsWith('printer_default_') || key.startsWith('scanner_') ||
            key.startsWith('nfc_reader_') ||
            // POS settings are "On this device" (payment methods, their names, Send to prep).
            key.startsWith('pos_device_'))
          key: prefs.get(key)!,
    };
    await clearTokens();
    await clearUser();
    await prefs.clear();
    for (final entry in deviceSettings.entries) {
      if (entry.value is List<String>) {
        await prefs.setStringList(entry.key, entry.value as List<String>);
      } else {
        await saveSetting(entry.key, entry.value);
      }
    }
    if (rememberedOrg != null && rememberedOrg.isNotEmpty) {
      await prefs.setString('remembered_org', rememberedOrg);
    }
    if (rememberedOrgName != null && rememberedOrgName.isNotEmpty) {
      await prefs.setString('remembered_org_name', rememberedOrgName);
    }
    if (savedSessions != null && savedSessions.isNotEmpty) {
      await prefs.setString('saved_sessions', savedSessions);
    }
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}
