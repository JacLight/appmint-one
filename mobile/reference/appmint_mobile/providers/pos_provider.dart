import 'package:flutter/foundation.dart';

import '../models/pos_order_model.dart';
import '../services/pos_service.dart';

/// Multi-tab POS state. Each "tab" is a PosOrder — could be a local cart
/// (sk=='') waiting to be saved, or an already-persisted server tab loaded
/// from /storefront/pos/tabs. The active index is what the UI currently
/// shows. Switching tabs is just a setState — line edits update only the
/// active tab.
///
/// Mirrors websitemint POS.tsx pattern: an array of carts, one currently
/// focused, server is the system of record once saved.
class PosProvider extends ChangeNotifier {
  final PosService _service;
  PosProvider({PosService? service}) : _service = service ?? posService;

  // ── Open tabs (each tab = a cart; persisted ones have sk set) ──
  List<PosOrder> _tabs = [];
  int _activeIndex = -1;
  List<PosOrder> get tabs => _tabs;
  int get activeIndex => _activeIndex;
  PosOrder? get activeTab => (_activeIndex >= 0 && _activeIndex < _tabs.length)
      ? _tabs[_activeIndex]
      : null;

  // ── Seat being ordered for, per table tab (restaurant practice: pick the
  // guest's seat, then ring their items). null = shared by the table. ──
  final Map<String, String?> _seatByTab = {};
  String _seatKey(PosOrder t) => (t.servicePointId?.isNotEmpty ?? false) ? 'sp:${t.servicePointId}' : 'tab:${t.sk}';
  /// Seats apply to a tab opened on a table.
  bool get seatsApply => activeTab?.servicePointId?.isNotEmpty ?? false;
  String? get activeSeat {
    final t = activeTab;
    return (t == null || !seatsApply) ? null : _seatByTab[_seatKey(t)];
  }
  void setActiveSeat(String? seat) {
    final t = activeTab;
    if (t == null) return;
    _seatByTab[_seatKey(t)] = seat;
    notifyListeners();
  }

  // ── Categories (top-of-screen quick buckets) ──
  List<Map<String, dynamic>> _categories = const [];
  List<Map<String, dynamic>> get categories => _categories;

  // ── Products (loaded for the picker, filterable by category/search) ──
  List<PosProduct> _products = const [];
  List<PosProduct> get products => _products;
  bool _loadingProducts = false;
  bool get loadingProducts => _loadingProducts;
  String _selectedCategory = '';
  String get selectedCategory => _selectedCategory;
  String _productSearch = '';
  String get productSearch => _productSearch;

  // ── Active day-part menu (dinner / brunch / late_night / happy_hour), or
  // 'all' for the whole catalog. Filters the grid by product.menuIds; a
  // product with no menuIds is treated as available all day. ──
  String _activeMenu = 'all';
  String get activeMenu => _activeMenu;

  /// Products visible under the current day-part menu.
  List<PosProduct> get visibleProducts {
    if (_activeMenu == 'all') return _products;
    return _products
        .where((p) => p.menuIds.isEmpty || p.menuIds.contains(_activeMenu))
        .toList();
  }

  void setActiveMenu(String menuId) {
    if (menuId == _activeMenu) return;
    _activeMenu = menuId;
    notifyListeners();
  }

  // ── Selected location (filters tabs and inventory) ──
  String _businessLocationId = '';
  String get businessLocationId => _businessLocationId;

  // ── UI state ──
  bool _loadingTabs = false;
  bool get loadingTabs => _loadingTabs;
  bool _busy = false;
  bool get busy => _busy;
  String? _error;
  String? get error => _error;

  /// Set of line ids currently checked for the next fire batch on the
  /// active tab. Cleared after a successful fire.
  final Set<String> _fireSelection = <String>{};
  Set<String> get fireSelection => _fireSelection;
  bool isLineSelectedForFire(String lineId) => _fireSelection.contains(lineId);

  void toggleFireSelection(String lineId) {
    if (_fireSelection.contains(lineId)) {
      _fireSelection.remove(lineId);
    } else {
      _fireSelection.add(lineId);
    }
    notifyListeners();
  }

  void selectAllUnfiredForFire() {
    final t = activeTab;
    if (t == null) return;
    _fireSelection.clear();
    for (final line in t.productItems) {
      if (line.isUnfired && line.id.isNotEmpty) _fireSelection.add(line.id);
    }
    notifyListeners();
  }

  void clearFireSelection() {
    _fireSelection.clear();
    notifyListeners();
  }

  /// Workflow definitions cache for the fire sheet's workflow override.
  List<Map<String, dynamic>> _workflowDefs = const [];
  List<Map<String, dynamic>> get workflowDefs => _workflowDefs;
  Future<void> loadWorkflowDefs() async {
    _workflowDefs = await _service.listWorkflowDefinitions();
    notifyListeners();
  }

  bool _hasLoadedTabsOnce = false;

  /// Set the active business location and reload tabs scoped to it.
  /// All POS operations are location-scoped — the backend filters tabs by
  /// businessLocationId, and tabs from one location should never leak
  /// into another's view.
  ///
  /// First call always loads even when locationId matches the stored value
  /// (e.g. both empty on startup) so the tabs list isn't permanently empty.
  Future<void> setBusinessLocation(String locationId) async {
    final changed = locationId != _businessLocationId;
    // Same location: still re-read the open tabs, so a check settled, closed
    // or voided on another device is not reopened from this device's memory.
    if (!changed && _hasLoadedTabsOnce) {
      await loadOpenTabs();
      return;
    }
    _businessLocationId = locationId;
    if (changed) {
      _tabs = [];
      _activeIndex = -1;
      notifyListeners();
    }
    _hasLoadedTabsOnce = true;
    await loadOpenTabs();
  }

  /// Pull all currently-open server tabs for this location and merge any
  /// unsaved local carts on top. Local-only tabs (sk=='') are preserved
  /// across reloads — only server-saved tabs are refreshed.
  ///
  /// Refuses to load without a businessLocationId so the operator never
  /// sees tabs from a sibling location bleeding through. Surface a clear
  /// error in the UI instead.
  Future<void> loadOpenTabs() async {
    if (_businessLocationId.isEmpty) {
      _tabs = _tabs.where((t) => !t.isPersisted).toList();
      _error = 'Pick a location to load tabs';
      _loadingTabs = false;
      notifyListeners();
      return;
    }
    _loadingTabs = true;
    _error = null;
    notifyListeners();
    try {
      final saved = await _service.listOpenTabs(
        businessLocationId: _businessLocationId,
      );
      // Keep local-only carts (no sk yet) — they're work in progress that
      // would be lost otherwise.
      final focused = activeTab;
      final localOnly = _tabs.where((t) => !t.isPersisted).toList();
      _tabs = [...saved.where((tab) => !tab.isPaid), ...localOnly];
      // Keep the active tab focused if it still exists; otherwise focus first.
      final focusedIndex = focused == null
          ? -1
          : _tabs.indexWhere(
              (tab) => focused.isPersisted
                  ? tab.sk == focused.sk
                  : identical(tab, focused),
            );
      _activeIndex = focusedIndex >= 0
          ? focusedIndex
          : (_tabs.isEmpty ? -1 : 0);
    } catch (e) {
      _error = e.toString();
    } finally {
      _loadingTabs = false;
      notifyListeners();
    }
  }

  Future<void> loadCategories() async {
    _categories = await _service.getPosCategories();
    notifyListeners();
  }

  /// Load products filtered by current category + search. Called on
  /// picker open and whenever the operator changes category or types.
  Future<void> loadProducts() async {
    _loadingProducts = true;
    notifyListeners();
    try {
      _products = await _service.getProducts(
        category: _selectedCategory.isEmpty ? null : _selectedCategory,
        search: _productSearch.isEmpty ? null : _productSearch,
        businessLocationId: _businessLocationId.isEmpty
            ? null
            : _businessLocationId,
      );
    } finally {
      _loadingProducts = false;
      notifyListeners();
    }
  }

  /// 86 (or un-86) a product at the current location, then refresh the grid
  /// so it reflects immediately. Returns true on success.
  Future<bool> toggleEightySix(PosProduct product, {String? reason}) async {
    if (_businessLocationId.isEmpty) return false;
    final ok = await _service.setEightySix(
      productId: product.sk,
      businessLocationId: _businessLocationId,
      eightySixed: !product.eightySixed,
      reason: reason,
    );
    if (ok) await loadProducts();
    return ok;
  }

  void setCategory(String category) {
    if (category == _selectedCategory) return;
    _selectedCategory = category;
    notifyListeners();
    loadProducts();
  }

  void setProductSearch(String query) {
    if (query == _productSearch) return;
    _productSearch = query;
    notifyListeners();
    // Debounce — caller can call loadProducts() directly when ready, or
    // we trigger here on each keystroke. Keep simple: trigger immediately.
    loadProducts();
  }

  /// Add a new local cart and focus it. Persists nothing until the operator
  /// hits Save — that's when openTab() runs and we get a sk back.
  void newCart({String? tabLabel, String? servicePointId}) {
    _error = null;
    final cart = PosOrder(
      businessLocationId: _businessLocationId,
      tabLabel: tabLabel,
      servicePointId: servicePointId,
    );
    _tabs = [..._withoutEmptyCarts(), cart];
    _activeIndex = _tabs.length - 1;
    notifyListeners();
  }

  /// Unsaved carts with nothing in them are not work in progress: they are
  /// dropped instead of piling up as "Cart" chips in the tab strip.
  List<PosOrder> _withoutEmptyCarts() =>
      _tabs.where((t) => t.isPersisted || t.productItems.isNotEmpty).toList();

  void switchTo(int index) {
    if (index < 0 || index >= _tabs.length) return;
    _activeIndex = index;
    notifyListeners();
  }

  /// Refund a single payment on the active tab. Backend identifies the
  /// payment by `transactionId` or `ref`; partial refund when `amount` < the
  /// original payment, otherwise treats it as a full refund. Returns true
  /// on success and replaces the active tab in the local list with the
  /// updated record (so amountPaid + payments[] reflect the refund and the
  /// UI rebuilds correctly).
  Future<bool> refundPayment({
    String? transactionId,
    String? ref,
    num? amount,
    String? reason,
    bool? cashReturned,
    String? operationKey,
  }) async {
    final t = activeTab;
    if (t == null || !t.isPersisted) {
      _error = 'Cannot refund — tab is not persisted.';
      notifyListeners();
      return false;
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final updated = await _service.refundPayment(
        orderId: t.sk,
        transactionId: transactionId,
        ref: ref,
        amount: amount,
        reason: reason,
        cashReturned: cashReturned,
        operationKey: operationKey,
      );
      if (updated == null) {
        _error = 'Refund failed — server returned no order.';
        return false;
      }
      _mutateActive((_) => updated);
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> closeActive() async {
    if (_busy) return false;
    final tab = activeTab;
    if (tab == null || !tab.isPersisted) return false;
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final closed = await _service.closeTab(tab.sk);
      // Keep the result visible, even if another tab was selected while waiting.
      _tabs = [for (final item in _tabs) item.sk == tab.sk ? closed : item];
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Deep-link path: focus an existing tab by sk, fetching from the server
  /// if it's not already in the local list (the open-tabs load only pulls
  /// non-terminal statuses, so paid/closed tabs would otherwise be missing
  /// and the deep-link would silently land on whatever tab was already
  /// active). Returns true on success.
  Future<bool> openExistingTab(String sk) async {
    if (sk.isEmpty) return false;
    final existing = _tabs.indexWhere((t) => t.sk == sk);
    if (existing >= 0) {
      _activeIndex = existing;
      notifyListeners();
      return true;
    }
    _busy = true;
    notifyListeners();
    try {
      final fetched = await _service.getOrderById(sk);
      if (fetched == null) {
        _error = 'Tab not found — it may have been deleted.';
        return false;
      }
      _tabs = [..._withoutEmptyCarts(), fetched];
      _activeIndex = _tabs.length - 1;
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Drop a cart locally. If it's persisted (sk != ''), this just removes
  /// it from the operator's view — the server still has the record. To
  /// actually close a paid tab, use closeActive().
  void dismissTab(int index) {
    if (index < 0 || index >= _tabs.length) return;
    final list = [..._tabs];
    list.removeAt(index);
    _tabs = list;
    if (_tabs.isEmpty) {
      _activeIndex = -1;
    } else if (_activeIndex >= _tabs.length) {
      _activeIndex = _tabs.length - 1;
    }
    notifyListeners();
  }

  /// Permanently delete a tab. Drops the server record if persisted, then
  /// removes from the local list. Refuses to delete a tab with payments
  /// or fired items — operator should refund / settle instead.
  Future<bool> deleteTab(int index) async {
    if (index < 0 || index >= _tabs.length) return false;
    final t = _tabs[index];
    final hasPayments = t.amountPaid > 0;
    final hasFired = t.productItems.any((l) => l.isFired);
    if (hasPayments || hasFired) {
      _error = hasPayments ? 'This tab has recorded payments. Refund first.' : 'This tab has items already sent to prep. Use refund or no-show instead.';
      notifyListeners();
      return false;
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      if (t.isPersisted) {
        await _service.deleteTab(t.sk);
      }
      // Drop from local list whether persisted or not.
      final list = [..._tabs];
      list.removeAt(index);
      _tabs = list;
      if (_tabs.isEmpty) {
        _activeIndex = -1;
      } else if (_activeIndex >= _tabs.length) {
        _activeIndex = _tabs.length - 1;
      }
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  // ─── Line item operations on the active tab ───────────────────────────

  /// Replace the active tab in _tabs with the result of [mutate]. Keeps
  /// list immutability semantics so Provider rebuilds reliably.
  void _mutateActive(PosOrder Function(PosOrder current) mutate) {
    final t = activeTab;
    if (t == null) return;
    final updated = mutate(t);
    final list = [..._tabs];
    list[_activeIndex] = updated;
    _tabs = list;
    notifyListeners();
  }

  void addLineItem(PosLineItem item) {
    // Once money is recorded, the sold lines are immutable on the server.
    // A new scan belongs to a new sale, even when an old check has focus.
    if (activeTab?.isPaid == true || (activeTab?.amountPaid ?? 0) > 0) {
      newCart();
      _fireSelection.clear();
    }
    // A table order rings each item to the seat being ordered for.
    final seat = activeSeat;
    if (item.seat == null && seat != null) item = item.copyWith(seat: seat);
    _mutateActive((t) {
      // Merge rule: same sku AND same options AND same specialInstructions
      // AND not yet fired → bump qty. Otherwise add new line. Items that
      // were already fired stay separate so the operator can re-fire just
      // the new additions.
      final idx = t.productItems.indexWhere(
        (i) =>
            i.sku == item.sku &&
            i.itemType == item.itemType &&
            i.isUnfired &&
            _sameOptions(i.options, item.options) &&
            (i.specialInstructions ?? '') == (item.specialInstructions ?? '') &&
            (i.seat ?? '') == (item.seat ?? ''),
      );
      List<PosLineItem> items;
      if (idx >= 0) {
        items = [...t.productItems];
        items[idx] = items[idx].copyWith(
          quantity: items[idx].quantity + item.quantity,
        );
      } else {
        // Stamp a stable client-side id so this line can be referenced in
        // fire batches even before the order is persisted.
        final withId = item.id.isEmpty
            ? item.copyWith(
                id: 'ln-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}',
              )
            : item;
        items = [...t.productItems, withId];
      }
      return _recomputeLocal(t.copyWith(productItems: items));
    });
  }

  static bool _sameOptions(
    List<Map<String, String>> a,
    List<Map<String, String>> b,
  ) {
    if (a.length != b.length) return false;
    final aMap = <String, String>{
      for (final o in a) (o['name'] ?? ''): (o['value'] ?? ''),
    };
    final bMap = <String, String>{
      for (final o in b) (o['name'] ?? ''): (o['value'] ?? ''),
    };
    if (aMap.length != bMap.length) return false;
    for (final k in aMap.keys) {
      if (aMap[k] != bMap[k]) return false;
    }
    return true;
  }

  void adjustQty(int lineIndex, num delta) {
    _mutateActive((t) {
      if (lineIndex < 0 || lineIndex >= t.productItems.length) return t;
      final items = [...t.productItems];
      final newQty = items[lineIndex].quantity + delta;
      if (newQty <= 0) {
        items.removeAt(lineIndex);
      } else {
        items[lineIndex] = items[lineIndex].copyWith(quantity: newQty);
      }
      return _recomputeLocal(t.copyWith(productItems: items));
    });
  }

  void removeLineItem(int lineIndex) {
    _mutateActive((t) {
      if (lineIndex < 0 || lineIndex >= t.productItems.length) return t;
      final items = [...t.productItems]..removeAt(lineIndex);
      return _recomputeLocal(t.copyWith(productItems: items));
    });
  }

  void setIdentity({
    String? name,
    String? email,
    String? phone,
    String? alias,
  }) {
    _mutateActive(
      (t) => t.copyWith(name: name, email: email, phone: phone, alias: alias),
    );
  }

  /// Compute subtotal / tax / total locally for snappy UI feedback. Server
  /// is still the authoritative computation on save / settle.
  PosOrder _recomputeLocal(PosOrder t) {
    final subtotal = t.productItems.fold<num>(
      0,
      (s, i) => s + i.amount - i.discount,
    );
    // No client-side tax model in v1 — display whatever subtotal becomes
    // until the server returns a saved order with proper totals.
    return t.copyWith(subtotal: subtotal, total: subtotal);
  }

  // ─── Persistence ──────────────────────────────────────────────────────

  /// Save the active local cart as a server tab. Ignored if already persisted.
  /// On success, the active tab is replaced with the server's authoritative
  /// version (now has an sk + number) and any pending line items are pushed.
  Future<bool> saveActive() async {
    final t = activeTab;
    if (t == null) {
      _error = 'No active cart';
      notifyListeners();
      return false;
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      PosOrder? saved;
      if (!t.isPersisted) {
        // First-time save — open the tab on the server. If no location is
        // selected, send empty string and let the server pick its default
        // (or surface a server-side validation error rather than blocking
        // the operator client-side).
        saved = await _service.openTab(
          businessLocationId: _businessLocationId,
          tabLabel: t.tabLabel,
          servicePointId: t.servicePointId,
          customer: (t.email?.isNotEmpty ?? false)
              ? {'name': t.name, 'email': t.email, 'phone': t.phone}
              : null,
        );
      }
      // Push line items, mirroring the React POS split:
      //   - REAL products (itemType=='product') with a client-generated id
      //     → POST /order/:id/items so the server enriches from sf_product
      //     (name/unitPrice/suggestedWorkflowId) and stamps a stable id.
      //   - Ad-hoc / fee / discount lines (anything not backed by sf_product,
      //     e.g. Take-Payment's "QUICK-SALE") AND any existing lines with
      //     server-stamped ids → write the full productItems array via
      //     /repository/update-partial so the server doesn't try to look up
      //     a non-existent SKU.
      final orderId = (saved ?? t).sk;
      if (orderId.isNotEmpty && t.productItems.isNotEmpty) {
        bool isFreshClientLine(PosLineItem l) =>
            l.id.isEmpty || l.id.startsWith('ln-');
        bool needsProductEnrichment(PosLineItem l) =>
            l.itemType == 'product' &&
            l.sku.isNotEmpty &&
            l.sku != 'QUICK-SALE';

        // A standalone payment line (deposit, fee) goes through the same
        // route: the server keeps it untaxed and off the prep stations.
        bool isPaymentLine(PosLineItem l) =>
            l.itemType == 'fee' && l.sku == 'QUICK-SALE';
        final freshProducts = t.productItems
            .where((l) => isFreshClientLine(l) &&
                (needsProductEnrichment(l) || isPaymentLine(l)))
            .toList();
        // Everything not in freshProducts — ad-hoc lines + already-saved
        // lines. We write the full set via update-partial.
        final passthrough = t.productItems
            .where((l) => !(isFreshClientLine(l) && needsProductEnrichment(l)))
            .toList();

        // Lines already on the tab that are real products: send only what
        // changed, as line updates through the same route (the server
        // re-prices, tax included). The raw record write is kept for ad-hoc
        // lines only; it sets the total without tax, so a second round used
        // to lose the tab's sales tax.
        bool isAdHoc(PosLineItem l) => !needsProductEnrichment(l);
        final updates = <Map<String, dynamic>>[];
        if (t.isPersisted) {
          final server = await _service.getOrderById(orderId);
          final local = {for (final l in t.productItems) l.id: l};
          for (final sl in server?.productItems ?? const <PosLineItem>[]) {
            if (sl.id.isEmpty || isAdHoc(sl)) continue;
            final ll = local[sl.id];
            if (ll == null) {
              if (sl.isUnfired) updates.add({'id': sl.id, 'remove': true});
              continue;
            }
            final u = <String, dynamic>{'id': sl.id};
            if (ll.quantity != sl.quantity) u['quantity'] = ll.quantity;
            if ((ll.specialInstructions ?? '') != (sl.specialInstructions ?? '')) {
              u['specialInstructions'] = ll.specialInstructions ?? '';
            }
            if (u.length > 1) updates.add(u);
          }
        }
        if (freshProducts.isNotEmpty || updates.isNotEmpty) {
          saved = await _service.addItemsToTab(
            orderId: orderId,
            items: freshProducts,
            updates: updates,
          );
        }
        final adHoc =
            passthrough.where((l) => isAdHoc(l) && !isPaymentLine(l)).toList();
        if (adHoc.isNotEmpty) {
          // Merge ad-hoc lines onto whatever the server returned.
          final merged = [...(saved?.productItems ?? t.productItems.where((l) => !isAdHoc(l)))];
          for (final p in adHoc) {
            final idx = merged.indexWhere((m) => m.id == p.id);
            if (idx >= 0) {
              merged[idx] = p;
            } else {
              merged.add(p);
            }
          }
          saved = await _service.updateTabLineItems(
            orderId: orderId,
            productItems: merged,
          );
        }
        saved ??= t.isPersisted ? await _service.getOrderById(orderId) : null;
      }
      if (saved != null) {
        final list = [..._tabs];
        // Use the server's authoritative productItems (with stamped ids)
        // — this is what /fire will look for.
        list[_activeIndex] = saved;
        _tabs = list;
      }
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Record a payment against the active tab. Backend closes the order
  /// when the running paid amount equals total. Returns the settled order
  /// or null on failure.
  /// Record a payment against the active tab. THROWS on failure — callers
  /// MUST handle the exception or the UI will mark a tender as charged
  /// while the server has no record (the bug behind double-settles where
  /// only the first payment hits the database).
  Future<PosOrder> settleActive({
    required num amount,
    num tip = 0,
    num? tendered,
    String? orderId,
    String method = 'cash',
    String? gateway,
    String? ref,
  }) async {
    final t = orderId == null
        ? activeTab
        : _tabs.where((tab) => tab.sk == orderId).firstOrNull;
    if (t == null || !t.isPersisted) {
      _error = 'Save the tab before settling';
      notifyListeners();
      throw Exception('Save the tab before settling');
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final settled = await _service.settleTab(
        orderId: t.sk,
        amount: amount,
        tip: tip,
        tendered: tendered,
        method: method,
        gateway: gateway,
        ref: ref,
      );
      if (settled == null) {
        // Server accepted the request but returned an unexpected shape —
        // treat as failure so we don't lie to the operator about a
        // payment that may not have been persisted.
        throw Exception(
          'Settle returned no order — payment may not be recorded',
        );
      }
      // If fully paid, drop from open list; else update in place.
      final focused = activeTab;
      final list = [..._tabs];
      final settledIndex = list.indexWhere((tab) => tab.sk == t.sk);
      if (settled.isPaid && settledIndex >= 0) {
        list.removeAt(settledIndex);
        _tabs = list;
        if (focused?.sk == t.sk) {
          // Keep the next sale separate from other open checks. Checkout
          // retains the paid order for its receipt until it is dismissed.
          _tabs.add(PosOrder(businessLocationId: _businessLocationId));
          _activeIndex = _tabs.length - 1;
          _fireSelection.clear();
        } else {
          // Another check may have gained focus while payment was pending.
          _activeIndex = focused == null
              ? -1
              : _tabs.indexWhere((tab) => identical(tab, focused));
        }
      } else if (settledIndex >= 0) {
        list[settledIndex] = settled;
        _tabs = list;
      }
      return settled;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      rethrow;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Fire the currently-selected line items on the active tab.
  ///
  /// The server routes the selection through prep-pipeline and splits by
  /// each line's prepStation. A product's publishing workflow is unrelated.
  /// [workflowId] is an explicit advanced override only.
  ///
  /// Tab must be persisted (sk != ''). Caller should ensure save first.
  Future<bool> fireSelected({
    String? workflowId,
    String? course,
    String? seat,
    String? specialInstructions,
  }) async {
    if (_busy) return false;
    final t = activeTab;
    if (t == null) {
      _error = 'No active tab';
      notifyListeners();
      return false;
    }
    if (!t.isPersisted) {
      _error = 'Save the tab before firing';
      notifyListeners();
      return false;
    }
    if (_fireSelection.isEmpty) {
      _error = 'Select at least one item to fire';
      notifyListeners();
      return false;
    }

    _busy = true;
    _error = null;
    notifyListeners();

    try {
      final selected = t.productItems
          .where((line) => _fireSelection.contains(line.id) && line.isUnfired)
          .map((line) => line.id)
          .toList();
      if (selected.isEmpty) throw StateError('No unsent items selected.');
      final updated = await _service.fireItems(
        orderId: t.sk,
        workflowId: workflowId,
        itemIds: selected,
        course: course,
        seat: seat,
        specialInstructions: specialInstructions,
      );
      if (updated == null)
        throw StateError(
          'The prep send was not confirmed. Refresh the tab before retrying.',
        );
      final index = _tabs.indexWhere((tab) => tab.sk == t.sk);
      if (index >= 0) _tabs[index] = updated;
      _fireSelection.clear();
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
