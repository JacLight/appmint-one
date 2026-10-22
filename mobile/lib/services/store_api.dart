import 'http_client.dart';

/// The storefront — catalog, cart, checkout.
///
/// Every path is a real route on `@Controller('storefront')`.
class StoreApi {
  static final StoreApi _instance = StoreApi._();
  factory StoreApi() => _instance;
  StoreApi._();

  final AppengineHttpClient _http = appengineHttpClient;
  static const _base = '/storefront';

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : <String, dynamic>{};

  List<Map<String, dynamic>> _records(dynamic r) {
    dynamic list;
    if (r is List) {
      list = r;
    } else if (r is Map) {
      list = r['data'] ?? r['items'] ?? r['results'] ?? r['rows'] ?? [];
    }
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> products({
    String? category,
    String? search,
    int pageSize = 40,
  }) async =>
      _records(await _http.get('$_base/products', queryParams: {
        'pageSize': '$pageSize',
        if (category != null && category.isNotEmpty) 'category': category,
        if (search != null && search.isNotEmpty) 'search': search,
      }));

  Future<Map<String, dynamic>> product(String id) async =>
      _map(await _http.get('$_base/product/$id'));

  Future<List<Map<String, dynamic>>> related(String id) async =>
      _records(await _http.get('$_base/product/$id/related'));

  Future<List<Map<String, dynamic>>> categories() async =>
      _records(await _http.get('$_base/categories'));

  Future<List<Map<String, dynamic>>> collection(String name) async =>
      _records(await _http.get('$_base/collections/$name'));

  // ── Cart ────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> myCart() async =>
      _map(await _http.get('$_base/cart/mine'));

  Future<Map<String, dynamic>> updateCart(
          String cartId, Map<String, dynamic> body) async =>
      _map(await _http.post('$_base/cart/update/$cartId', body: body));

  Future<void> clearCart(String cartId) async {
    await _http.get('$_base/cart/clear/$cartId');
  }

  Future<Map<String, dynamic>> checkout(Map<String, dynamic> body) async =>
      _map(await _http.post('$_base/checkout-cart', body: body));
}

final storeApi = StoreApi();
