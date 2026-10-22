import 'http_client.dart';
import 'base_data_service.dart';

/// Service for Twilio-based SMS, voice calls, and recordings.
/// All data comes from the server — we don't call Twilio directly.
class CommunicationsService {
  final AppengineHttpClient _http = appengineHttpClient;

  // ─── SMS ───

  /// Get SMS messages with optional filters
  Future<List<Map<String, dynamic>>> getSmsMessages({
    String? from,
    String? to,
    String? status,
    String? dateFrom,
    String? dateTo,
    int limit = 50,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      if (from != null) 'from': from,
      if (to != null) 'to': to,
      if (status != null) 'status': status,
      if (dateFrom != null) 'dateFrom': dateFrom,
      if (dateTo != null) 'dateTo': dateTo,
    };
    final response = await _http.get('/crm/communications/sms', queryParams: params);
    final data = response['data'] ?? response['messages'] ?? response;
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Send SMS via POST /crm/inbox/update?send=true
  /// Matches React: genericService.createBaseData('message', '', {...}) then processData(crm_inbox_update, msg, '?send=true')
  Future<Map<String, dynamic>> sendSms({
    required String to,
    required String body,
    String? from,
  }) async {
    final messageData = await baseDataService.createBaseData('message', {
      'to': [to],
      'text': body,
      'deliveryType': 'sms',
      'type': 'message',
      'status': 'draft',
      if (from != null) 'from': from,
    });

    final response = await _http.request('POST', '/crm/inbox/update',
      queryParams: {'send': 'true'},
      body: messageData,
    );
    return response is Map<String, dynamic> ? response : {};
  }

  // ─── Voice Calls ───

  /// Get call logs from Twilio via GET /crm/communications/calls
  Future<List<Map<String, dynamic>>> getCallLogs() async {
    final response = await _http.get('/crm/communications/calls');
    final data = response['data'] ?? response['calls'] ?? response;
    // Server wraps Twilio errors as {"data":{"error":{...}}}
    if (data is Map && data.containsKey('error')) {
      throw Exception(data['error']?['message'] ?? 'Failed to get calls');
    }
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Get voice access token for Twilio client SDK via /phone/token
  Future<String> getVoiceToken() async {
    final response = await _http.post('/phone/token');
    // Server returns raw JWT string or JSON with token field
    if (response is String) return response;
    if (response is Map) return response['token']?.toString() ?? '';
    return '';
  }

  /// Get contacts with phone numbers (from CRM customer datatype)
  Future<List<Map<String, dynamic>>> getContacts({int pageSize = 100, String? search}) async {
    final response = await _http.post('/repository/find/customer', body: {
      'query': search != null && search.isNotEmpty
          ? {'\$or': [
              {'data.firstName': {'\$regex': search, '\$options': 'i'}},
              {'data.lastName': {'\$regex': search, '\$options': 'i'}},
              {'data.phone': {'\$regex': search, '\$options': 'i'}},
              {'data.email': {'\$regex': search, '\$options': 'i'}},
            ]}
          : {},
      'options': {'pageSize': pageSize},
    });
    final data = response['data'] ?? response;
    if (data is List) {
      // Filter to contacts that have a phone number
      return data
          .whereType<Map<String, dynamic>>()
          .where((c) {
            final d = c['data'] as Map<String, dynamic>?;
            return d != null && d['phone'] != null && d['phone'].toString().isNotEmpty;
          })
          .toList();
    }
    return [];
  }

  /// Get recordings
  Future<List<Map<String, dynamic>>> getRecordings({int limit = 50}) async {
    final params = <String, String>{'limit': limit.toString()};
    final response = await _http.get('/crm/communications/recordings', queryParams: params);
    final data = response['data'] ?? response['recordings'] ?? response;
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Get a specific recording with transcript
  Future<Map<String, dynamic>> getRecording(String recordingSid) async {
    final response = await _http.get('/crm/communications/recordings/$recordingSid');
    return response is Map<String, dynamic> ? response : {};
  }

  /// Get all communications (SMS + voice combined)
  Future<List<Map<String, dynamic>>> getAllCommunications({int limit = 50}) async {
    final params = <String, String>{'limit': limit.toString()};
    final response = await _http.get('/crm/communications/all', queryParams: params);
    final data = response['data'] ?? response['items'] ?? response;
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  // ─── Phone Numbers ───

  /// List configured phone numbers
  Future<List<Map<String, dynamic>>> getPhoneNumbers() async {
    final response = await _http.get('/phone/numbers');
    final data = response['data'] ?? response['numbers'] ?? response;
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Get the system phone number
  Future<Map<String, dynamic>> getSystemPhone() async {
    final response = await _http.get('/phone/system');
    return response is Map<String, dynamic> ? response : {};
  }

  /// Get phones assigned to the currently-logged-in user — direct
  /// (user.data.phones[]) OR via any user group they belong to
  /// (usergroup.data.sharedPhones[]). This is the authoritative source
  /// per phone.controller.ts:396 — same `phones[]` that /phone/voice/
  /// register-device embeds as `assignedPhones[]`.
  ///
  /// Returns a list of:
  /// `{ id, phoneNumber, friendlyName, assignment: 'direct' | 'group' }`
  Future<List<Map<String, dynamic>>> getUserPhones() async {
    final response = await _http.get('/phone/user-phones');
    final data = response is Map ? (response['phones'] ?? response['data'] ?? []) : response;
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }
}

final communicationsService = CommunicationsService();
