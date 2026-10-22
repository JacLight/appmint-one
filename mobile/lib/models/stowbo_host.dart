/// A Stowbo listing (a place a guest can book). Maps the real `stowbo_listing`
/// record from `/client/stowbo/listings`. Kept named `StowboHost` so the guest
/// screens don't churn; `sk` holds the listing CODE (`data.name`), which is the
/// id both booking (`items[].listing`) and listing-detail use.
class StowboHost {
  final String sk; // listing code (data.name) — id for booking + detail
  final String recordSk; // the BaseModel sk (rarely needed)
  final String name; // title
  final String kind; // spaceType
  final String address;
  final String description;
  final String? photoUrl; // first image (list cards)
  final List<String> photoUrls; // ALL listing images (detail gallery)
  final double ratePerHour; // price (legacy)
  final String priceUnit; // hour | day | month
  final String priceLabel; // headline from the rate schedule / dated quote
  final bool hasRateBands; // priced by `rates.bands` (legacy `price` ignored)
  final int capacity;
  final String hours; // accessHours
  final String ownerUserId;
  final String ownerEmail; // host's email — for the community chat thread
  final double? rating;
  final double? lat;
  final double? lng;
  final String status;

  StowboHost({
    required this.sk,
    this.recordSk = '',
    required this.name,
    required this.kind,
    required this.address,
    required this.description,
    this.photoUrl,
    this.photoUrls = const [],
    required this.ratePerHour,
    this.priceUnit = 'hour',
    this.priceLabel = '',
    this.hasRateBands = false,
    this.capacity = 1,
    this.hours = '',
    this.ownerUserId = '',
    this.ownerEmail = '',
    this.rating,
    this.lat,
    this.lng,
    this.status = 'active',
  });

  /// Price shown per item per its unit, e.g. "$3 / item · hour".
  String get rateLabel => '\$${_amountLabel(ratePerHour)} / item · $priceUnit';

  String get kindLabel => labelForKind(kind);

  static String labelForKind(String kind) {
    if (kind == 'event-bag-drop') return 'Event & bag drop';
    final label = kind.replaceAll(RegExp('[-_]'), ' ').trim();
    return label.isEmpty ? 'Storage' : '${label[0].toUpperCase()}${label.substring(1)}';
  }

  static String _amountLabel(num amount) =>
      amount.toStringAsFixed(amount == amount.roundToDouble() ? 0 : 2);

  static double _d(dynamic v, [double def = 0]) =>
      v == null ? def : (v is num ? v.toDouble() : double.tryParse('$v') ?? def);
  static int _i(dynamic v, [int def = 0]) =>
      v == null ? def : (v is num ? v.toInt() : int.tryParse('$v') ?? def);

  static String _joinAddress(dynamic a) {
    if (a is String) return a;
    if (a is! Map) return '';
    final m = Map<String, dynamic>.from(a);
    return [m['line1'] ?? m['street'] ?? m['address'], m['city'], m['state']]
        .where((s) => (s ?? '').toString().trim().isNotEmpty)
        .join(', ');
  }

  factory StowboHost.fromListingRecord(Map<String, dynamic> rec) {
    final data = (rec['data'] is Map)
        ? Map<String, dynamic>.from(rec['data'])
        : <String, dynamic>{};
    final owner = (rec['owner'] is Map)
        ? Map<String, dynamic>.from(rec['owner'])
        : <String, dynamic>{};
    final addr = data['address'];
    final images = (data['images'] is List) ? data['images'] as List : const [];
    // Keep EVERY image the host uploaded, not just the first.
    final photoUrls = images
        .map((e) => e is Map
            ? (e['url'] ?? e['src'] ?? '').toString()
            : e.toString())
        .where((u) => u.isNotEmpty)
        .toList();
    final photo = photoUrls.isNotEmpty ? photoUrls.first : null;
    return StowboHost(
      // Use the record sk as the id — the engine's findOneAnyId accepts it for
      // detail/availability/booking, and unlike the generated `name` code it is
      // URL-safe (listing names can contain spaces).
      sk: (rec['sk'] ?? data['name'] ?? '').toString(),
      recordSk: (rec['sk'] ?? '').toString(),
      name: (data['title'] ?? rec['name'] ?? 'Untitled').toString(),
      kind: (data['spaceType'] ?? '').toString().isEmpty
          ? 'Storage'
          : data['spaceType'].toString(),
      address: _joinAddress(addr),
      description: (data['description'] ?? '').toString(),
      photoUrl: photo,
      photoUrls: photoUrls,
      ratePerHour: _d(data['price'], 0),
      priceUnit: (data['priceUnit'] ?? 'hour').toString(),
      priceLabel: _priceLabelFrom(data),
      hasRateBands: data['rates'] is Map &&
          (data['rates']['bands'] is List) &&
          (data['rates']['bands'] as List).isNotEmpty,
      capacity: _i(data['capacity'], 1),
      hours: (data['accessHours'] ?? '').toString(),
      ownerUserId: (owner['id'] ?? data['ownerUserId'] ?? '').toString(),
      ownerEmail: (owner['email'] ?? data['ownerEmail'] ?? '').toString(),
      rating: data['rating'] == null ? null : _d(data['rating']),
      // Coordinates live in `data.location` now; fall back to legacy address
      // coords for older records.
      lat: _coord(data, 'lat'),
      lng: _coord(data, 'lng'),
      status: (data['status'] ?? 'active').toString(),
    );
  }

  /// The headline price a card shows — rendered from the host's rate schedule
  /// (never multiplied out). A dated browse carries a real quote; otherwise we
  /// show the first band's wording ("Free", "$3 / hour", "$1 / day").
  static String _priceLabelFrom(Map data) {
    final q = data['quote'];
    if (q is Map && q['total'] is num) {
      return '\$${(q['total'] as num).toStringAsFixed(2)} · this window';
    }
    final rates = data['rates'];
    final bands = (rates is Map && rates['bands'] is List)
        ? (rates['bands'] as List)
        : const [];
    if (bands.isEmpty) {
      final price = num.tryParse('${data['price']}');
      if (price != null && price.isFinite && price >= 0) {
        return '\$${_amountLabel(price)} / ${data['priceUnit'] ?? 'hour'}';
      }
      return 'Price on the listing';
    }
    final b = bands.first;
    if (b is! Map) return 'Price on the listing';
    if (b['charge'] == 'free') return 'Free';
    final label = (b['label'] ?? '').toString();
    if (label.isNotEmpty) return label;
    final amt = _amountLabel(num.tryParse('${b['amount']}') ?? 0);
    if (b['charge'] == 'fixed') return '\$$amt';
    return '\$$amt / ${b['per'] ?? 'hour'}';
  }

  /// lat/lng from `data.location` (current) or `data.address` (legacy).
  static double? _coord(Map data, String key) {
    final loc = data['location'];
    if (loc is Map && loc[key] != null) return _d(loc[key]);
    final addr = data['address'];
    if (addr is Map && addr[key] != null) return _d(addr[key]);
    return null;
  }

  /// Build from a server listing "card" (more-from-host / nearby):
  /// { sk, title, spaceType, city, image, price, priceUnit, distanceKm? }.
  factory StowboHost.fromCard(Map<String, dynamic> c) {
    final img = c['image'];
    final url = img is Map ? (img['url'] ?? img['src'] ?? '').toString() : '';
    return StowboHost(
      sk: (c['sk'] ?? '').toString(),
      recordSk: (c['sk'] ?? '').toString(),
      name: (c['title'] ?? 'Untitled').toString(),
      kind: (c['spaceType'] ?? 'Storage').toString(),
      address: (c['city'] ?? '').toString(),
      description: '',
      photoUrl: url.isEmpty ? null : url,
      photoUrls: url.isEmpty ? const [] : [url],
      ratePerHour: _d(c['price'], 0),
      priceUnit: (c['priceUnit'] ?? 'hour').toString(),
      priceLabel: _priceLabelFrom(c),
    );
  }

  /// Body for POST /client/stowbo/host/listings (the listing schema).
  Map<String, dynamic> toListingBody() => {
        'title': name,
        'spaceType': kind,
        'capacity': capacity,
        'price': ratePerHour,
        'priceUnit': priceUnit,
        'accessHours': hours,
        'description': description,
        'address': {'line1': address},
        // Coordinates go in `location` (what the map console pins), matching
        // the current listing schema.
        if (lat != null && lng != null) 'location': {'lat': lat, 'lng': lng},
        'status': 'active',
      };

  static const List<String> kinds = [
    'Bag check',
    'Luggage',
    'Parking',
    'Coat check',
    'Locker',
    'Storage',
  ];
}

/// Sensible per-unit default for a listing: a bike rack takes bikes, a bag
/// check takes bags, a lot takes vehicles — not "Vehicle" for everything.
String unitTypeForSpace(String spaceType) {
  final s = spaceType.toLowerCase();
  if (s.contains('bike') || s.contains('cycle')) return 'bike';
  if (s.contains('locker')) return 'locker';
  if (s.contains('bag') || s.contains('coat') || s.contains('luggage') ||
      s.contains('gear') || s.contains('check')) return 'bag';
  if (s.contains('storage') || s.contains('warehouse') || s.contains('box') ||
      s.contains('unit')) return 'box';
  if (s.contains('park') || s.contains('valet') || s.contains('lot') ||
      s.contains('garage') || s.contains('vehicle') || s.contains('car') ||
      s.contains('street')) return 'vehicle';
  return 'other';
}
