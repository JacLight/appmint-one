import 'package:flutter/foundation.dart' show kIsWeb;

enum Environment { development, production }

/// Stowbo talks to the Appmint appengine backend (same platform as the rest of
/// the repo). Custody records live as generic repository datatypes
/// (`stowbo_host`, `stowbo_custody`) so no backend deltas are required for v1.
class EnvironmentConfig {
  static Environment _currentEnvironment = Environment.development;

  static Environment get currentEnvironment => _currentEnvironment;
  static void setEnvironment(Environment env) => _currentEnvironment = env;

  static bool get isDevelopment => _currentEnvironment == Environment.development;
  static bool get isProduction => _currentEnvironment == Environment.production;

  static String get appengineEndpoint {
    const override = String.fromEnvironment('APPENGINE_URL');
    if (override.isNotEmpty) return override;
    switch (_currentEnvironment) {
      case Environment.development:
        // A web build runs in a browser on the same machine as the dev server,
        // where the LAN address is often not reachable (the backend binds to
        // loopback). A phone genuinely needs the LAN IP and must share Wi-Fi.
        if (kIsWeb) return 'http://127.0.0.1:3300';
        return 'http://192.168.1.239:3300';
      case Environment.production:
        return 'https://appengine.appmint.io';
    }
  }

  // Supply app credentials through an untracked --dart-define-from-file file.
  // User sign-in remains a separate customer session.
  static String get appId => const String.fromEnvironment('APP_ID').isNotEmpty
      ? const String.fromEnvironment('APP_ID')
      : (isProduction ? 'stowbo_app' : 'demo');
  static String get appKey =>
      const String.fromEnvironment('ONE_APP_KEY');
  static String get appSecret => const String.fromEnvironment('APP_SECRET');

  /// An account a demo build may sign in as with one tap.
  ///
  /// Build-time only, and absent from a customer's build — the quick sign-in
  /// button simply does not appear when there is nothing to sign in as, which
  /// is how a demo convenience stays out of a real app.
  static String get demoEmail => const String.fromEnvironment('DEMO_EMAIL');
  static String get demoPassword =>
      const String.fromEnvironment('DEMO_PASSWORD');
  static bool get hasDemoAccount =>
      demoEmail.isNotEmpty && demoPassword.isNotEmpty;
  static String get orgId => const String.fromEnvironment('ORG_ID').isNotEmpty
      ? const String.fromEnvironment('ORG_ID')
      : (isProduction ? 'stowbo' : 'demo');
  /// The appmint SITE this app belongs to — chat config, branding etc. live on it.
  static String get siteName => isProduction ? 'stowbo' : 'demo';

  // Always false on the mobile app: the org is explicit via the `orgid` header
  // (demo in dev, stowbo in prod). domainAsOrg is a web-only concept — letting
  // the server derive the org from the request domain — and on a mobile/local
  // host it resolves to the wrong org (e.g. "localhost"), breaking every call.
  static const bool domainAsOrg = false;

  // Storage keys
  static const String accessTokenKey = 'stowbo_access_token';
  static const String refreshTokenKey = 'stowbo_refresh_token';
  static const String userDataKey = 'stowbo_user';
  static const String roleKey = 'stowbo_role';

  // Repository datatypes
  static const String hostDatatype = 'stowbo_host';
  static const String custodyDatatype = 'stowbo_custody';

  static const String appName = 'Stowbo';
  static const String appVersion = '1.0.0';

  // OAuth (from base-app/.env — WEB/NextAuth clients). The Google web client is
  // valid only as `serverClientId` (backend idToken audience); native mobile
  // sign-in additionally needs platform OAuth clients. Facebook App ID is
  // reusable across web + mobile.
  static const String googleServerClientId =
      '183221293525-c0ksqtttk9ks4jpnicvb3jr10s84p7uj.apps.googleusercontent.com';
  static const String facebookAppId = '517369844777814';

  // Google sign-in via WebView-code-interception (the web client can't drive a
  // native SDK, so the app runs OAuth in a WebView, grabs the `code`, and
  // appengine exchanges it). redirectUri must be an authorized redirect on the
  // web client — the app only intercepts it, so the host need not serve it.
  static const String googleWebClientId =
      '425437838033-lf4hm94mtv4ttl63vahmtpf63jm22nl7.apps.googleusercontent.com';
  static const String googleRedirectUri =
      'https://stowbo.com/auth/google/callback';
}
