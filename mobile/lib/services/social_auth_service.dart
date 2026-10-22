import 'package:flutter/foundation.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../config/environment.dart';

/// Native OAuth (Google / Facebook). Returns a normalized profile the server's
/// `customer/social-login` expects, or null if the user cancels.
class SocialProfile {
  final String provider; // 'google' | 'facebook'
  final String email;
  final String? firstName;
  final String? lastName;
  final String? image;
  final String providerId;
  final String? accessToken;
  final String? idToken;

  SocialProfile({
    required this.provider,
    required this.email,
    this.firstName,
    this.lastName,
    this.image,
    required this.providerId,
    this.accessToken,
    this.idToken,
  });

  Map<String, dynamic> toBody() => {
        'user': {
          'email': email,
          if (firstName != null) 'firstName': firstName,
          if (lastName != null) 'lastName': lastName,
          if (image != null) 'image': image,
        },
        'account': {
          'provider': provider,
          'providerId': providerId,
          if (accessToken != null) 'accessToken': accessToken,
          if (idToken != null) 'idToken': idToken,
        },
      };
}

class SocialAuthService {
  // serverClientId = the web client, so the returned idToken is audienced for
  // the backend to verify. (Native sign-in still needs platform OAuth clients.)
  final GoogleSignIn _google = GoogleSignIn(
    scopes: const ['email', 'profile'],
    serverClientId: EnvironmentConfig.googleServerClientId,
  );

  /// Sign in with Apple is an Apple-platform feature — hide it on Android/web.
  bool get appleAvailable =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.macOS);

  Future<SocialProfile?> apple() async {
    try {
      final cred = await SignInWithApple.getAppleIDCredential(scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ]);
      // Apple returns email/name only on the FIRST authorization.
      return SocialProfile(
        provider: 'apple',
        email: cred.email ?? '',
        firstName: cred.givenName,
        lastName: cred.familyName,
        providerId: cred.userIdentifier ?? '',
        idToken: cred.identityToken,
        accessToken: cred.authorizationCode,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) return null;
      rethrow;
    } catch (e) {
      if (kDebugMode) print('Apple sign-in failed: $e');
      rethrow;
    }
  }

  Future<SocialProfile?> google() async {
    try {
      await _google.signOut(); // force the account chooser
      final acct = await _google.signIn();
      if (acct == null) return null; // cancelled
      final auth = await acct.authentication;
      final parts = (acct.displayName ?? '').split(' ');
      return SocialProfile(
        provider: 'google',
        email: acct.email,
        firstName: parts.isNotEmpty ? parts.first : null,
        lastName: parts.length > 1 ? parts.sublist(1).join(' ') : null,
        image: acct.photoUrl,
        providerId: acct.id,
        accessToken: auth.accessToken,
        idToken: auth.idToken,
      );
    } catch (e) {
      if (kDebugMode) print('Google sign-in failed: $e');
      rethrow;
    }
  }

  Future<SocialProfile?> facebook() async {
    try {
      final res = await FacebookAuth.instance
          .login(permissions: ['email', 'public_profile']);
      if (res.status != LoginStatus.success || res.accessToken == null) {
        return null; // cancelled / failed
      }
      final data = await FacebookAuth.instance.getUserData(
          fields: 'id,email,first_name,last_name,picture.width(400)');
      final pic = (data['picture'] is Map &&
              (data['picture']['data'] is Map))
          ? data['picture']['data']['url']?.toString()
          : null;
      return SocialProfile(
        provider: 'facebook',
        email: (data['email'] ?? '').toString(),
        firstName: data['first_name']?.toString(),
        lastName: data['last_name']?.toString(),
        image: pic,
        providerId: (data['id'] ?? '').toString(),
        accessToken: res.accessToken!.tokenString,
      );
    } catch (e) {
      if (kDebugMode) print('Facebook sign-in failed: $e');
      rethrow;
    }
  }
}

final socialAuthService = SocialAuthService();
