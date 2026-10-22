import 'package:flutter/foundation.dart';
import 'http_client.dart';

/// Repository service for data operations using centralized HTTP client
/// Mirrors the web app's request-queue.ts functionality
class RepositoryService {
  static final RepositoryService _instance = RepositoryService._internal();
  factory RepositoryService() => _instance;
  RepositoryService._internal();

  final AppengineHttpClient _http = appengineHttpClient;

  void setAuth(String accessToken, String orgId) {
    _http.setAuth(accessToken, orgId);
    if (kDebugMode) {
      print('🔐 RepositoryService auth set for org: $orgId');
    }
  }

  /// Find data by datatype with query and options
  /// POST /repository/find/:datatype
  /// Example: findData('customer', {}, { pageSize: 1000 })
  Future<Map<String, dynamic>> findData(
    String datatype, {
    Map<String, dynamic>? query,
    Map<String, dynamic>? options,
  }) async {
    return await _http.post(
      '/repository/find/$datatype',
      body: {
        'query': query ?? {},
        'options': options ?? {'pageSize': 1000},
      },
    );
  }

  /// Get single item by datatype and ID
  /// GET /repository/get/:datatype/:id
  /// Example: getData('customer', 'customer-123')
  Future<Map<String, dynamic>> getData(String datatype, String sk) async {
    return await _http.get('/repository/get/$datatype/$sk');
  }

  /// Save data (create or update)
  /// POST /repository/create for new records; /repository/update/:id for edits.
  /// Example: saveData({ sk: 'customer-123', datatype: 'customer', data: {...} })
  Future<Map<String, dynamic>> saveData(Map<String, dynamic> item) async {
    final sk = item['sk'];
    if (sk == null || sk.isEmpty) {
      return await _http.post('/repository/create', body: {...item, 'isNew': true});
    }
    return await _http.post('/repository/update/$sk', body: item);
  }

  /// Delete data by datatype and ID
  /// DELETE /repository/delete/:datatype/:id
  /// Example: deleteData('customer', 'customer-123')
  Future<void> deleteData(String datatype, String sk) async {
    await _http.delete('/repository/delete/$datatype/$sk');
  }

  /// Patch named fields on an existing record. Server's updatePartial
  /// takes exact record paths and writes them via $set. Domain fields must
  /// include the `data.` prefix; it is NOT added by the server.
  ///
  /// Example:
  ///   updatePartial('location', 'main-st-cafe', {
  ///     'data.address.street1': '123 Main St',
  ///     'data.address.city': 'Lagos',
  ///   })
  Future<Map<String, dynamic>> updatePartial(
    String datatype,
    String sk,
    Map<String, dynamic> fields,
  ) async {
    final response = await _http.post(
      '/repository/update-partial/$datatype/$sk',
      body: fields,
    );
    if (response is Map<String, dynamic>) return response;
    if (response is Map) return Map<String, dynamic>.from(response);
    return const {};
  }

  /// Search data by keyword
  /// POST /repository/search/:datatype
  /// Example: search('customer', 'john', {}, { pageSize: 50 })
  Future<Map<String, dynamic>> search(
    String datatype,
    String keyword, {
    Map<String, dynamic>? query,
    Map<String, dynamic>? options,
  }) async {
    return await _http.post(
      '/repository/search/$datatype',
      body: {
        'keyword': keyword,
        'query': query ?? {},
        'options': options ?? {'pageSize': 100},
      },
    );
  }

  /// Process custom API endpoint (for CRM and other non-repository endpoints)
  /// Uses GET method for endpoints like crm/inbox/conversations
  /// Example: processData('crm/inbox/conversations')
  Future<dynamic> processData(String apiName, [dynamic data]) async {
    return await _http.get('/$apiName');
  }
}

// Singleton instance
final repositoryService = RepositoryService();
