import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/environment.dart';

/// Dual-token Appmint client: an app token (Bearer) proves the app identity,
/// a user token (x-client-authorization) proves the signed-in user. Ported
/// from the dfw_errand / appmint_mobile pattern.
class AppengineHttpClient {
  static final AppengineHttpClient _instance = AppengineHttpClient._internal();
  factory AppengineHttpClient() => _instance;
  AppengineHttpClient._internal() : _transport = http.Client();

  @visibleForTesting
  AppengineHttpClient.forTesting(http.Client transport)
    : _transport = transport;

  final http.Client _transport;

  String? _appToken;
  String? _userToken;
  Future<String?> Function()? refreshUserToken;
  Future<String?>? _pendingUserRefresh;

  // Single-flight guard: concurrent callers share one in-flight token fetch
  // instead of each storming /profile/app/key.
  Future<String?>? _pendingToken;

  String get baseUrl => EnvironmentConfig.appengineEndpoint;
  bool get hasUserToken => _userToken != null && _userToken!.isNotEmpty;

  /// A transient failure means the request never reached the server (connection
  /// refused/reset, host lookup failed, timeout) — safe to retry. A real HTTP
  /// response (even a 4xx/5xx) is NOT transient.
  static bool _isTransient(Object e) {
    final s = e.toString().toLowerCase();
    return s.contains('socketexception') ||
        s.contains('connection refused') ||
        s.contains('connection reset') ||
        s.contains('connection closed') ||
        s.contains('failed host lookup') ||
        s.contains('network is unreachable') ||
        s.contains('timeoutexception') ||
        s.contains('timed out');
  }

  /// Fetch (or reuse an in-flight fetch of) the app token. Retries transient
  /// network failures with backoff so a brief outage self-heals.
  Future<String?> getAppToken() => _pendingToken ??= _fetchAppToken()
      .whenComplete(() => _pendingToken = null);

  Future<String?> _fetchAppToken() async {
    const maxAttempts = 4;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final uri = Uri.parse('$baseUrl/profile/app/key');
        final res = await _transport
            .post(
              uri,
              headers: {
                'Content-Type': 'application/json',
                'orgid': EnvironmentConfig.orgId,
              },
              body: jsonEncode({
                'appId': EnvironmentConfig.appId,
                'secret': EnvironmentConfig.appSecret,
                'key': EnvironmentConfig.appKey,
              }),
            )
            .timeout(const Duration(seconds: 30));
        if (res.statusCode >= 200 && res.statusCode < 300) {
          final body = jsonDecode(res.body);
          if (body['token'] != null) {
            _appToken = body['token'] as String;
            if (kDebugMode) print('🔑 Stowbo app token obtained');
            return _appToken;
          }
        }
        // A real response with bad creds — retrying won't help.
        if (kDebugMode) {
          print('❌ Invalid app key/secret/id (${res.statusCode})');
        }
        return null;
      } catch (e) {
        if (_isTransient(e) && attempt < maxAttempts) {
          final backoff = Duration(milliseconds: 400 * attempt);
          if (kDebugMode) {
            print(
              '⏳ App token attempt $attempt failed (${_short(e)}); '
              'retrying in ${backoff.inMilliseconds}ms',
            );
          }
          await Future.delayed(backoff);
          continue;
        }
        if (kDebugMode) print('❌ Failed to get app token: $e');
        return null;
      }
    }
    return null;
  }

  static String _short(Object e) {
    final s = e.toString();
    return s.length > 80 ? '${s.substring(0, 80)}…' : s;
  }

  Future<void> initialize() async => getAppToken();

  void setUserToken(String token) => _userToken = token;
  void clearUserToken() => _userToken = null;

  Map<String, String> _headers({bool useUserToken = true}) {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Live operator data — never let a proxy/browser hand back a stale copy.
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
      'orgid': EnvironmentConfig.orgId,
      'shared-org-id': EnvironmentConfig.orgId,
      if (EnvironmentConfig.domainAsOrg) 'domainAsOrg': 'true',
    };
    h['Authorization'] = 'Bearer ${_appToken ?? ''}';
    if (useUserToken && hasUserToken) {
      h['x-client-authorization'] = 'Bearer $_userToken';
    }
    return h;
  }

  dynamic _handle(http.Response res) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (res.body.isEmpty) return null;
      return jsonDecode(res.body);
    }
    String? msg;
    try {
      final e = jsonDecode(res.body);
      msg = e['message'] is List
          ? (e['message'] as List).join(', ')
          : (e['message'] ?? e['error'] ?? e['msg']) as String?;
    } catch (_) {}
    throw Exception(
      msg ??
          (res.statusCode == 401
              ? 'Please sign in again'
              : res.statusCode == 404
              ? 'Not found'
              : res.statusCode >= 500
              ? 'Server error — try again'
              : 'Request failed (${res.statusCode})'),
    );
  }

  Future<dynamic> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
    bool useUserToken = true,
  }) => _request(
    method,
    path,
    body: body,
    queryParams: queryParams,
    useUserToken: useUserToken,
  );

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
    bool useUserToken = true,
    bool retryAuth = true,
    bool responseBytes = false,
  }) async {
    try {
      if (_appToken == null) await getAppToken();
      if (kDebugMode) print('📤 $method $path');

      // On Flutter web, browser HTTP caching can serve a stale GET response even
      // after new data is written (e.g. a booking just taken in wouldn't appear
      // in the list). Live operator data must never be cached, so bust it with a
      // per-request token on GETs. Writes (POST/PATCH/…) are never cached.
      final isGet = method.toUpperCase() == 'GET';
      final effectiveParams = isGet
          ? {
              ...?queryParams,
              '_ts': DateTime.now().microsecondsSinceEpoch.toString(),
            }
          : queryParams;
      final uri = Uri.parse(
        '$baseUrl$path',
      ).replace(queryParameters: effectiveParams);
      final encoded = body != null ? jsonEncode(body) : null;

      // Retry the send on transient network errors (connection refused/reset,
      // host lookup, timeout) with backoff so a brief outage self-heals. Also
      // recovers the token if it couldn't be fetched while the server was down.
      const maxAttempts = 4;
      http.Response? res;
      String? sentUserToken;
      String? sentAppToken;
      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        if (_appToken == null) await getAppToken();
        sentUserToken = useUserToken ? _userToken : null;
        sentAppToken = _appToken;
        final headers = _headers(useUserToken: useUserToken);
        try {
          res = await _send(method, uri, headers, encoded);
          break;
        } catch (e) {
          if (_isTransient(e) && attempt < maxAttempts) {
            final backoff = Duration(milliseconds: 400 * attempt);
            if (kDebugMode) {
              print(
                '⏳ $method $path attempt $attempt failed '
                '(${_short(e)}); retrying in ${backoff.inMilliseconds}ms',
              );
            }
            await Future.delayed(backoff);
            continue;
          }
          rethrow;
        }
      }

      if (res!.statusCode == 401 && retryAuth) {
        // Customer and app credentials expire independently. Refresh the
        // customer's session once, shared by concurrent operator requests.
        // Anonymous/refresh calls must never recursively refresh the user.
        if (sentUserToken != null &&
            _userToken == sentUserToken &&
            refreshUserToken != null) {
          await (_pendingUserRefresh ??= Future.sync(
            refreshUserToken!,
          ).whenComplete(() => _pendingUserRefresh = null));
        }
        if (sentUserToken != null && !hasUserToken) return _handle(res);
        final userRenewed =
            sentUserToken != null && _userToken != sentUserToken;
        if (!userRenewed && _appToken == sentAppToken) {
          _appToken = null;
          await getAppToken();
        }
        if (_appToken != null) {
          return await _request(
            method,
            path,
            body: body,
            queryParams: queryParams,
            useUserToken: useUserToken,
            retryAuth: false,
            responseBytes: responseBytes,
          );
        }
      }
      if (responseBytes && res.statusCode >= 200 && res.statusCode < 300)
        return res.bodyBytes;
      return _handle(res);
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Network error: $e');
    }
  }

  Future<http.Response> _send(
    String method,
    Uri uri,
    Map<String, String> headers,
    String? encoded,
  ) {
    const t = Duration(seconds: 30);
    switch (method.toUpperCase()) {
      case 'GET':
        return _transport.get(uri, headers: headers).timeout(t);
      case 'POST':
        return _transport.post(uri, headers: headers, body: encoded).timeout(t);
      case 'PATCH':
        return _transport
            .patch(uri, headers: headers, body: encoded)
            .timeout(t);
      case 'PUT':
        return _transport.put(uri, headers: headers, body: encoded).timeout(t);
      case 'DELETE':
        return _transport.delete(uri, headers: headers).timeout(t);
      default:
        throw Exception('Unsupported method $method');
    }
  }

  Future<dynamic> get(
    String p, {
    Map<String, String>? queryParams,
    bool useUserToken = true,
  }) => request('GET', p, queryParams: queryParams, useUserToken: useUserToken);
  Future<dynamic> post(
    String p, {
    Map<String, dynamic>? body,
    bool useUserToken = true,
  }) => request('POST', p, body: body, useUserToken: useUserToken);
  Future<dynamic> patch(
    String p, {
    Map<String, dynamic>? body,
    bool useUserToken = true,
  }) => request('PATCH', p, body: body, useUserToken: useUserToken);
  Future<dynamic> put(
    String p, {
    Map<String, dynamic>? body,
    bool useUserToken = true,
  }) => request('PUT', p, body: body, useUserToken: useUserToken);
  Future<dynamic> delete(String p, {bool useUserToken = true}) =>
      request('DELETE', p, useUserToken: useUserToken);

  /// Authenticated binary GET using the same token refresh/retry path as JSON.
  Future<Uint8List> getBytes(
    String path, {
    Map<String, String>? queryParams,
  }) async =>
      await _request('GET', path, queryParams: queryParams, responseBytes: true)
          as Uint8List;

  /// Multipart upload (field name `file`). Returns the saved-file response.
  Future<Map<String, dynamic>> uploadMultipart(
    String path, {
    required List<int> bytes,
    required String fileName,
    Map<String, String>? fields,
  }) async {
    if (_appToken == null) await getAppToken();
    final uri = Uri.parse('$baseUrl$path');
    final req = http.MultipartRequest('POST', uri);
    req.headers.addAll({
      'orgid': EnvironmentConfig.orgId,
      'shared-org-id': EnvironmentConfig.orgId,
      if (EnvironmentConfig.domainAsOrg) 'domainAsOrg': 'true',
      'Authorization': 'Bearer ${_appToken ?? ''}',
      if (hasUserToken) 'x-client-authorization': 'Bearer $_userToken',
    });
    if (fields != null) req.fields.addAll(fields);
    req.files.add(
      http.MultipartFile.fromBytes('file', bytes, filename: fileName),
    );
    final streamed = await req.send().timeout(const Duration(seconds: 60));
    final res = await http.Response.fromStream(streamed);
    final body = _handle(res);
    return body is Map ? Map<String, dynamic>.from(body) : {};
  }
}

final appengineHttpClient = AppengineHttpClient();
