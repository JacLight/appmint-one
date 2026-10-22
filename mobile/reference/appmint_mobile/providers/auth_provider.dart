import '../services/stripe_terminal_service.dart';
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/user_model.dart';
import '../models/auth_response.dart';
import '../services/api_service.dart';
import '../services/app_notification_service.dart';
import '../services/storage_service.dart';
import '../services/repository_service.dart';
import '../services/http_client.dart';
import '../services/softphone_service.dart';
import '../services/saved_sessions_service.dart';

enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
  twoFactorRequired,
}

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final StorageService _storage = StorageService();

  AuthStatus _status = AuthStatus.initial;
  UserModel? _user;
  String? _errorMessage;

  // A challenged sign-in, held between the password step and the code step.
  // The org is kept alongside the token because the verify call is a public
  // route and still has to say which organization it is for.
  String? _challengeToken;
  String? _challengeMethod;
  String? _challengeOrgId;
  String? _challengeEmail;

  AuthStatus get status => _status;
  UserModel? get user => _user;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  String get sessionIdentity => isAuthenticated
      ? '${_apiService.currentOrgId}:${_user?.email ?? ""}'
      : '';

  /// True while the server is waiting for a verification code.
  bool get needsTwoFactor => _status == AuthStatus.twoFactorRequired;

  /// `email`, `sms` or `authenticator` — how the code reached them.
  String? get twoFactorMethod => _challengeMethod;

  /// Who the pending challenge belongs to. The login screen is rebuilt from
  /// scratch while a challenge is raised (the provider passes through
  /// `loading`, which unmounts it), so the screen cannot rely on its own
  /// fields to know who is signing in — it reads this.
  String? get twoFactorEmail => _challengeEmail;

  AuthProvider() {
    // Wire token refresh and force logout into the HTTP client
    appengineHttpClient.onTokenRefresh = _refreshToken;
    appengineHttpClient.onForceLogout = _forceLogout;
    _initialize();
  }

  Future<String?> _refreshToken() async {
    try {
      if (kDebugMode) print('🔄 Attempting token refresh...');
      final authResponse = await _apiService.refreshToken();
      _user = authResponse.user;
      await _storage.saveUser(authResponse.user);
      if (kDebugMode) print('✅ Token refreshed successfully');
      return authResponse.accessToken;
    } catch (e) {
      if (kDebugMode) print('❌ Token refresh failed: $e');
      return null;
    }
  }

  void _forceLogout() {
    if (kDebugMode) print('🚪 Force logout — session expired');
    _user = null;
    _status = AuthStatus.unauthenticated;
    _errorMessage = 'Session expired. Please sign in again.';
    _storage.clearAll();
    appengineHttpClient.clearAuth();
    notifyListeners();

    // Pop every pushed route back to root so the AuthWrapper (the only
    // place that listens to AuthStatus) becomes the visible screen. Without
    // this the user is stranded on the last pushed page with broken data
    // and no obvious way back to login.
    final nav = appNotificationService.navigatorKey.currentState;
    if (nav != null && nav.canPop()) {
      nav.popUntil((r) => r.isFirst);
    }

    // Loud, visible. The previous behaviour silently set _errorMessage on
    // the provider — only the login screen ever read it, so users on a
    // pushed screen saw nothing until they noticed everything had stopped.
    appNotificationService.show(
      'Session expired. Please sign in again.',
      kind: NotificationKind.warning,
      duration: const Duration(seconds: 6),
    );
  }

  Future<void> _initialize() async {
    _status = AuthStatus.loading;
    notifyListeners();

    try {
      await _storage.initialize();
      await _apiService.initialize();

      final isLoggedIn = await _storage.isLoggedIn();
      if (isLoggedIn) {
        _user = await _storage.getUser();
        if (_user != null) {
          // Set auth tokens in RepositoryService
          final accessToken = await _storage.getAccessToken();
          final orgId = await _storage.getSetting('orgId');
          if (accessToken != null && orgId != null) {
            repositoryService.setAuth(accessToken, orgId);
          }
          _status = AuthStatus.authenticated;
          // Register softphone device (voice + sms) for Twilio call/SMS routing
          unawaited(softphoneService.registerDevice(label: 'Appmint Mobile'));
        } else {
          _status = AuthStatus.unauthenticated;
        }
      } else {
        _status = AuthStatus.unauthenticated;
      }
    } catch (e) {
      _status = AuthStatus.unauthenticated;
      _errorMessage = e.toString();
    }

    notifyListeners();
  }

  /// Which orgs an email belongs to, most recently used first. Empty when the
  /// directory has never seen the email. Errors surface as [errorMessage].
  /// Set when a sign-in sent without an org found the password good in more
  /// than one of them. The screen offers these and signs in again naming one.
  List<OrgChoice> _orgChoices = const [];
  List<OrgChoice> get orgChoices => _orgChoices;
  bool get needsOrgChoice => _orgChoices.length > 1;

  void clearOrgChoices() {
    if (_orgChoices.isEmpty) return;
    _orgChoices = const [];
    notifyListeners();
  }

  /// The `user` object exactly as the server sent it, kept because the typed
  /// model cannot hold the permissions map. Read by AppVisibilityProvider.
  Map<String, dynamic>? _rawUser;
  Map<String, dynamic>? get rawUser => _rawUser;

  Future<List<OrgChoice>> lookupOrgs(String email) async {
    _errorMessage = null;
    try {
      return await _apiService.directoryLookup(email);
    } catch (e) {
      _errorMessage =
          'Could not look up that email: ${e.toString().replaceFirst('Exception: ', '')}';
      notifyListeners();
      return const [];
    }
  }

  Future<bool> login(String orgId, String email, String password) async {
    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      _orgChoices = const [];
      notifyListeners();

      if (kDebugMode) {
        print(
          '🔑 AuthProvider.login called with orgId: ${orgId.isEmpty ? '(from email)' : orgId}, email: $email',
        );
      }

      final AuthResponse response = await _apiService.login(
        orgId,
        email,
        password,
      );
      _user = response.user;
      // Menu access rides on the user profile, so it is already here — no
      // extra round trip. AppVisibilityProvider reads it from this.
      _rawUser = response.rawUser;

      // The org this actually opened. Sent without one, the API resolved it
      // from the server's answer; everything downstream must use that and not
      // the empty string we asked with.
      final resolvedOrg = _apiService.currentOrgId;

      if (kDebugMode) {
        print(
          '✅ Login successful! Token length: ${response.accessToken.length}',
        );
        print('   User: ${response.user.email}');
        print('   Setting auth in RepositoryService...');
      }

      // Set auth tokens in RepositoryService
      repositoryService.setAuth(response.accessToken, resolvedOrg);

      // Save user email + phone for chat socket + softphone auth
      await _storage.saveSetting('userEmail', response.user.email);
      if (response.user.phone != null) {
        await _storage.saveSetting('userPhone', response.user.phone!);
      }

      _status = AuthStatus.authenticated;
      notifyListeners();

      // Remember this account for one-tap sign-in later (survives logout).
      unawaited(_rememberSession(resolvedOrg, response));

      // Register softphone device for voice + sms in the background
      unawaited(softphoneService.registerDevice(label: 'Appmint Mobile'));

      return true;
    } on TwoFactorRequiredException catch (e) {
      // Not an error — the password was right and a code is on its way.
      if (kDebugMode) print('🔐 Verification required (${e.method})');
      _challengeToken = e.challengeToken;
      _challengeMethod = e.method;
      // An org-less sign-in is told which org it resolved; verifying the code
      // needs that, not the empty string it was asked with.
      _challengeOrgId = orgId.trim().isNotEmpty ? orgId.trim() : e.orgId;
      _challengeEmail = email;
      _status = AuthStatus.twoFactorRequired;
      _errorMessage = e.message;
      notifyListeners();
      return false;
    } on OrgChoiceRequiredException catch (e) {
      // Not a failure: the password was right in several orgs and only the
      // person can say which one they meant. Left unauthenticated so the
      // screen stays on the form and shows the list.
      if (kDebugMode) print('🏢 ${e.orgs.length} orgs accepted that password');
      _orgChoices = e.orgs;
      _status = AuthStatus.unauthenticated;
      _errorMessage = null;
      notifyListeners();
      return false;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Login failed: $e');
      }
      _status = AuthStatus.error;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Finish a challenged sign-in with the code the person was sent.
  Future<bool> verifyTwoFactor(String code) async {
    final token = _challengeToken;
    final orgId = _challengeOrgId;
    if (token == null || orgId == null) {
      _errorMessage =
          'That verification session is gone. Please sign in again.';
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }

    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      notifyListeners();

      final AuthResponse response = await _apiService.verifyTwoFactor(
        orgId: orgId,
        challengeToken: token,
        code: code,
      );

      _user = response.user;
      repositoryService.setAuth(response.accessToken, orgId);

      await _storage.saveSetting('userEmail', response.user.email);
      if (response.user.phone != null) {
        await _storage.saveSetting('userPhone', response.user.phone!);
      }

      _clearChallenge();
      _status = AuthStatus.authenticated;
      notifyListeners();

      unawaited(_rememberSession(orgId, response));
      unawaited(softphoneService.registerDevice(label: 'Appmint Mobile'));
      return true;
    } catch (e) {
      if (kDebugMode) print('❌ Verification failed: $e');
      // Stay on the code screen: a wrong code is worth another try, and the
      // server tells us when the challenge itself has died.
      _status = AuthStatus.twoFactorRequired;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Send the code again on the current challenge.
  ///
  /// Pass [method] to switch how it arrives — the way out for someone whose
  /// default factor is an authenticator app on a phone they no longer have.
  /// The server accepts any enrolled factor's code, so switching only changes
  /// what gets sent, not what will be accepted.
  Future<bool> resendTwoFactorCode({String? method}) async {
    final token = _challengeToken;
    final orgId = _challengeOrgId;
    if (token == null || orgId == null) return false;
    try {
      await _apiService.resendTwoFactorCode(
        orgId: orgId,
        challengeToken: token,
        method: method ?? _challengeMethod,
      );
      if (method != null) {
        _challengeMethod = method;
        _errorMessage = null;
        notifyListeners();
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Abandon a challenge and go back to the sign-in form.
  void cancelTwoFactor() {
    _clearChallenge();
    _status = AuthStatus.unauthenticated;
    _errorMessage = null;
    notifyListeners();
  }

  void _clearChallenge() {
    _challengeToken = null;
    _challengeMethod = null;
    _challengeOrgId = null;
    _challengeEmail = null;
  }

  /// Persist the account for one-tap sign-in later. Best-effort.
  Future<void> _rememberSession(String orgId, AuthResponse response) async {
    try {
      await savedSessionsService.save(
        SavedSession(
          orgId: orgId,
          email: response.user.email,
          name: response.user.displayName,
          avatar: response.user.avatar,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          lastUsed: DateTime.now().millisecondsSinceEpoch,
        ),
      );
    } catch (e) {
      if (kDebugMode) print('rememberSession failed (ignored): $e');
    }
  }

  /// One-tap sign-in from a saved account: prime the saved tokens, then refresh
  /// to validate them. Returns false when the tokens are dead (the caller then
  /// falls back to a password sign-in) — the session is marked expired so it
  /// still shows in the list but no longer offers a silent tap.
  Future<bool> signInWithSavedSession(SavedSession s) async {
    if (!s.canQuickSignIn) return false;
    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      notifyListeners();

      // Prime storage + HTTP clients so refreshToken() authenticates as this org.
      await _storage.saveTokens(s.accessToken, s.refreshToken);
      await _storage.saveSetting('orgId', s.orgId);
      await _storage.saveSetting('remembered_org', s.orgId);
      appengineHttpClient.setAuth(s.accessToken, s.orgId);
      repositoryService.setAuth(s.accessToken, s.orgId);

      // Validate + refresh. Throws if the refresh token is dead → expired.
      final AuthResponse response = await _apiService.refreshToken();
      _user = response.user;
      appengineHttpClient.setAuth(response.accessToken, s.orgId);
      repositoryService.setAuth(response.accessToken, s.orgId);
      await _storage.saveUser(response.user);
      await _storage.saveSetting('userEmail', response.user.email);

      await _rememberSession(s.orgId, response);

      _status = AuthStatus.authenticated;
      notifyListeners();
      unawaited(softphoneService.registerDevice(label: 'Appmint Mobile'));
      return true;
    } catch (e) {
      if (kDebugMode) print('quick sign-in failed: $e');
      await savedSessionsService.markExpired(s.orgId);
      appengineHttpClient.clearAuth();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }
  }

  /// POS quick sign-in with a BusinessMade employeeId. `pin` is the 6-digit
  /// passcode (required in 'passcode' mode); `cardUid` is the NFC chip serial
  /// when the employeeId came from a tap. The server enforces the org's
  /// passcodeLoginSettings — if it rejects a pin-less attempt because a PIN is
  /// required, [needsPin] flips true so the UI can prompt and retry.
  bool needsPin = false;

  Future<bool> loginWithPasscode(
    String orgId, {
    required String employeeId,
    String? pin,
    String? cardUid,
  }) async {
    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      needsPin = false;
      notifyListeners();

      final AuthResponse response = await _apiService.signinPasscode(
        orgId,
        employeeId: employeeId,
        pin: pin,
        cardUid: cardUid,
      );
      _user = response.user;
      repositoryService.setAuth(response.accessToken, orgId);
      await _storage.saveSetting('userEmail', response.user.email);
      if (response.user.phone != null) {
        await _storage.saveSetting('userPhone', response.user.phone!);
      }
      _status = AuthStatus.authenticated;
      notifyListeners();
      unawaited(softphoneService.registerDevice(label: 'Appmint Mobile'));
      return true;
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      // Pin-less (instant-mode) attempt rejected because this org requires a
      // passcode: surface a pin prompt instead of a hard error.
      if ((pin == null || pin.isEmpty) &&
          msg.toLowerCase().contains('invalid employee id or passcode')) {
        needsPin = true;
        _status = AuthStatus.unauthenticated;
        _errorMessage = null;
        notifyListeners();
        return false;
      }
      if (kDebugMode) print('❌ Passcode login failed: $e');
      _status = AuthStatus.error;
      _errorMessage = msg;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
    String? username,
  }) async {
    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      notifyListeners();

      final AuthResponse response = await _apiService.register(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        username: username,
      );
      _user = response.user;

      // Set auth tokens in RepositoryService
      final orgId = await _storage.getSetting('orgId');
      if (orgId != null) {
        repositoryService.setAuth(response.accessToken, orgId);
      }

      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _status = AuthStatus.error;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Recovery is not sign-in: keep the login screen and auth status intact.
  Future<bool> requestPasswordReset(String orgId, String email) async {
    _errorMessage = null;
    try {
      await _apiService.requestPasswordReset(orgId, email);
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Send magic code to email
  Future<bool> sendMagicCode(String orgId, String email) async {
    try {
      _errorMessage = null;
      await _storage.saveSetting('orgId', orgId);
      appengineHttpClient.setAuth('', orgId); // set orgId for the request
      await _apiService.sendMagicCode(email);
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Verify magic code and login
  Future<bool> verifyMagicCode(String orgId, String email, String code) async {
    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      notifyListeners();

      await _storage.saveSetting('orgId', orgId);
      appengineHttpClient.setAuth('', orgId);
      final AuthResponse response = await _apiService.verifyMagicCode(
        email,
        code,
      );
      _user = response.user;
      appengineHttpClient.setAuth(response.accessToken, orgId);
      repositoryService.setAuth(response.accessToken, orgId);
      await _storage.saveSetting('userEmail', response.user.email);
      _status = AuthStatus.authenticated;
      notifyListeners();
      unawaited(softphoneService.registerDevice(label: 'Appmint Mobile'));
      return true;
    } catch (e) {
      _status = AuthStatus.error;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// [forgetSavedSession]: a shared workstation (a counter or door device with
  /// a workstation layout) must not keep a one-tap sign-in back into the
  /// person who just signed out. The device still remembers its organization,
  /// so the next person uses POS Quick Sign-In or their own password.
  Future<void> logout({bool forgetSavedSession = false}) async {
    if (forgetSavedSession) {
      try {
        final storage = StorageService();
        await storage.initialize();
        final org = (await storage.getSetting('orgId'))?.toString() ?? '';
        if (org.isNotEmpty) await SavedSessionsService().remove(org);
      } catch (e) {
        if (kDebugMode) print('logout: could not forget the saved session: $e');
      }
    }
    // Local sign-out must ALWAYS complete and route back to login, even if the
    // remote teardown fails. Do the best-effort remote cleanup first, but never
    // let its failure leave the user stuck "logged in" on the home screen.
    try {
      // Unregister softphone device first — releases Twilio routing for this device
      await softphoneService.unregisterDevice();
    } catch (e) {
      if (kDebugMode)
        print('logout: softphone unregister failed (ignored): $e');
    }
    try {
      await _apiService.logout();
    } catch (e) {
      if (kDebugMode) print('logout: server logout failed (ignored): $e');
    }

    try { await stripeTerminalService.clearBusinessLocationBinding(); } catch (_) {}
    _user = null;
    _status = AuthStatus.unauthenticated;
    _errorMessage = null;
    appengineHttpClient.clearAuth();
    notifyListeners();
  }

  /// Permanently delete the current user's account and sign them out.
  ///
  /// Required by App Store Review Guideline 5.1.1(v). After a successful
  /// delete the provider is left in the unauthenticated state so the app
  /// routes back to the login screen.
  Future<bool> deleteAccount() async {
    if (_user == null) {
      _errorMessage = 'Not signed in';
      notifyListeners();
      return false;
    }

    try {
      _status = AuthStatus.loading;
      _errorMessage = null;
      notifyListeners();

      // Release the softphone registration first, same as logout.
      await softphoneService.unregisterDevice();
      await _apiService.deleteAccount();

      _user = null;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Delete account failed: $e');
      }
      _status = AuthStatus.error;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  Future<void> refreshUser() async {
    try {
      final user = await _apiService.getCurrentUser();
      _user = user;
      await _storage.saveUser(user);
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
