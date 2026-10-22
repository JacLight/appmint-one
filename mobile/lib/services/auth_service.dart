import 'http_client.dart';
import 'storage_service.dart';
import '../config/environment.dart';
import '../models/app_user.dart';

/// The server issued a verification challenge instead of a session.
///
/// Customer sign-in answers with `requiresTwoFactor` and no tokens when the
/// account has 2FA on, when the organization requires it for customers, or when
/// new-device verification is on and this device is not recognised. The code is
/// already sent by the time this is thrown.
class TwoFactorRequiredException implements Exception {
  final String challengeToken;

  /// `email`, `sms` or `authenticator`.
  final String method;
  final String message;

  TwoFactorRequiredException({
    required this.challengeToken,
    required this.method,
    required this.message,
  });

  @override
  String toString() => message;
}

class AuthResult {
  final AppUser user;
  final String accessToken;
  final String refreshToken;
  AuthResult(this.user, this.accessToken, this.refreshToken);
}

class AuthService {
  final AppengineHttpClient _http = appengineHttpClient;
  final StorageService _storage = storageService;
  int _sessionGeneration = 0;
  Future<String?>? _refreshing;

  AuthService() {
    _http.refreshUserToken = refresh;
  }

  String _token(Map r, List<String> keys) {
    for (final k in keys) {
      final v = r[k];
      if (v is String && v.isNotEmpty) return v;
    }
    return '';
  }

  AuthResult _consume(Map<String, dynamic> res) {
    // A challenge is a 200 with no token in it. Caught here rather than in each
    // caller because every sign-in path funnels through _consume, and a missing
    // token would otherwise become an empty string and a session that is not one.
    if (res['requiresTwoFactor'] == true) {
      throw TwoFactorRequiredException(
        challengeToken: res['challengeToken']?.toString() ?? '',
        method: res['twoFactorMethod']?.toString() ?? 'email',
        message: res['message']?.toString() ?? 'Verification code required',
      );
    }

    final access = _token(res, ['accessToken', 'token', 'access_token']);
    if (access.isEmpty) {
      throw Exception('Sign-in did not return a session. Please try again.');
    }
    final refresh =
        _token(res, ['refreshToken', 'refresh_token']).isNotEmpty
            ? _token(res, ['refreshToken', 'refresh_token'])
            : access;
    // appengine returns the profile under `customer` (customer auth) or `user`.
    final userJson = (res['customer'] is Map)
        ? Map<String, dynamic>.from(res['customer'])
        : (res['user'] is Map)
            ? Map<String, dynamic>.from(res['user'])
            : res;
    final user = AppUser.fromJson(userJson);
    _http.setUserToken(access);
    return AuthResult(user, access, refresh);
  }

  Future<AuthResult> signIn(String email, String password) async {
    final res = await _http.post('/profile/customer/signin',
        body: {'email': email, 'password': password}, useUserToken: false);
    final r = Map<String, dynamic>.from(res as Map);
    final auth = _consume(r);
    await _persist(auth);
    return auth;
  }

  /// Finish a challenged sign-in. Public route — the challenge token is the
  /// credential. `trustDevice` stops this device being challenged again for the
  /// next 30 days, so new-device verification does not ask on every launch.
  Future<AuthResult> verifyTwoFactor({
    required String challengeToken,
    required String code,
    bool trustDevice = true,
  }) async {
    final res = await _http.post('/profile/security/challenge/verify', body: {
      'challengeToken': challengeToken,
      'code': code,
      'trustDevice': trustDevice,
    }, useUserToken: false);
    final r = Map<String, dynamic>.from(res as Map);
    final auth = _consume(r);
    await _persist(auth);
    return auth;
  }

  /// Send the code again on the same challenge. Meaningless for `authenticator`.
  Future<void> resendTwoFactorCode({
    required String challengeToken,
    String? method,
  }) async {
    await _http.post('/profile/security/challenge/send', body: {
      'challengeToken': challengeToken,
      if (method != null) 'method': method,
    }, useUserToken: false);
  }

  Future<AuthResult> signUp({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
    String? phone,
  }) async {
    final res = await _http.post('/profile/customer/signup', body: {
      'email': email,
      'password': password,
      if (firstName != null) 'firstName': firstName,
      if (lastName != null) 'lastName': lastName,
      if (phone != null) 'phone': phone,
    }, useUserToken: false);
    final r = Map<String, dynamic>.from(res as Map);
    final auth = _consume(r);
    await _persist(auth);
    return auth;
  }

  /// Exchange a native OAuth profile for a session via customer/social-login.
  Future<AuthResult> socialLogin(Map<String, dynamic> body) async {
    final res =
        await _http.post('/profile/customer/social-login', body: body,
            useUserToken: false);
    final auth = _consume(Map<String, dynamic>.from(res as Map));
    await _persist(auth);
    return auth;
  }

  /// Exchange a Google auth code (from the WebView flow) for a session.
  Future<AuthResult> googleCodeExchange(String code) async {
    final res = await _http.post('/profile/customer/google/token', body: {
      'code': code,
      'redirectUri': EnvironmentConfig.googleRedirectUri,
    }, useUserToken: false);
    final auth = _consume(Map<String, dynamic>.from(res as Map));
    await _persist(auth);
    return auth;
  }

  /// Send a 6-digit magic code to the email (GET /magic-link?type=code).
  Future<void> sendMagicCode(String email) async {
    await _http.get('/profile/magic-link',
        queryParams: {'email': email.trim(), 'type': 'code'},
        useUserToken: false);
  }

  /// Verify the code and sign in (POST /magic-link/redirect { email, code }).
  Future<AuthResult> verifyMagicCode(String email, String code) async {
    final res = await _http.post('/profile/magic-link/redirect',
        body: {'email': email.trim(), 'code': code.trim()},
        useUserToken: false);
    final auth = _consume(Map<String, dynamic>.from(res as Map));
    await _persist(auth);
    return auth;
  }

  Future<void> _persist(AuthResult a) async {
    _sessionGeneration++;
    await _storage.saveTokens(a.accessToken, a.refreshToken);
    await _storage.saveUser(a.user);
  }

  /// Trade the stored refresh token for a fresh access token (customer tokens
  /// last an hour). Returns the new access token, or null if the session is gone.
  Future<String?> refresh() => _refreshing ??=
      _refreshSession().whenComplete(() => _refreshing = null);

  Future<String?> _refreshSession() async {
    final generation = _sessionGeneration;
    final rt = await _storage.getRefreshToken();
    if (rt == null || rt.isEmpty) return null;
    try {
      final res = await _http.post('/profile/customer/refresh',
          body: {'refresh_token': rt}, useUserToken: false);
      final r = Map<String, dynamic>.from(res as Map);
      final access = _token(r, ['accessToken', 'token', 'access_token']);
      if (access.isEmpty || generation != _sessionGeneration) return null;
      final newRefresh = _token(r, ['refreshToken', 'refresh_token']);
      _http.setUserToken(access);
      await _storage.saveTokens(access, newRefresh.isNotEmpty ? newRefresh : rt);
      return access;
    } catch (_) {
      return null;
    }
  }

  Future<AppUser?> restore() async {
    final token = await _storage.getAccessToken();
    if (token == null || token.isEmpty) return null;
    _http.setUserToken(token);
    return _storage.getUser();
  }

  Future<void> signOut() async {
    _sessionGeneration++;
    _http.clearUserToken();
    await _storage.clearTokens();
    await _storage.clearUser();
  }

  /// Permanently delete the signed-in customer (Apple 5.1.1(v)). Server hard-
  /// deletes the record; then we clear everything locally like a sign-out.
  Future<void> deleteAccount() async {
    await _http.delete('/profile/customer/self'); // user-token authed
    _sessionGeneration++;
    _http.clearUserToken();
    await _storage.clearTokens();
    await _storage.clearUser();
  }
}

final authService = AuthService();
