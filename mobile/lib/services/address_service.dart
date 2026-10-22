import 'http_client.dart';

/// Address autocomplete via the storefront shipping controller (Google Places
/// under the hood). Used by the host create-listing address field.
class AddressPrediction {
  final String placeId;
  final String description;
  AddressPrediction(this.placeId, this.description);
}

class AddressService {
  final AppengineHttpClient _http = appengineHttpClient;

  /// POST /shipping/address-autocomplete { input } → predictions.
  Future<List<AddressPrediction>> autocomplete(String input) async {
    if (input.trim().length < 3) return [];
    final res = await _http.post('/shipping/address-autocomplete',
        body: {'input': input});
    dynamic list;
    if (res is List) {
      list = res;
    } else if (res is Map) {
      list = res['predictions'] ?? res['data'] ?? res['results'] ?? [];
    }
    if (list is! List) return [];
    return list.whereType<Map>().map((p) {
      final m = Map<String, dynamic>.from(p);
      return AddressPrediction(
        (m['placeId'] ?? m['place_id'] ?? '').toString(),
        (m['description'] ?? m['text'] ?? m['formattedAddress'] ?? '')
            .toString(),
      );
    }).where((p) => p.description.isNotEmpty).toList();
  }

  /// GET /shipping/place-details/:placeId → structured address (+ lat/lng).
  Future<Map<String, dynamic>?> placeDetails(String placeId) async {
    final res = await _http.get('/shipping/place-details/$placeId');
    if (res is Map) return Map<String, dynamic>.from(res['data'] ?? res);
    return null;
  }
}

final addressService = AddressService();
