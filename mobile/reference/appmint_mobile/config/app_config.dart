import 'environment.dart';

class AppConfig {
  // API Configuration - Environment-based
  static String get appengineEndpoint => EnvironmentConfig.appengineEndpoint;
  static String get apiBaseUrl => EnvironmentConfig.apiBaseUrl;
  static String get appUrl => EnvironmentConfig.appUrl;

  // Default App Credentials (for development only)
  static String get orgId => EnvironmentConfig.defaultOrgId;

  // API Endpoints
  static const String authLoginEndpoint = '/auth/login';
  static const String authRegisterEndpoint = '/auth/register';
  static const String authRefreshEndpoint = '/auth/refresh';
  static const String authMeEndpoint = '/auth/me';

  static const String leadsEndpoint = '/leads';
  static const String activitiesEndpoint = '/activities';
  static const String searchEndpoint = '/search';
  static const String usersEndpoint = '/users';
  static const String settingsEndpoint = '/settings';

  // App Settings
  static String get appName => EnvironmentConfig.appName;
  static String get appVersion => EnvironmentConfig.appVersion;

  // Storage Keys
  static String get accessTokenKey => EnvironmentConfig.accessTokenKey;
  static String get refreshTokenKey => EnvironmentConfig.refreshTokenKey;
  static String get userDataKey => EnvironmentConfig.userDataKey;
  static String get appSettingsKey => EnvironmentConfig.appSettingsKey;

  // Network Settings
  static int get connectionTimeout => EnvironmentConfig.connectionTimeout;
  static int get receiveTimeout => EnvironmentConfig.receiveTimeout;
  static int get maxRetries => EnvironmentConfig.maxRetries;

  // Pagination
  static int get defaultPageSize => EnvironmentConfig.defaultPageSize;
  static int get maxPageSize => EnvironmentConfig.maxPageSize;

  // Environment Info
  static bool get isDevelopment => EnvironmentConfig.isDevelopment;
  static bool get isProduction => EnvironmentConfig.isProduction;
  static Environment get environment => EnvironmentConfig.currentEnvironment;
}
