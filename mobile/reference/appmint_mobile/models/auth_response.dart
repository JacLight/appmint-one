import 'user_model.dart';

class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final UserModel user;
  final int expiresIn;

  /// The `user` object exactly as the server sent it.
  ///
  /// [UserModel] types `permissions` as a list of strings, but the server
  /// sends a map (`content`, `component`, and now the menu access). Keeping
  /// the raw copy means nothing is lost on the way through, and
  /// AppVisibilityProvider can read the menu paths without reshaping a model
  /// the rest of the app depends on.
  final Map<String, dynamic>? rawUser;

  AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    this.expiresIn = 3600,
    this.rawUser,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['token'] ?? json['access_token'] ?? json['accessToken'] ?? '',
      refreshToken: json['refreshToken'] ?? json['refresh_token'] ?? '',
      user: UserModel.fromJson(json['user'] ?? {}),
      expiresIn: json['expires_in'] ?? json['expiresIn'] ?? 3600,
      rawUser: json['user'] is Map
          ? Map<String, dynamic>.from(json['user'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'user': user.toJson(),
      'expires_in': expiresIn,
    };
  }
}
