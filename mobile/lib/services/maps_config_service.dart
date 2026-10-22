import 'http_client.dart';

/// Fetches the org's Google Maps key from the server at runtime
/// (GET /shipping/google-keys → { mapsApiKey, source, billable }). The key is
/// cached in memory for the session only — never written to the manifest,
/// Info.plist, or storage.
class MapsConfigService {
  final AppengineHttpClient _http = appengineHttpClient;
  String? _key;

  Future<String?> mapsApiKey() async {
    if (_key != null) return _key;
    try {
      final res = await _http.get('/shipping/google-keys');
      if (res is Map) {
        final k = (res['mapsApiKey'] ?? '').toString();
        if (k.isNotEmpty) _key = k;
      }
    } catch (_) {}
    return _key;
  }
}

final mapsConfigService = MapsConfigService();
