import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/environment.dart';

/// Centralized HTTP client for ALL appengine API calls
/// Handles pre-call logging, post-call logging, auth headers, and error handling
class AppengineHttpClient {
  static final AppengineHttpClient _instance = AppengineHttpClient._internal();
  factory AppengineHttpClient() => _instance;
  AppengineHttpClient._internal();

  String? _accessToken;
  String? _orgId;
  Future<bool>? _refreshFuture;
  int _authGeneration = 0;

  /// Callback for token refresh — set by AuthProvider
  Future<String?> Function()? onTokenRefresh;
  /// Callback for forced logout — set by AuthProvider
  VoidCallback? onForceLogout;

  String get baseUrl => EnvironmentConfig.appengineEndpoint;

  /// The org currently stamped on the `orgid` header of every request.
  /// Read by the softphone service so it can bind the Twilio Device to the
  /// per-org voice identity (`user:<orgId>:<email>`) and re-bind on org change.
  String? get orgId => _orgId;

  /// Set authentication credentials
  void setAuth(String accessToken, String orgId) {
    if (_orgId != orgId) {
      _authGeneration++;
      _refreshFuture = null;
    }
    _accessToken = accessToken;
    _orgId = orgId;
    if (kDebugMode) {
      print('🔐 Auth set for org: $orgId');
    }
  }

  /// Clear authentication
  void clearAuth() {
    _authGeneration++;
    _refreshFuture = null;
    _accessToken = null;
    _orgId = null;
  }

  /// Public auth headers — for multipart requests where callers build
  /// their own http.Request (e.g. FileService.upload).
  Map<String, String> getAuthHeaders() {
    final headers = <String, String>{};
    if (_accessToken != null && _accessToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }
    if (_orgId != null) headers['orgid'] = _orgId!;
    return headers;
  }

  /// Build headers with auth
  /// [sendOrg] false leaves the `orgid` header off entirely.
  ///
  /// Only the account-directory lookup needs this, and it genuinely does: it
  /// runs *before* anyone knows which org they are signing into, and the
  /// client may still be holding the org of whoever signed in last. Sending a
  /// stale org there makes the server answer 404 for the route, so a device
  /// that has ever signed into an org that no longer resolves can never look
  /// an email up again — the sign-in screen dead-ends for good.
  Map<String, String> _buildHeaders({bool requireAuth = true, bool sendOrg = true}) {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (requireAuth) {
      if (_accessToken == null || _orgId == null || _accessToken!.isEmpty) {
        throw Exception('Authentication required. Please login first.');
      }
      headers['Authorization'] = 'Bearer $_accessToken';
      headers['orgid'] = _orgId!; // lowercase 'orgid'
    } else if (sendOrg && _orgId != null) {
      // For login/register, include orgId if available
      headers['orgid'] = _orgId!;
    }

    return headers;
  }

  /// Log request details (pre-call)
  void _logRequest(String method, String path, {Map<String, dynamic>? body, Map<String, String>? queryParams}) {
    if (kDebugMode) {
      print('');
      print('📤 $method $path');
      if (queryParams != null && queryParams.isNotEmpty) {
        print('   Query: $queryParams');
      }
      if (body != null) {
        print('   Body: ${jsonEncode(body)}');
      }
      print('   Auth: ${_accessToken != null ? "Bearer ${_accessToken!.substring(0, _accessToken!.length > 20 ? 20 : _accessToken!.length)}..." : "None"}');
      print('   OrgID: ${_orgId ?? "None"}');
    }
  }

  /// Log response details (post-call)
  void _logResponse(int statusCode, dynamic responseBody, {String? error}) {
    if (kDebugMode) {
      if (error != null) {
        print('❌ Error: $error');
      } else if (statusCode >= 200 && statusCode < 300) {
        print('✅ $statusCode Success');
        if (responseBody != null) {
          final bodyStr = responseBody is String ? responseBody : jsonEncode(responseBody);
          print('   Response: ${bodyStr.length > 200 ? "${bodyStr.substring(0, 200)}..." : bodyStr}');
        }
      } else {
        print('❌ $statusCode Failed');
        if (responseBody != null) {
          print('   Response: $responseBody');
        }
      }
      print('');
    }
  }

  /// Handle HTTP response
  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        _logResponse(response.statusCode, null);
        return null;
      }
      try {
        final body = jsonDecode(response.body);
        _logResponse(response.statusCode, body);
        return body;
      } on FormatException {
        // Response is not JSON (e.g. raw token string)
        _logResponse(response.statusCode, response.body);
        return response.body;
      }
    } else {
      // Pull the server's actual error message out of the response body
      // FIRST, even for the named status codes (401/403/404/5xx). NestJS
      // HttpException always serializes as { statusCode, message, error }.
      String? serverMessage;
      try {
        final errorBody = jsonDecode(response.body);
        if (errorBody is Map) {
          // The backend's custom exception filter emits
          //   { statusCode, error, path, method, timeStamp }
          // while raw NestJS HttpException emits { statusCode, message, error }.
          // Try both shapes — the human-readable text might live under
          // either `message` (default NestJS) or `error` (our filter).
          for (final key in ['message', 'error']) {
            final v = errorBody[key];
            if (v is String && v.isNotEmpty) {
              serverMessage = v;
              break;
            }
            if (v is List && v.isNotEmpty) {
              serverMessage = v.join('; ');
              break;
            }
          }
        }
      } catch (_) {/* body wasn't JSON */}

      // ALWAYS print the raw body on error — even when serverMessage was
      // extracted — so the operator can see what the server actually
      // said (e.g. NestJS validation errors with details, or the URL
      // path the response refers to).
      if (kDebugMode) {
        print('❌ ${response.statusCode} ${response.request?.method ?? ''} '
            '${response.request?.url ?? ''}');
        final body = response.body;
        if (body.isNotEmpty) {
          print('   Body: ${body.length > 500 ? "${body.substring(0, 500)}..." : body}');
        }
      }

      String errorMessage;
      if (response.statusCode == 401) {
        errorMessage = serverMessage ?? 'Token expired';
      } else if (response.statusCode == 403) {
        errorMessage = serverMessage ?? 'Forbidden — insufficient permissions';
      } else if (response.statusCode == 404) {
        // Resource-not-found is uniquely confusing because the URL path
        // is the most useful debugging info. Include it in the message
        // when the server's message is generic / missing.
        final path = response.request?.url.path ?? '';
        errorMessage = serverMessage != null && serverMessage != 'Not Found'
            ? serverMessage
            : 'Not found: $path';
      } else if (response.statusCode >= 500) {
        errorMessage = serverMessage ?? 'Server error — please try again later';
      } else {
        errorMessage = serverMessage ?? 'Request failed with status ${response.statusCode}';
      }
      _logResponse(response.statusCode, response.body, error: errorMessage);
      throw Exception(errorMessage);
    }
  }

  Future<http.Response> _executeRequest(String method, Uri uri, Map<String, String> headers, Map<String, dynamic>? body) async {
    switch (method.toUpperCase()) {
      case 'GET': return http.get(uri, headers: headers).timeout(const Duration(seconds: 30));
      case 'POST': return http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null).timeout(const Duration(seconds: 30));
      case 'PUT': return http.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null).timeout(const Duration(seconds: 30));
      case 'PATCH': return http.patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null).timeout(const Duration(seconds: 30));
      case 'DELETE': return http.delete(uri, headers: headers).timeout(const Duration(seconds: 30));
      default: throw Exception('Unsupported HTTP method: $method');
    }
  }

  Future<bool> _refreshAuthentication(int generation) async {
    if (_refreshFuture case final pending?) return pending;
    final pending = _performRefresh(generation);
    _refreshFuture = pending;
    try {
      return await pending;
    } finally {
      if (identical(_refreshFuture, pending)) _refreshFuture = null;
    }
  }

  Future<bool> _performRefresh(int generation) async {
    try {
      final token = await onTokenRefresh?.call();
      if (generation != _authGeneration) return false;
      if (token != null && token.isNotEmpty) {
        _accessToken = token;
        return true;
      }
    } catch (_) {
      // A refresh failure is handled once for every waiting request.
    }
    if (generation == _authGeneration) onForceLogout?.call();
    return false;
  }

  /// Generic request method - ALL API calls go through this
  Future<dynamic> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
    bool requireAuth = true,
    bool sendOrg = true,
  }) async {
    try {
      _logRequest(method, path, body: body, queryParams: queryParams);

      // Strip bad query params
      Map<String, String>? cleanParams;
      if (queryParams != null) {
        cleanParams = Map.fromEntries(queryParams.entries.where((e) {
          final v = e.value.trim();
          return v.isNotEmpty && v != 'null' && v != 'NaN';
        }));
        if (cleanParams.isEmpty) cleanParams = null;
      }

      final uri = Uri.parse('$baseUrl$path').replace(queryParameters: cleanParams);
      final headers = _buildHeaders(requireAuth: requireAuth, sendOrg: sendOrg);

      final requestGeneration = _authGeneration;
      http.Response response = await _executeRequest(method, uri, headers, body);

      // All requests rejected with the same expired token share one refresh.
      // A late 401 can arrive after refresh already finished; retry it with
      // the current token without rotating the refresh token a second time.
      if (response.statusCode == 401 && requireAuth) {
        if (requestGeneration != _authGeneration) {
          throw Exception('Session changed. Please try again.');
        }
        if (headers['Authorization'] == 'Bearer $_accessToken') {
          final refreshed = await _refreshAuthentication(requestGeneration);
          if (!refreshed) {
            throw Exception('Session expired. Please login again.');
          }
        }
        if (requestGeneration != _authGeneration) {
          throw Exception('Session changed. Please try again.');
        }
        response = await _executeRequest(
          method,
          uri,
          _buildHeaders(requireAuth: requireAuth, sendOrg: sendOrg),
          body,
        );
      }

      return _handleResponse(response);
    } catch (e) {
      _logResponse(0, null, error: e.toString());
      if (e is Exception) rethrow;
      throw Exception('Network error: $e');
    }
  }

  /// Convenience methods
  Future<dynamic> get(String path, {Map<String, String>? queryParams, bool requireAuth = true}) {
    return request('GET', path, queryParams: queryParams, requireAuth: requireAuth);
  }

  Future<dynamic> post(String path,
      {Map<String, dynamic>? body, bool requireAuth = true, bool sendOrg = true}) {
    return request('POST', path, body: body, requireAuth: requireAuth, sendOrg: sendOrg);
  }

  Future<dynamic> put(String path, {Map<String, dynamic>? body, bool requireAuth = true}) {
    return request('PUT', path, body: body, requireAuth: requireAuth);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body, bool requireAuth = true}) {
    return request('PATCH', path, body: body, requireAuth: requireAuth);
  }

  Future<dynamic> delete(String path, {bool requireAuth = true}) {
    return request('DELETE', path, requireAuth: requireAuth);
  }
}

// Singleton instance
final appengineHttpClient = AppengineHttpClient();
