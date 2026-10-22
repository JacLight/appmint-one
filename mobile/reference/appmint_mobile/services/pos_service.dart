import 'package:flutter/foundation.dart';

import '../models/pos_order_model.dart';
import 'http_client.dart';

/// Storefront POS API client. Mirrors the endpoints exposed at
/// /Users/imzee/projects/appengine/src/storefront/storefront.controller.ts:
///
///   GET    /storefront/pos-categories
///   POST   /storefront/pos/tab                  → open a new tab
///   GET    /storefront/pos/tabs?businessLocationId=...
///   POST   /storefront/pos/tab/:id/settle       → record payment
///
/// Plus existing cart endpoints used to update line items on a saved tab:
///   POST   /storefront/cart/update              (or PUT depending on backend)
///   GET    /storefront/cart/get/:authorid/:cartid?
class PosService {
  final AppengineHttpClient _http = appengineHttpClient;

  /// Fetch products with optional category and search filter.
  /// Maps to GET /storefront/products?category=...&search=...&page=&ps=
  /// Returns parsed PosProduct list. Backend response is wrapped in
  /// { data: [...], total, ... } via the standard repository find shape.
  /// Look up a single product by SKU (used by barcode/QR scan flow).
  /// Tries the storefront filter first, falls back to repository find on
  /// the sf_product collection if the storefront endpoint doesn't expose
  /// SKU as a query param.
  Future<PosProduct?> findProductBySku(String sku) async {
    if (sku.trim().isEmpty) return null;
    try {
      final response = await _http.post(
        '/repository/find/sf_product',
        body: {
          'query': {'data.sku': sku.trim()},
          'options': {'pageSize': 1},
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
      if (rawList.isEmpty) return null;
      final first = rawList.first;
      if (first is Map) {
        return PosProduct.fromJson(Map<String, dynamic>.from(first));
      }
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.findProductBySku failed: $e');
      rethrow;
    }
  }

  /// Look up a product by its record id (used when a scanned code is an
  /// Appmint deep link rather than a SKU).
  Future<PosProduct?> findProductById(String id) async {
    if (id.trim().isEmpty) return null;
    try {
      final response = await _http.get(
        '/repository/find-any-id/sf_product/${Uri.encodeComponent(id.trim())}',
      );
      if (response is Map && response.isNotEmpty) {
        // GET-by-id returns the record directly; find shapes wrap in data[].
        final rec =
            (response['data'] is List && (response['data'] as List).isNotEmpty)
            ? (response['data'] as List).first
            : response;
        if (rec is Map) {
          return PosProduct.fromJson(Map<String, dynamic>.from(rec));
        }
      }
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.findProductById failed: $e');
      rethrow;
    }
  }

  /// Resolve any scanned/typed code to a product. Supports:
  ///  - Appmint deep links: `appmint://sf_product/<id>` (also tolerates a
  ///    full URL form `.../sf_product/<id>` and a bare `sf_product/<id>`)
  ///  - plain SKU / barcode (existing behaviour)
  Future<PosProduct?> findProductByCode(
    String code, {
    Iterable<PosProduct> loadedProducts = const [],
  }) async {
    final raw = code.trim();
    if (raw.isEmpty) return null;
    final m = RegExp(
      r'(?:^|/)sf_product/([A-Za-z0-9_-]+)\b',
      caseSensitive: false,
    ).firstMatch(raw);
    // Use the same current, location-adjusted catalog as a product tile tap.
    // Repeated hardware scans must not queue behind a network round trip.
    for (final product in loadedProducts) {
      if (product.sku == raw || (m != null && product.sk == m.group(1))) {
        return product;
      }
    }
    if (m != null) {
      final id = m.group(1)!;
      final byId = await findProductById(id);
      if (byId != null) return byId;
      // Fall through to SKU in case the id segment is actually a SKU.
    }
    return findProductBySku(raw);
  }

  Future<List<PosProduct>> getProducts({
    String? category,
    String? search,
    int page = 1,
    int pageSize = 50,
    String? businessLocationId,
  }) async {
    try {
      final params = <String, String>{
        'p': page.toString(),
        'ps': pageSize.toString(),
        if (category != null && category.isNotEmpty) 'category': category,
        if (search != null && search.isNotEmpty) 'q': search,
      };
      final response = await _http.get(
        '/storefront/products',
        queryParams: params,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is Map && response['items'] is List) {
        rawList = response['items'] as List;
      } else {
        rawList = const [];
      }
      final products = rawList
          .whereType<Map>()
          .map((e) => PosProduct.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      // Merge the per-location overlay (86 / price override / day-part menus).
      if (businessLocationId != null && businessLocationId.isNotEmpty) {
        final overlay = await _getLocationOverlay(businessLocationId);
        if (overlay.isNotEmpty) {
          return products.map((p) {
            final ov = overlay[p.sk];
            if (ov == null) return p;
            final rawMenus = ov['menuIds'];
            return p.withOverlay(
              eightySixed: ov['eightySixed'] == true,
              eightySixReason: ov['eightySixReason']?.toString(),
              priceOverride: ov['priceOverride'] is num
                  ? ov['priceOverride'] as num
                  : null,
              menuIds: rawMenus is List
                  ? rawMenus.map((e) => e.toString()).toList()
                  : null,
            );
          }).toList();
        }
      }
      return products;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.getProducts failed: $e');
      return const [];
    }
  }

  /// Fetch the bm_location_product overlay for a location, keyed by productId.
  /// Carries 86 status/reason, price override, and day-part menu membership.
  Future<Map<String, Map<String, dynamic>>> _getLocationOverlay(
    String businessLocationId,
  ) async {
    try {
      final response = await _http.post(
        '/repository/find/bm_location_product',
        body: {
          'query': {'data.businessLocationId': businessLocationId},
          'options': {'pageSize': 500},
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
      final byProduct = <String, Map<String, dynamic>>{};
      for (final rec in rawList) {
        if (rec is Map) {
          final data = rec['data'] is Map
              ? Map<String, dynamic>.from(rec['data'] as Map)
              : null;
          final productId = data?['productId']?.toString();
          if (data != null && productId != null && productId.isNotEmpty) {
            byProduct[productId] = data;
          }
        }
      }
      return byProduct;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService._getLocationOverlay failed: $e');
      return const {};
    }
  }

  /// Mark a product 86'd (or un-86) at a location by upserting its
  /// bm_location_product overlay. Returns true on success.
  Future<bool> setEightySix({
    required String productId,
    required String businessLocationId,
    required bool eightySixed,
    String? reason,
  }) async {
    if (productId.isEmpty || businessLocationId.isEmpty) return false;
    try {
      // Find an existing overlay row for this product+location.
      final found = await _http.post(
        '/repository/find/bm_location_product',
        body: {
          'query': {
            'data.businessLocationId': businessLocationId,
            'data.productId': productId,
          },
          'options': {'pageSize': 1},
        },
      );
      String? sk;
      final list = (found is Map && found['data'] is List)
          ? found['data'] as List
          : (found is List ? found : const []);
      if (list.isNotEmpty && list.first is Map) {
        sk = (list.first as Map)['sk']?.toString();
      }

      if (sk != null && sk.isNotEmpty) {
        await _http.post(
          '/repository/update-partial/bm_location_product/$sk',
          // update-partial $sets the keys as sent: spell out the data path
          // (bare keys landed at the record root, so "back on" never stuck).
          body: {
            'data.eightySixed': eightySixed,
            'data.eightySixReason': eightySixed ? (reason ?? '') : '',
          },
        );
      } else {
        await _http.post(
          '/repository/create',
          body: {
            'datatype': 'bm_location_product',
            'isNew': true,
            'data': {
              'businessLocationId': businessLocationId,
              'productId': productId,
              'eightySixed': eightySixed,
              'eightySixReason': eightySixed ? (reason ?? '') : '',
            },
          },
        );
      }
      return true;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.setEightySix failed: $e');
      return false;
    }
  }

  /// Quick category buckets shown above the product grid.
  /// Returns the raw list — caller decides how to render.
  Future<List<Map<String, dynamic>>> getPosCategories() async {
    try {
      final response = await _http.get('/storefront/pos-categories');
      if (response is List) {
        return response
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      if (response is Map && response['data'] is List) {
        return (response['data'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      return const [];
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.getPosCategories failed: $e');
      return const [];
    }
  }

  /// Open a new POS tab. Body matches storefront.controller.ts:142-150:
  ///   { businessLocationId, tabLabel?, servicePointId?, customer? }
  /// Returns the persisted order (with sk + auto-assigned number).
  Future<PosOrder?> openTab({
    required String businessLocationId,
    String? tabLabel,
    String? servicePointId,
    Map<String, dynamic>? customer,
  }) async {
    try {
      final response = await _http.post(
        '/storefront/pos/tab',
        body: {
          'businessLocationId': businessLocationId,
          // Backend reads `alias ?? tabLabel` — send the current `alias` key
          // (desktop uses it) and keep `tabLabel` for backward compatibility.
          if (tabLabel != null && tabLabel.isNotEmpty) 'alias': tabLabel,
          if (tabLabel != null && tabLabel.isNotEmpty) 'tabLabel': tabLabel,
          if (servicePointId != null && servicePointId.isNotEmpty)
            'servicePointId': servicePointId,
          if (customer != null) 'customer': customer,
        },
      );
      if (response is Map<String, dynamic>) return PosOrder.fromJson(response);
      if (response is Map)
        return PosOrder.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.openTab failed: $e');
      rethrow;
    }
  }

  /// List currently-open POS tabs (status='new') for the given location.
  /// Pass null to get all locations the user can see.
  Future<List<PosOrder>> listOpenTabs({String? businessLocationId}) async {
    try {
      final response = await _http.get(
        '/storefront/pos/tabs',
        queryParams: businessLocationId != null && businessLocationId.isNotEmpty
            ? {'businessLocationId': businessLocationId}
            : null,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is Map && response['tabs'] is List) {
        rawList = response['tabs'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => PosOrder.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.listOpenTabs failed: $e');
      return const [];
    }
  }

  /// List closed POS tabs (settled/cancelled/refunded) for the given location.
  /// Same enrichment as open tabs (productItems.task etc.) — used by the
  /// Tabs page Closed view for audit + reporting.
  Future<List<PosOrder>> listClosedTabs({String? businessLocationId}) async {
    try {
      final response = await _http.get(
        '/storefront/pos/tabs/closed',
        queryParams: businessLocationId != null && businessLocationId.isNotEmpty
            ? {'businessLocationId': businessLocationId}
            : null,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else if (response is Map && response['tabs'] is List) {
        rawList = response['tabs'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => PosOrder.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.listClosedTabs failed: $e');
      return const [];
    }
  }

  /// Complete a paid check. The server verifies its balance and kitchen work.
  Future<PosOrder> closeTab(String orderId) async {
    final response = await _http.post(
      '/storefront/pos/tab/$orderId/close',
      body: {'markDirty': true},
    );
    if (response is Map && response['order'] is Map) {
      final order = PosOrder.fromJson(
        Map<String, dynamic>.from(response['order'] as Map),
      );
      if (order.sk == orderId && order.status == 'completed') return order;
    }
    // Some completion responses omit the repository key. Confirm by reading
    // the original check instead of treating a successful close as a failure.
    final refreshed = await getOrderById(orderId);
    if (refreshed != null &&
        refreshed.sk == orderId &&
        refreshed.status == 'completed')
      return refreshed;
    throw Exception(
      'The server did not confirm that this check was closed. Refresh before trying again.',
    );
  }

  /// Refund a single payment line on a POS tab. Identify the payment by
  /// `transactionId` OR `ref`. Optional `amount` allows partial refunds —
  /// defaults to the full original payment amount on the backend.
  /// Returns the updated order. Throws on failure so the UI can show why.
  Future<PosOrder?> refundPayment({
    required String orderId,
    String? transactionId,
    String? ref,
    num? amount,
    String? reason,
    bool? cashReturned,
    String? operationKey,
  }) async {
    final response = await _http.post(
      '/storefront/pos/tab/$orderId/refund',
      body: {
        // Required by the refund route: a stable id for this one refund.
        if (operationKey != null) 'operationKey': operationKey,
        // A cash refund is recorded only once the cash was handed back (server rule).
        if (cashReturned == true) 'cashReturned': true,
        if (transactionId != null && transactionId.isNotEmpty)
          'transactionId': transactionId,
        if (ref != null && ref.isNotEmpty) 'ref': ref,
        if (amount != null) 'amount': amount,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
    // Backend returns `{ order, refundTransaction }`.
    if (response is Map) {
      final order = response['order'];
      if (order is Map) {
        return PosOrder.fromJson(Map<String, dynamic>.from(order));
      }
    }
    return null;
  }

  /// Email / SMS the receipt for a POS tab via the backend notification
  /// pipeline. Backend resolves the `pos-receipt` template (or order
  /// confirmation as fallback), merges order data, and dispatches through
  /// the org's mail / Twilio integration. Works for any tender — does not
  /// depend on Stripe / the payment gateway.
  ///
  /// `to` is a single recipient (email or phone). `mode` is 'email' or 'sms'.
  /// Backend falls back to the order's saved contact if `to` is empty.
  /// Returns `{sent, channel, recipients}` on success; throws on failure
  /// so the UI can show the real error instead of pretending it worked.
  Future<Map<String, dynamic>> sendReceipt(
    String orderId, {
    required String mode,
    String? to,
  }) async {
    final response = await _http.post(
      '/storefront/pos/tab/$orderId/send-receipt',
      body: {'mode': mode, if (to != null && to.isNotEmpty) 'to': to},
    );
    if (response is Map) {
      return Map<String, dynamic>.from(response);
    }
    return {'sent': 0};
  }

  /// Fetch a single sf_order by sk — works for both open and closed tabs,
  /// since the backend doesn't filter by status. Used by the POS deep-link
  /// path: when the Tabs screen sends the operator to a closed/paid tab,
  /// the POS in-memory list only holds OPEN tabs, so we have to pull this
  /// one fresh and append it to the local list.
  /// Returns null on 404 or any failure (caller surfaces the error).
  Future<PosOrder?> getOrderById(String orderId) async {
    try {
      final response = await _http.get('/storefront/order/$orderId');
      if (response is Map) {
        return PosOrder.fromJson(Map<String, dynamic>.from(response));
      }
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.getOrderById failed: $e');
      return null;
    }
  }

  /// Settle a tab. Body matches storefront.controller.ts:177-186:
  ///   { amount, method?, gateway?, ref? }
  /// Backend records the payment and returns `{order, transaction}`.
  /// We unwrap `order` — previously the whole envelope was passed to
  /// `PosOrder.fromJson`, which silently produced a garbage tab (sk='')
  /// that broke subsequent settles in the same checkout.
  Future<void> preflightPayment({
    required String orderId,
    required num amount,
    required num tip,
    required String currency,
    required String businessLocationId,
  }) async {
    await _http.post(
      '/storefront/pos/tab/$orderId/payment-preflight',
      body: {
        'amount': amount,
        'tip': tip,
        'currency': currency,
        'businessLocationId': businessLocationId,
      },
    );
  }

  Future<PosOrder?> settleTab({
    required String orderId,
    required num amount,
    num tip = 0,
    num? tendered,
    String method = 'cash',
    String? gateway,
    String? ref,
  }) async {
    try {
      final response = await _http.post(
        '/storefront/pos/tab/$orderId/settle',
        body: {
          'amount': amount,
          'tip': tip,
          if (tendered != null) 'tendered': tendered,
          'method': method,
          if (gateway != null) 'gateway': gateway,
          if (ref != null) 'ref': ref,
        },
      );
      if (response is Map) {
        final m = Map<String, dynamic>.from(response);
        // Server response: { order: {...}, transaction: {...} }.
        final order = m['order'];
        if (order is Map) {
          return PosOrder.fromJson(Map<String, dynamic>.from(order));
        }
        // Backwards-compat: some older endpoints returned the order
        // directly. Detect by `sk` field — only a real order has it.
        if (m.containsKey('sk')) return PosOrder.fromJson(m);
      }
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.settleTab failed: $e');
      rethrow;
    }
  }

  /// Fetch a server-rendered receipt payload for printing locally.
  /// Server resolves the template (org's posReceiptCustomerTemplate setting →
  /// factory default), interpolates against the order context, and returns
  /// a flat list of primitive print lines: { kind: 'text'|'feed'|'cut'|'image',
  /// text?, bold?, size?, lines?, url? }. Caller renders to ESC/POS bytes.
  ///
  /// `copy` = 'customer' | 'merchant' picks the variant template, omit for
  /// the default copy the operator has configured.
  Future<Map<String, dynamic>?> getReceiptPayload(
    String orderId, {
    String? copy,
  }) async {
    try {
      final qp = <String, String>{};
      if (copy != null) qp['copy'] = copy;
      final response = await _http.get(
        '/storefront/pos/tab/$orderId/receipt-payload',
        queryParams: qp.isEmpty ? null : qp,
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.getReceiptPayload failed: $e');
      rethrow;
    }
  }

  /// Same as getReceiptPayload but for the pre-payment check ticket.
  Future<Map<String, dynamic>?> getCheckPayload(String orderId) async {
    try {
      final response = await _http.get(
        '/storefront/pos/tab/$orderId/check-payload',
      );
      if (response is Map<String, dynamic>) return response;
      if (response is Map) return Map<String, dynamic>.from(response);
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.getCheckPayload failed: $e');
      rethrow;
    }
  }

  /// Transfer a tab to a table/section (or seat a walk-up) by attaching a
  /// service point. Backend: POST storefront/pos/tab/:id/assign-service-point.
  Future<PosOrder?> transferTab({
    required String orderId,
    required String servicePointId,
    bool occupy = true,
    String? alias,
    int? partySize,
  }) async {
    if (orderId.isEmpty || servicePointId.isEmpty) return null;
    final response = await _http.post(
      '/storefront/pos/tab/$orderId/assign-service-point',
      body: {
        'servicePointId': servicePointId,
        'occupy': occupy,
        if (alias != null && alias.isNotEmpty) 'alias': alias,
        if (partySize != null) 'partySize': partySize,
      },
    );
    return _orderFrom(response);
  }

  /// Split a tab — either by moving specific items to a new tab (itemIds) or
  /// into N even shares (parts). Backend: POST storefront/pos/tab/:id/split.
  Future<dynamic> splitTab({
    required String orderId,
    List<String>? itemIds,
    int? parts,
    String? alias,
    String? sourceAlias,
  }) async {
    if (orderId.isEmpty) throw Exception('splitTab: orderId required');
    if ((itemIds == null || itemIds.isEmpty) && (parts == null || parts < 2)) {
      throw Exception('splitTab: pass itemIds or parts>=2');
    }
    return _http.post(
      '/storefront/pos/tab/$orderId/split',
      body: {
        if (itemIds != null && itemIds.isNotEmpty) 'itemIds': itemIds,
        if (parts != null && parts >= 2) 'parts': parts,
        if (alias != null && alias.isNotEmpty) 'alias': alias,
        // By item: the name of the check that keeps the rest (split by seat).
        if (sourceAlias != null && sourceAlias.isNotEmpty) 'sourceAlias': sourceAlias,
      },
    );
  }

  /// Print the pre-payment check for a tab. Backend: POST .../print-check.
  Future<bool> printCheck(String orderId) async {
    if (orderId.isEmpty) return false;
    await _http.post('/storefront/pos/tab/$orderId/print-check', body: {});
    return true;
  }

  /// Print a paid receipt. copy = 'customer' | 'merchant'. Backend: .../print-receipt.
  Future<bool> printReceipt(String orderId, {String copy = 'customer'}) async {
    if (orderId.isEmpty) return false;
    await _http.post(
      '/storefront/pos/tab/$orderId/print-receipt?copy=$copy',
      body: {},
    );
    return true;
  }

  PosOrder? _orderFrom(dynamic response) {
    if (response is Map) {
      final m = Map<String, dynamic>.from(response);
      final order = m['order'] is Map ? m['order'] : m;
      if (order is Map)
        return PosOrder.fromJson(Map<String, dynamic>.from(order));
    }
    return null;
  }

  /// Send selected lines to the server's prep pipeline, split by station.
  /// workflowId is an optional advanced override, never a product default.
  Future<PosOrder?> fireItems({
    required String orderId,
    String? workflowId,
    required List<String> itemIds,
    String? course,
    String? seat,
    String? specialInstructions,
  }) async {
    if (itemIds.isEmpty) {
      throw Exception('fireItems: at least one itemId is required');
    }
    try {
      final response = await _http.post(
        '/storefront/order/$orderId/fire',
        body: {
          if (workflowId != null && workflowId.isNotEmpty)
            'workflowId': workflowId,
          'itemIds': itemIds,
          if (course != null && course.isNotEmpty) 'course': course,
          if (seat != null && seat.isNotEmpty) 'seat': seat,
          if (specialInstructions != null && specialInstructions.isNotEmpty)
            'specialInstructions': specialInstructions,
        },
      );
      // Fire response shape: { task, firedItemIds, order }. We only want
      // the `order` field — it has the updated productItems with taskId
      // stamped on the fired lines. If the backend isn't yet returning
      // `order` (older deploy), fall back to re-fetching the tab so we
      // still pick up the post-fire state instead of wiping the cart.
      if (response is Map) {
        final m = Map<String, dynamic>.from(response);
        final order = m['order'];
        if (order is Map) {
          return PosOrder.fromJson(Map<String, dynamic>.from(order));
        }
        // Backend returned just {task, firedItemIds}. Re-fetch the order.
        return await _refetchTab(orderId);
      }
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.fireItems failed: $e');
      rethrow;
    }
  }

  /// List workflow definitions. Used by the fire sheet to let the operator
  /// override the suggested workflow.
  Future<List<Map<String, dynamic>>> listWorkflowDefinitions({
    String? name,
  }) async {
    try {
      final response = await _http.get(
        '/workflow/definition',
        queryParams: name != null && name.isNotEmpty ? {'name': name} : null,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      if (kDebugMode)
        debugPrint('PosService.listWorkflowDefinitions failed: $e');
      return const [];
    }
  }

  /// Update line items on an existing tab. The backend expects the FULL
  /// productItems array — partial updates aren't supported. Server
  /// recomputes subtotal/tax/total on save.
  ///
  /// Backend route is `/repository/update-partial/:datatype/:id` — the
  /// older `/repository/update/sf_order/:id` form 404s; the route only
  /// takes `:id` (no datatype) and `update-partial` is the right call
  /// when we're patching a single field rather than replacing the doc.
  Future<PosOrder?> updateTabLineItems({
    required String orderId,
    required List<PosLineItem> productItems,
  }) async {
    try {
      final lineTotal = productItems.fold<num>(
        0,
        (sum, l) => sum + l.amount - l.discount,
      );
      // Body is a FLAT key/value map that the server $sets verbatim.
      final response = await _http.post(
        '/repository/update-partial/sf_order/$orderId',
        // The server $sets the keys exactly as sent (repository.provider.mongodb
        // updatePartial), so the path must be spelled out — a bare
        // `productItems` key landed at the record root and the order kept 0 items.
        body: {
          'data.productItems': productItems.map((i) => i.toJson()).toList(),
          // update-partial is a raw $set — nothing server-side recomputes the
          // order money for these lines, so keep subtotal/total in step.
          'data.subtotal': lineTotal,
          'data.total': lineTotal,
        },
      );
      // update-partial does not always echo the full record; a parsed order
      // without an sk would replace the active tab with an "unsaved" one and
      // block settle ("Save the tab before settling"). Re-fetch in that case.
      PosOrder? parsed;
      if (response is Map<String, dynamic>) {
        parsed = PosOrder.fromJson(response);
      } else if (response is Map) {
        parsed = PosOrder.fromJson(Map<String, dynamic>.from(response));
      }
      if (parsed == null || !parsed.isPersisted)
        return await _refetchTab(orderId);
      return parsed;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.updateTabLineItems failed: $e');
      rethrow;
    }
  }

  /// Re-fetch a single tab by sk via the generic repository get. Used as
  /// a fallback after fire when the response doesn't include the order.
  Future<PosOrder?> _refetchTab(String orderId) async {
    try {
      final response = await _http.get('/repository/get/sf_order/$orderId');
      if (response is Map<String, dynamic>) return PosOrder.fromJson(response);
      if (response is Map)
        return PosOrder.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService._refetchTab failed: $e');
      return null;
    }
  }

  /// Delete an open tab. Backend's repository delete drops the record;
  /// caller should only invoke this on tabs with no payments and no
  /// fired items (server enforces — this is just the wire call).
  Future<bool> deleteTab(String orderId) async {
    try {
      await _http.delete('/repository/delete/sf_order/$orderId');
      return true;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.deleteTab failed: $e');
      rethrow;
    }
  }

  /// Append items to a server-side tab using the React POS path.
  /// `POST /storefront/order/:id/items` enriches each line from sf_product
  /// (name/unitPrice/image/suggestedWorkflowId), stamps a stable server-side
  /// `id`, recomputes totals, and returns the updated order — exactly what
  /// React POS uses (websitemint/.../operations/POS.tsx:551).
  ///
  /// Use this for newly-added local lines (id starts with 'ln-') so the
  /// server can stamp its own id and the subsequent `/fire` call matches.
  /// Existing modifications (qty change, removal) still go through
  /// [updateTabLineItems].
  Future<PosOrder?> addItemsToTab({
    required String orderId,
    required List<PosLineItem> items,
    List<Map<String, dynamic>> updates = const [],
  }) async {
    try {
      final response = await _http.post(
        '/storefront/order/$orderId/items',
        body: {
          // Edits to lines already on the tab (quantity, note, removal): the
          // server applies them and re-prices the tab (subtotal, tax, total).
          if (updates.isNotEmpty) 'updates': updates,
          'items': items
              .map(
                (i) => {
                  'sku': i.sku,
                  if (i.itemType == 'fee') ...{'itemType': 'fee', 'name': i.name},
                  'quantity': i.quantity,
                  'unitPrice': i.unitPrice,
                  if (i.options.isNotEmpty) 'options': i.options,
                  if ((i.specialInstructions ?? '').isNotEmpty)
                    'specialInstructions': i.specialInstructions,
                  // The server keeps both on the line and on its prep ticket.
                  if ((i.seat ?? '').isNotEmpty) 'seat': i.seat,
                  if ((i.course ?? '').isNotEmpty) 'course': i.course,
                },
              )
              .toList(),
        },
      );
      if (response is Map<String, dynamic>) return PosOrder.fromJson(response);
      if (response is Map)
        return PosOrder.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PosService.addItemsToTab failed: $e');
      rethrow;
    }
  }
}

final posService = PosService();
