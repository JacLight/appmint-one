import 'package:flutter/foundation.dart';
import 'http_client.dart';

class LocationService {
  final AppengineHttpClient _http = appengineHttpClient;

  Future<List<Map<String, dynamic>>> getBusinessLocations() async {
    try {
      final response = await _http.post(
        '/repository/find/location',
        body: {
          'query': {},
          'options': {'pageSize': 200, 'sort': 'data.name', 'sortType': 1},
        },
      );
      List rawList;
      if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is List) {
        rawList = response;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('LocationService.getBusinessLocations failed: $e');
      return const [];
    }
  }
}

final locationService = LocationService();
