import 'http_client.dart';
import '../models/community_message.dart';

/// REST half of the community messaging + people API (the `/client/community/*`
/// customer routes — the same surface event_app uses). Realtime is handled by
/// [CommunityChatService]; this covers history, threads, and sending as a
/// fallback when the socket isn't connected.
class CommunityService {
  final AppengineHttpClient _http = appengineHttpClient;

  /// GET /client/community/messages/threads → conversation summaries.
  Future<List<Map<String, dynamic>>> getThreads() async {
    final res = await _http.get('/client/community/messages/threads');
    return _list(res);
  }

  /// GET /client/community/messages/thread/:userId → message history with one
  /// person (userId = their email or sk).
  Future<List<CommunityMessage>> getThreadMessages(String userId) async {
    final res =
        await _http.get('/client/community/messages/thread/$userId');
    return _list(res).map(CommunityMessage.fromJson).toList();
  }

  /// POST /client/community/messages → send (REST fallback; also persists
  /// `context` which the socket path drops).
  Future<CommunityMessage?> sendMessage({
    required String recipientId,
    required String content,
    String contentType = 'text',
    Map<String, dynamic>? context,
  }) async {
    final res = await _http.post('/client/community/messages', body: {
      'recipientId': recipientId,
      'content': content,
      'contentType': contentType,
      if (context != null) 'context': context,
    });
    if (res is Map) return CommunityMessage.fromJson(Map<String, dynamic>.from(res));
    return null;
  }

  /// POST /client/community/messages/thread/:userId/read
  Future<void> markThreadRead(String userId) =>
      _http.post('/client/community/messages/thread/$userId/read');

  /// GET /client/community/messages/unread-count → { count }
  Future<int> unreadCount() async {
    final res = await _http.get('/client/community/messages/unread-count');
    if (res is Map) {
      final c = res['count'] ?? res['data'];
      return c is num ? c.toInt() : int.tryParse('$c') ?? 0;
    }
    return 0;
  }

  /// GET /client/community/people/:id/profile → a public host/guest profile.
  Future<Map<String, dynamic>?> getProfile(String idOrEmail) async {
    final res =
        await _http.get('/client/community/people/$idOrEmail/profile');
    if (res is Map) return Map<String, dynamic>.from(res['data'] ?? res);
    return null;
  }

  // ── Follow (asymmetric "connect") ──────────────────────────────────────
  /// POST /client/community/follow { following, followingType }
  Future<void> follow(String followingId) => _http.post(
      '/client/community/follow',
      body: {'following': followingId, 'followingType': 'customer'});

  /// DELETE /client/community/follow/:followId
  Future<void> unfollow(String followId) =>
      _http.delete('/client/community/follow/$followId');

  /// GET /client/community/following → who I follow.
  Future<List<Map<String, dynamic>>> getFollowing() async {
    final res = await _http.get('/client/community/following');
    return _list(res);
  }

  List<Map<String, dynamic>> _list(dynamic res) {
    dynamic list;
    if (res is List) {
      list = res;
    } else if (res is Map) {
      list = res['data'] ?? res['items'] ?? res['messages'] ?? [];
    }
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}

final communityService = CommunityService();
