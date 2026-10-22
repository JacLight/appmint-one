import 'http_client.dart';

/// Uploads a file to the server (customer file store) and returns its URL.
/// Storage + processing happen server-side.
class FileService {
  final AppengineHttpClient _http = appengineHttpClient;

  Future<String?> upload(List<int> bytes, String fileName,
      {String location = 'stowbo/custody'}) async {
    final res = await _http.uploadMultipart(
      '/client-data/files/upload',
      bytes: bytes,
      fileName: fileName,
      fields: {'location': location},
    );
    final data = (res['data'] is Map) ? res['data'] as Map : res;
    return (data['url'] ??
            data['path'] ??
            data['location'] ??
            res['url'])
        ?.toString();
  }
}

final fileService = FileService();
