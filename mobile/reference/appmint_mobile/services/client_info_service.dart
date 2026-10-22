import 'dart:async';
import 'dart:io' show Platform;
import 'dart:ui' as ui;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Mobile equivalent of the web `RequestInfo` / `getRequestInfo` helper at
/// /Users/imzee/projects/base-app/src/lib/request-info.ts
///
/// Collects device, OS, app, locale and network details once at startup
/// (cached in [snapshot]) so every heartbeat, presence ping, chat connect,
/// or analytics call can attach a consistent `clientInfo` block.
///
/// Network type is refreshed lazily via [currentNetworkType] since it can
/// change during a session (wifi → cellular → offline).
class ClientInfoService {
  static final ClientInfoService _instance = ClientInfoService._internal();
  factory ClientInfoService() => _instance;
  ClientInfoService._internal();

  Map<String, dynamic>? _snapshot;
  final Connectivity _connectivity = Connectivity();

  /// Cached snapshot captured at init. Safe to access synchronously
  /// after [initialize] has resolved once.
  Map<String, dynamic> get snapshot => _snapshot ?? const {};

  bool get isInitialized => _snapshot != null;

  /// Collect device / app / OS / locale info once. Idempotent — calling
  /// this multiple times reuses the cached snapshot.
  Future<Map<String, dynamic>> initialize() async {
    if (_snapshot != null) return _snapshot!;

    String? platform;
    String? osName;
    String? osVersion;
    String? deviceType;
    String? deviceVendor;
    String? deviceModel;
    String? deviceId;
    bool isPhysicalDevice = true;

    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final android = await deviceInfo.androidInfo;
        platform = 'android';
        osName = 'Android';
        osVersion = android.version.release;
        deviceVendor = android.manufacturer;
        deviceModel = android.model;
        deviceId = android.id;
        isPhysicalDevice = android.isPhysicalDevice;
        // Heuristic tablet vs phone — no direct field
        deviceType = 'mobile';
      } else if (Platform.isIOS) {
        final ios = await deviceInfo.iosInfo;
        platform = 'ios';
        osName = 'iOS';
        osVersion = ios.systemVersion;
        deviceVendor = 'Apple';
        deviceModel = ios.utsname.machine;
        deviceId = ios.identifierForVendor;
        isPhysicalDevice = ios.isPhysicalDevice;
        deviceType = ios.model.toLowerCase().contains('ipad') ? 'tablet' : 'mobile';
      }
    } catch (e) {
      if (kDebugMode) debugPrint('ClientInfoService: device info failed — $e');
    }

    // App info
    String? appVersion;
    String? appBuild;
    String? appPackage;
    String? appName;
    try {
      final pkg = await PackageInfo.fromPlatform();
      appVersion = pkg.version;
      appBuild = pkg.buildNumber;
      appPackage = pkg.packageName;
      appName = pkg.appName;
    } catch (e) {
      if (kDebugMode) debugPrint('ClientInfoService: package info failed — $e');
    }

    // Locale + timezone
    final locale = ui.PlatformDispatcher.instance.locale;
    final language = locale.toLanguageTag(); // e.g. "en-US"
    final timezone = DateTime.now().timeZoneName;
    final timezoneOffset = DateTime.now().timeZoneOffset.inMinutes;

    _snapshot = {
      // Matches web RequestInfo shape where possible
      'platform': platform,                    // 'android' | 'ios'
      'os': osName,                            // 'Android' | 'iOS'
      'osVersion': osVersion,                  // e.g. '14'
      'deviceType': deviceType,                // 'mobile' | 'tablet'
      'deviceVendor': deviceVendor,            // 'Samsung' | 'Apple'
      'deviceModel': deviceModel,              // 'SM-G998U' | 'iPhone14,3'
      'deviceId': deviceId,                    // stable per install
      'isPhysicalDevice': isPhysicalDevice,    // false on emulator/simulator
      // App identity
      'appName': appName,                      // 'Appmint Mobile'
      'appPackage': appPackage,                // 'io.appmint.appmint_mobile'
      'appVersion': appVersion,                // '1.2.3'
      'appBuild': appBuild,                    // '42'
      // Locale
      'language': language,                    // 'en-US'
      'timezone': timezone,                    // 'PST' / 'WAT'
      'timezoneOffsetMinutes': timezoneOffset, // -480 / 60
      // User agent-ish string for server-side logging parity with web
      'userAgentString': _buildUserAgent(
        appName: appName,
        appVersion: appVersion,
        appBuild: appBuild,
        platform: platform,
        osVersion: osVersion,
        deviceVendor: deviceVendor,
        deviceModel: deviceModel,
      ),
    };

    if (kDebugMode) {
      debugPrint('📱 ClientInfo initialized:');
      debugPrint('   platform=$platform $osVersion');
      debugPrint('   device=$deviceVendor $deviceModel');
      debugPrint('   app=$appName $appVersion+$appBuild');
      debugPrint('   locale=$language tz=$timezone');
    }

    return _snapshot!;
  }

  /// Returns the current network connectivity type.
  /// 'wifi' | 'cellular' | 'ethernet' | 'vpn' | 'bluetooth' | 'none' | 'unknown'
  Future<String> currentNetworkType() async {
    try {
      // connectivity_plus v6 returns List<ConnectivityResult>
      final list = await _connectivity.checkConnectivity();
      if (list.isEmpty || list.contains(ConnectivityResult.none)) return 'none';
      if (list.contains(ConnectivityResult.wifi)) return 'wifi';
      if (list.contains(ConnectivityResult.mobile)) return 'cellular';
      if (list.contains(ConnectivityResult.ethernet)) return 'ethernet';
      if (list.contains(ConnectivityResult.vpn)) return 'vpn';
      if (list.contains(ConnectivityResult.bluetooth)) return 'bluetooth';
      return 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }

  /// Get a fresh snapshot including current network type and timestamp.
  /// Use this when calling endpoints that want live network state.
  Future<Map<String, dynamic>> withNetwork() async {
    await initialize();
    final network = await currentNetworkType();
    return {
      ..._snapshot!,
      'networkType': network,
      'capturedAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  /// Human-readable user-agent-ish string for logs — mirrors the browser
  /// `User-Agent` header so server analytics can parse it uniformly.
  /// e.g. "AppmintMobile/1.2.3 (Android 14; Samsung SM-G998U)"
  String _buildUserAgent({
    String? appName,
    String? appVersion,
    String? appBuild,
    String? platform,
    String? osVersion,
    String? deviceVendor,
    String? deviceModel,
  }) {
    final app = (appName ?? 'AppmintMobile').replaceAll(' ', '');
    final ver = appVersion ?? '0.0.0';
    final build = appBuild != null ? '+$appBuild' : '';
    final platPart = platform == 'android'
        ? 'Android ${osVersion ?? ''}'
        : platform == 'ios'
            ? 'iOS ${osVersion ?? ''}'
            : '';
    final devicePart = [deviceVendor, deviceModel]
        .where((s) => s != null && s.isNotEmpty)
        .join(' ');
    final parts = [platPart, devicePart].where((s) => s.trim().isNotEmpty).join('; ');
    return '$app/$ver$build ($parts)'.trim();
  }
}

final clientInfoService = ClientInfoService();
