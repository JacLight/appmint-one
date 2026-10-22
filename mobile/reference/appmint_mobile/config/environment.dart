enum Environment { development, production }

class EnvironmentConfig {
  static Environment _currentEnvironment = Environment.development;

  static Environment get currentEnvironment => _currentEnvironment;

  static void setEnvironment(Environment env) {
    _currentEnvironment = env;
  }

  static bool get isDevelopment =>
      _currentEnvironment == Environment.development;
  static bool get isProduction => _currentEnvironment == Environment.production;

  // API Configuration
  static String get appengineEndpoint {
    // A build-time override for testing against a local server:
    //   flutter build web --dart-define=APPENGINE_URL=http://127.0.0.1:3399
    const override = String.fromEnvironment('APPENGINE_URL');
    if (override.isNotEmpty) return override;
    switch (_currentEnvironment) {
      case Environment.development:
        return 'http://192.168.1.239:3300';
      case Environment.production:
        return 'https://appengine.appmint.io';
    }
  }

  static String get apiBaseUrl {
    switch (_currentEnvironment) {
      case Environment.development:
        return 'http://192.168.1.239:4050/api';
      case Environment.production:
        return 'https://api.appmint.io';
    }
  }

  static String get appUrl {
    switch (_currentEnvironment) {
      case Environment.development:
        return 'http://192.168.1.239:4050';
      case Environment.production:
        return 'https://appmint.io';
    }
  }

  /// Browser destination for staff recovery. Local builds can target local Studio.
  static String get passwordResetUrl {
    const studio = String.fromEnvironment(
      'STUDIO_URL',
      defaultValue: 'https://studio.appmint.io',
    );
    return '${studio.replaceFirst(RegExp(r'/+$'), '')}/reset-password';
  }

  // Default credentials (development only)
  static String get defaultOrgId {
    return isDevelopment ? 'demo' : '';
  }

  // API Settings
  static int get connectionTimeout => 30000;
  static int get receiveTimeout => 30000;
  static int get maxRetries => 3;

  // Feature Flags
  static bool get enableDebugLogs => isDevelopment;
  static bool get enableCrashReporting => isProduction;
  static bool get enableAnalytics => isProduction;

  // Storage Keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userDataKey = 'user_data';
  static const String orgIdKey = 'org_id';
  static const String appSettingsKey = 'app_settings';

  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // App Info
  static const String appName = 'Appmint';
  static const String appVersion = '1.0.0';
}
