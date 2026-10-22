import 'package:flutter/foundation.dart';

import '../services/store_api.dart';

/// Catalog and cart.
class StoreProvider extends ChangeNotifier {
  final StoreApi _api = storeApi;

  List<Map<String, dynamic>> _products = const [];
  List<Map<String, dynamic>> _categories = const [];
  Map<String, dynamic> _cart = const {};
  bool _loading = false;
  String? _error;
  String _category = '';

  List<Map<String, dynamic>> get products => _products;
  List<Map<String, dynamic>> get categories => _categories;
  Map<String, dynamic> get cart => _cart;
  bool get loading => _loading;
  String? get error => _error;
  String get category => _category;

  String? get cartId {
    final id = _cart['id'] ?? _cart['cartid'] ?? _cart['cartId'];
    return id == null ? null : '$id';
  }

  List<Map<String, dynamic>> get cartLines {
    final raw = _cart['items'] ?? _cart['lines'] ?? _cart['products'];
    if (raw is! List) return const [];
    return [
      for (final r in raw)
        if (r is Map) Map<String, dynamic>.from(r),
    ];
  }

  int get cartCount {
    var n = 0;
    for (final l in cartLines) {
      final q = l['quantity'] ?? l['qty'] ?? 1;
      n += (q is num ? q.toInt() : int.tryParse('$q') ?? 1);
    }
    return n;
  }

  Future<void> load({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }
    try {
      _categories = await _api.categories();
      _products = await _api.products(
          category: _category.isEmpty ? null : _category);
      _error = null;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    } finally {
      _loading = false;
      notifyListeners();
    }
    // The cart is a separate concern: a catalog that loaded should still show
    // even when the cart call fails.
    try {
      _cart = await _api.myCart();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> setCategory(String c) async {
    if (_category == c) return;
    _category = c;
    await load();
  }

  Future<String?> add(Map<String, dynamic> product, {int quantity = 1}) async {
    final id = cartId;
    if (id == null) {
      return 'No cart yet. Sign in to start one.';
    }
    try {
      await _api.updateCart(id, {
        'action': 'add',
        'productId': product['id'] ?? product['sku'],
        'quantity': quantity,
      });
      _cart = await _api.myCart();
      notifyListeners();
      return null;
    } catch (e) {
      return e.toString().replaceAll('Exception: ', '');
    }
  }
}
