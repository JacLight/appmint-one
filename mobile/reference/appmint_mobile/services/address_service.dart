import 'dart:convert';

import 'package:flutter/services.dart';

import 'http_client.dart';

class AddressOption {
  final String code;
  final String name;
  const AddressOption(this.code, this.name);
}

class AddressCatalog {
  final List<AddressOption> countries;
  final Map<String, List<AddressOption>> regions;
  const AddressCatalog(this.countries, this.regions);
  static Future<AddressCatalog>? _cached;
  static AddressCatalog? loaded;
  static Future<AddressCatalog> load() => _cached ??= _load();
  static Future<AddressCatalog> _load() async {
    final data = jsonDecode(
      await rootBundle.loadString('assets/data/address_options.json'),
    ) as Map;
    final countries =
        (data['countries'] as List)
            .map((c) => AddressOption(c['code'], c['name']))
            .toList()
          ..sort((a, b) => a.name.compareTo(b.name));
    final regions = <String, List<AddressOption>>{};
    for (final r in data['regions'] as List) {
      (regions[r['country']] ??= []).add(AddressOption(r['code'], r['name']));
    }
    for (final values in regions.values) {
      values.sort((a, b) => a.name.compareTo(b.name));
    }
    return loaded = AddressCatalog(countries, regions);
  }

  AddressOption? match(List<AddressOption> options, String value) {
    final input = value.trim().toLowerCase();
    return options
        .where(
          (o) => o.code.toLowerCase() == input || o.name.toLowerCase() == input,
        )
        .firstOrNull;
  }
}

class AddressSuggestion {
  final String id;
  final String description;
  const AddressSuggestion(this.id, this.description);
}

/// Same shipping endpoints used by the React address control. Auth and org
/// routing stay in the shared client; no provider keys live in the app.
class AddressService {
  Future<List<AddressSuggestion>> suggest(
    String input,
    String country,
    String session,
  ) async {
    final result = await appengineHttpClient.post(
      '/shipping/address-autocomplete',
      body: {
        'input': input,
        'sessiontoken': session,
        if (country.isNotEmpty)
          'components': 'country:${country.toLowerCase()}',
      },
    );
    final list = result is List ? result : result['predictions'] as List? ?? [];
    return list
        .whereType<Map>()
        .map(
          (p) => AddressSuggestion(
            '${p['place_id'] ?? p['placeId'] ?? ''}',
            '${p['description'] ?? ''}',
          ),
        )
        .where((p) => p.id.isNotEmpty && p.description.isNotEmpty)
        .toList();
  }

  Future<Map<String, String>> details(String id) async {
    final result = await appengineHttpClient.get(
      '/shipping/place-details/${Uri.encodeComponent(id)}',
    );
    final address = result['address'];
    if (address is! Map) throw StateError('Address details were not returned.');
    return {
      for (final key in [
        'street1',
        'street2',
        'city',
        'state',
        'zip',
        'country',
      ])
        key: '${address[key] ?? ''}',
    };
  }
}
