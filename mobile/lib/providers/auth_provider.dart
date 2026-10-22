import 'package:flutter/foundation.dart';
import '../models/app_user.dart';
import '../services/auth_service.dart';
import '../services/social_auth_service.dart';

enum AuthStatus { initial, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  final AuthService _auth = authService;

  AuthStatus _status = AuthStatus.initial;
  AppUser? _user;
  bool _busy = false;
  String? _error;

  // A challenged sign-in, held between the password step and the code step.
  String? _challengeToken;
  String? _challengeMethod;

  /// Looking around without an account.
  ///
  /// A demo build that opens on a sign-in form shows nothing about what the
  /// app is. This lets someone walk the whole app without one — the screens
  /// are real and so are their reads, so anything that needs an account says
  /// so where it needs it, instead of the whole product sitting behind a wall.
  bool _exploring = false;

  AuthStatus get status => _status;
  AppUser? get user => _user;
  bool get busy => _busy;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  /// True when this session is a look around, not a sign-in. The shell says so
  /// on screen the whole time it is.
  bool get exploring => _exploring;

  /// True while the server is waiting for a verification code.
  bool get needsTwoFactor => _challengeToken != null;

  /// `email`, `sms` or `authenticator` — how the code reached them.
  String? get twoFactorMethod => _challengeMethod;

  Future<void> restore() async {
    try {
      final user = await _auth.restore();
      _user = user;
      _status =
          user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
    } catch (_) {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> signIn(String email, String password) =>
      _run(() => _auth.signIn(email.trim(), password));

  /// Enter without an account. No token is minted and nothing is stored: this
  /// only unlocks the app's own screens. Every server read still goes out as
  /// the app alone, so a read that needs a person fails with the server's own
  /// words rather than being faked here.
  void explore() {
    _exploring = true;
    _user = AppUser(id: '', email: '', firstName: 'Guest');
    _status = AuthStatus.authenticated;
    _error = null;
    notifyListeners();
  }

  /// Leave the look-around and go back to the sign-in screen.
  void stopExploring() {
    if (!_exploring) return;
    _exploring = false;
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<bool> signUp({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
    String? phone,
  }) =>
      _run(() => _auth.signUp(
            email: email.trim(),
            password: password,
            firstName: firstName,
            lastName: lastName,
            phone: phone,
          ));

  /// Google: exchange the auth code (from the WebView flow) for a session.
  Future<bool> googleExchange(String code) =>
      _run(() => _auth.googleCodeExchange(code));

  /// Facebook / Apple native OAuth → server session. False on cancel.
  Future<bool> signInWithFacebook() =>
      _social(() => socialAuthService.facebook());
  Future<bool> signInWithApple() =>
      _social(() => socialAuthService.apple());

  /// Apple sign-in is only shown on Apple platforms.
  bool get appleAvailable => socialAuthService.appleAvailable;

  Future<bool> _social(Future<SocialProfile?> Function() oauth) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final profile = await oauth();
      if (profile == null) {
        _busy = false;
        notifyListeners();
        return false; // user cancelled
      }
      final res = await _auth.socialLogin(profile.toBody());
      _user = res.user;
      _exploring = false;
      _status = AuthStatus.authenticated;
      _busy = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _busy = false;
      notifyListeners();
      return false;
    }
  }

  /// Magic code: send the 6-digit code to the email.
  Future<bool> sendMagicCode(String email) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await _auth.sendMagicCode(email);
      _busy = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _busy = false;
      notifyListeners();
      return false;
    }
  }

  /// Magic code: verify + sign in.
  Future<bool> verifyMagicCode(String email, String code) =>
      _run(() => _auth.verifyMagicCode(email, code));

  /// Finish a challenged sign-in with the code the person was sent.
  Future<bool> verifyTwoFactor(String code) async {
    final token = _challengeToken;
    if (token == null) {
      _error = 'That verification session is gone. Please sign in again.';
      notifyListeners();
      return false;
    }
    final ok = await _run(() => _auth.verifyTwoFactor(
          challengeToken: token,
          code: code,
        ));
    if (ok) _clearChallenge();
    return ok;
  }

  /// Send the code again on the current challenge.
  ///
  /// Pass [method] to switch how it arrives — the way out for someone whose
  /// default factor is an authenticator app on a phone they no longer have.
  /// The server accepts any enrolled factor's code, so switching only changes
  /// what gets sent, not what will be accepted.
  Future<bool> resendTwoFactorCode({String? method}) async {
    final token = _challengeToken;
    if (token == null) return false;
    try {
      await _auth.resendTwoFactorCode(
        challengeToken: token,
        method: method ?? _challengeMethod,
      );
      if (method != null) {
        _challengeMethod = method;
        _error = null;
        notifyListeners();
      }
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Abandon a challenge and go back to the sign-in form.
  void cancelTwoFactor() {
    _clearChallenge();
    _error = null;
    notifyListeners();
  }

  void _clearChallenge() {
    _challengeToken = null;
    _challengeMethod = null;
  }

  Future<bool> _run(Future<AuthResult> Function() op) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final res = await op();
      _user = res.user;
      _exploring = false;
      _status = AuthStatus.authenticated;
      _busy = false;
      notifyListeners();
      return true;
    } on TwoFactorRequiredException catch (e) {
      // Not an error — the password was right and a code is on its way.
      _challengeToken = e.challengeToken;
      _challengeMethod = e.method;
      _error = e.message;
      _busy = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _busy = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> signOut() async {
    await _auth.signOut();
    _user = null;
    _exploring = false;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  /// Permanently delete the account, then drop to signed-out.
  Future<bool> deleteAccount() async {
    try {
      await _auth.deleteAccount();
      _user = null;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// One-tap dev sign-in using a REAL account on the demo org (same as
  /// EventOxygen's Fast Login). DEBUG ONLY — hard no-op in release builds so
  /// the creds can never ship (the reel_moment leak lesson).
  static const _devEmail = 'jac.lightx@gmail.com';
  static const _devPass = 'aaaaaaaa';

  Future<bool> devSignIn() async {
    if (kReleaseMode) return false;
    return signIn(_devEmail, _devPass);
  }
}
