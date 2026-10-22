String normalizePrepStation(Object? value) {
  final station = (value ?? '').toString().trim().toUpperCase();
  return {'', 'NONE', 'NO STATION', 'UNASSIGNED'}.contains(station) ? 'NONE' : station;
}

/// POS tickets carry one authoritative station, including null for unassigned.
/// Older tickets kept the station only in line options.
Set<String> taskStations(Map task) {
  final data = task['data'] is Map ? task['data'] as Map : task;
  final payload = data['payload'] is Map ? data['payload'] as Map : const {};
  if (payload.containsKey('station')) return {normalizePrepStation(payload['station'])};
  final items = payload['items'] is List ? payload['items'] as List : const [];
  final stations = <String>{};
  for (final item in items.whereType<Map>()) {
    final options = item['options'] is List ? item['options'] as List
        : item['picks'] is List ? item['picks'] as List : const [];
    for (final option in options.whereType<Map>()) {
      if (option['name'] == 'prepStation' || option['attrName'] == 'prepStation') {
        stations.add(normalizePrepStation(option['value']));
      }
    }
  }
  return stations.isEmpty ? {'NONE'} : stations;
}
