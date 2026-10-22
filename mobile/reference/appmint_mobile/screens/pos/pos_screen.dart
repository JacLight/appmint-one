import '../../widgets/pos_mobile_cart.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../models/pos_order_model.dart';
import '../../providers/location_provider.dart';
import '../../providers/pos_provider.dart';
import '../../providers/pos_device_settings.dart';
import '../settings/pos_settings_screen.dart';
import '../../services/pos_service.dart';
import '../../services/operations_service.dart';
import '../../models/operations_reservation_model.dart';
import '../../services/printer_service.dart';
import '../../widgets/location_picker.dart';
import '../settings/devices_screen.dart';
import '../../services/scanner_service.dart';
import 'checkout_screen.dart';
import '../scanner/code_scanner_screen.dart';

/// In-store POS — multiple open tabs (carts) accessible via a horizontal
/// strip at the top, plus line item editing and payment settlement.
///
/// Mirrors the React POS at websitemint/.../operations/POS.tsx but adapted
/// for a phone-sized screen: tab strip is horizontally scrollable, line
/// items take the full width, action bar pinned to the bottom.
class PosScreen extends StatefulWidget {
  /// businessLocationId — falls back to LocationProvider.selectedId when
  /// empty so the operator's active venue carries through automatically.
  final String businessLocationId;

  /// Deep-link arrivals. When set, after the first tab fetch we select
  /// the matching open tab (focus its cart). Used by:
  ///   - Tabs page "Open" / "Settle" → opens that tab in POS
  ///   - Floor service-point tap → opens (or creates) a tab on that SP
  ///   - Check-in Assign → after seating, jumps into the new tab's POS
  final String? initialTabSk;
  final String? initialServicePointId;
  final String? initialServicePointDisplay;

  /// 'open' (default) — just focus the tab; 'settle' — also push the
  /// Checkout screen so the operator goes straight to payment.
  final String? initialAction;

  const PosScreen({
    super.key,
    required this.businessLocationId,
    this.initialTabSk,
    this.initialServicePointId,
    this.initialServicePointDisplay,
    this.initialAction,
  });

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  Future<void> _scanQueue = Future<void>.value();
  ModalRoute<dynamic>? _cartRoute;

  bool get _scanTargetIsCurrent =>
      mounted &&
      (ModalRoute.of(context)?.isCurrent == true ||
          _cartRoute?.isCurrent == true);
  StreamSubscription<ScanEvent>? _scanSub;

  @override
  void initState() {
    super.initState();
    // Queue physical scans so a second trigger is not dropped during lookup.
    // Camera results are handled by the explicit scan button, exactly once.
    _scanSub = scannerService.scanStream.listen((ev) {
      if (ev.source != ScanSource.camera && _scanTargetIsCurrent) {
        _scanQueue = _scanQueue.then((_) async {
          if (_scanTargetIsCurrent) await _handleScannedCode(ev.code);
        });
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final loc = context.read<LocationProvider>();
      final pos = context.read<PosProvider>();
      final venue = widget.businessLocationId.isNotEmpty
          ? widget.businessLocationId
          : loc.businessLocationName;
      await pos.setBusinessLocation(venue);
      pos.loadCategories();
      pos.loadProducts();
      loc.addListener(_onLocationChanged);
      // Deep-link: focus an existing tab by sk, or scope to a service point.
      // This is what makes Tabs → POS, Floor → POS, Check-in → POS feel like
      // one flow instead of independent screens.
      //
      // openExistingTab handles the closed/paid case: the local _tabs list
      // is the OPEN tabs only (status not in terminal set), so a paid tab
      // would never be found in it. The provider fetches it from the server
      // and appends, then switches.
      if (widget.initialTabSk != null && widget.initialTabSk!.isNotEmpty) {
        await pos.openExistingTab(widget.initialTabSk!);
      } else if (widget.initialServicePointId != null &&
          widget.initialServicePointId!.isNotEmpty) {
        // Find an existing open tab on this SP, else start a new cart on it.
        // Tabs carry the point's name; tolerate a caller that passed the
        // display label or the record id by matching on the label too.
        final wanted = {
          widget.initialServicePointId,
          widget.initialServicePointDisplay,
        }.whereType<String>().where((v) => v.isNotEmpty).toSet();
        final idx = pos.tabs.indexWhere(
          (t) =>
              wanted.contains(t.servicePointId) ||
              (t.tabLabel != null && wanted.contains(t.tabLabel)),
        );
        if (idx >= 0) {
          pos.switchTo(idx);
        } else {
          pos.newCart(
            servicePointId: widget.initialServicePointId,
            tabLabel: widget.initialServicePointDisplay,
          );
        }
      }
      // Settle deep-link: after we land on the right tab, push Checkout.
      if (widget.initialAction == 'settle' &&
          mounted &&
          pos.activeTab != null) {
        final tab = pos.activeTab!;
        if (tab.productItems.isNotEmpty) {
          Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => CheckoutScreen(order: tab)));
        }
      }
    });
  }

  void _onLocationChanged() {
    if (!mounted) return;
    final loc = context.read<LocationProvider>();
    final pos = context.read<PosProvider>();
    if (widget.businessLocationId.isEmpty) {
      pos.setBusinessLocation(loc.businessLocationName);
    }
  }

  @override
  void dispose() {
    try {
      Provider.of<LocationProvider>(
        context,
        listen: false,
      ).removeListener(_onLocationChanged);
    } catch (_) {}
    _scanSub?.cancel();
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      context.read<PosProvider>().setProductSearch(value);
    });
  }

  /// Scan an SKU/barcode → look up the product → if found, run the same
  /// add-to-cart flow as a card tap (open options sheet if the product has
  /// variations, else add directly with default options).
  /// Keep the camera open while adding products through the same lookup
  /// and cart path used by the hardware scanner.
  Future<void> _scanAndAdd(BuildContext context) async {
    // Camera scanning always works unless explicitly switched off in
    // Devices → Barcode scanner. It is never gated by HID/BLE state.
    if (!scannerService.cameraScanEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Camera scanner is off — turn it on in Devices → Barcode scanner',
          ),
        ),
      );
      return;
    }
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => CodeScannerScreen(
          title: 'Scan products',
          hint: 'Scan each product to add it to your cart',
          onScan: (scanContext, code) =>
              _handleScannedCode(code, scanContext: scanContext),
          footer: Consumer<PosProvider>(
            builder: (_, pos, _) {
              final cart = pos.activeTab;
              final count = cart?.productItems.fold<num>(0, (sum, line) => sum + line.quantity) ?? 0;
              return Text(
                '$count items · \$${(cart?.displayTotal ?? 0).toStringAsFixed(2)}',
                style: HaHoTextStyles.h3,
              );
            },
          ),
        ),
      ),
    );
  }

  /// Shared add-by-code pipeline used by BOTH the camera scan and the
  /// app-wide HID scanner stream: look up the SKU, add to the active cart,
  /// or surface "not found". Uses the State's context (guarded by mounted)
  /// so it works for a hardware scan with no scan-screen context.
  Future<String?> _handleScannedCode(String code, {BuildContext? scanContext}) async {
    bool isCurrent() => mounted && (scanContext == null
        ? _scanTargetIsCurrent
        : scanContext.mounted && ModalRoute.of(scanContext)?.isCurrent == true);
    final sku = code.trim();
    if (sku.isEmpty || !isCurrent()) return null;
    try {
      final found = await posService.findProductByCode(
        sku,
        loadedProducts: context.read<PosProvider>().products,
      );
      if (!mounted || (scanContext != null && !scanContext.mounted) || !isCurrent()) return null;
      if (found == null) {
        if (scanContext != null) throw StateError('No product found for "$sku"');
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(content: Text('No product found for "$sku"')),
          );
        return null;
      }
      final pos = context.read<PosProvider>();
      if (isCurrent()) {
        final added = await _addToActiveCart(scanContext ?? context, pos, found, scanned: true);
        return added ? 'Added ${found.name}' : null;
      }
    } catch (e) {
      if (scanContext != null) rethrow;
      if (!mounted) return null;
      final message = e.toString().replaceFirst('Exception: ', '');
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text('Could not look up "$sku". $message'),
            duration: const Duration(seconds: 8),
          ),
        );
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        centerTitle: false,
        title: const LocationAppBarTitle(title: 'POS'),
        backgroundColor: HaHoColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Scan SKU',
            onPressed: () => _scanAndAdd(context),
          ),
          Consumer<PosProvider>(
            builder: (_, pos, __) => pos.loadingTabs
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    icon: const Icon(Icons.receipt_long),
                    onPressed: () => _showOpenTabs(context),
                    tooltip: 'Open tabs',
                  ),
          ),
          PopupMenuButton<String>(
            tooltip: 'POS options',
            onSelected: (value) => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => value == 'devices'
                    ? const DevicesScreen()
                    : const PosSettingsScreen(),
              ),
            ),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'settings', child: Text('POS settings')),
              PopupMenuItem(value: 'devices', child: Text('Devices')),
            ],
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, outer) {
          // Keep the order visible: beside products on tablets, below on phones.
          final wide = outer.maxWidth >= 720;
          final short = outer.maxHeight < 500;
          return Consumer<PosProvider>(
            builder: (context, pos, _) {
              final productSide = Column(
                children: [
                  // Search bar — products are the headline content
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      HaHoSpacing.lg,
                      HaHoSpacing.sm,
                      HaHoSpacing.lg,
                      HaHoSpacing.sm,
                    ),
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Search products…',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _searchController.text.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.close, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  pos.setProductSearch('');
                                },
                              ),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(HaHoRadius.lg),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      ),
                      onChanged: _onSearchChanged,
                    ),
                  ),
                  // Category chips
                  if (pos.categories.isNotEmpty && !short)
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: HaHoSpacing.lg,
                        ),
                        itemCount: pos.categories.length + 1,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          if (i == 0) {
                            return _CatChip(
                              label: 'All',
                              selected: pos.selectedCategory.isEmpty,
                              onTap: () => pos.setCategory(''),
                            );
                          }
                          final cat = pos.categories[i - 1];
                          final value =
                              (cat['value'] ?? cat['name'] ?? cat['id'] ?? '')
                                  .toString();
                          final label = (cat['label'] ?? cat['name'] ?? value)
                              .toString();
                          return _CatChip(
                            label: label,
                            selected: pos.selectedCategory == value,
                            onTap: () => pos.setCategory(value),
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: HaHoSpacing.sm),
                  // Day-part menu switcher — turns whole menus on/off by time.
                  // Only the location's own day-part menus (none: no switcher).
                  if (!short && PosProduct.dayParts(pos.products).isNotEmpty)
                    SizedBox(
                      height: 34,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: HaHoSpacing.lg,
                        ),
                        children: [
                          for (final m in PosProduct.dayParts(pos.products))
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: _MenuChip(
                                label: m[1],
                                selected: pos.activeMenu == m[0],
                                onTap: () => pos.setActiveMenu(m[0]),
                              ),
                            ),
                        ],
                      ),
                    ),
                  const SizedBox(height: HaHoSpacing.sm),
                  // A table order: pick the guest's seat, then ring their
                  // items (each line keeps its seat for the ticket and for
                  // split by seat). "Table" = shared by the table.
                  if (pos.seatsApply)
                    Padding(
                      padding: const EdgeInsets.only(bottom: HaHoSpacing.sm),
                      child: SizedBox(
                        height: 34,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(
                            horizontal: HaHoSpacing.lg,
                          ),
                          children: [
                            _SeatChip(
                              label: 'Table',
                              selected: pos.activeSeat == null,
                              onTap: () => pos.setActiveSeat(null),
                            ),
                            for (final n in _seatNumbers(pos))
                              _SeatChip(
                                label: 'Seat $n',
                                selected: pos.activeSeat == '$n',
                                onTap: () => pos.setActiveSeat('$n'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  // Error banner
                  if (pos.error != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: HaHoSpacing.lg,
                        vertical: HaHoSpacing.sm,
                      ),
                      color: HaHoColors.error.withValues(alpha: 0.1),
                      child: Text(
                        pos.error!,
                        style: HaHoTextStyles.caption.copyWith(
                          color: HaHoColors.error,
                        ),
                      ),
                    ),
                  // Product grid is the main content
                  Expanded(
                    child: pos.loadingProducts && pos.products.isEmpty
                        ? const Center(child: CircularProgressIndicator())
                        : pos.visibleProducts.isEmpty
                        ? const _NoProducts()
                        : RefreshIndicator(
                            onRefresh: () => pos.loadProducts(),
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                const target = 160.0;
                                final w = constraints.maxWidth;
                                final cols = (w / target).floor().clamp(2, 8);
                                return GridView.builder(
                                  padding: EdgeInsets.fromLTRB(
                                    HaHoSpacing.lg,
                                    0,
                                    HaHoSpacing.lg,
                                    HaHoSpacing.lg,
                                  ),
                                  gridDelegate:
                                      SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: cols,
                                        mainAxisSpacing: HaHoSpacing.sm,
                                        crossAxisSpacing: HaHoSpacing.sm,
                                        childAspectRatio: wide ? 0.72 : 1.0,
                                      ),
                                  itemCount: pos.visibleProducts.length,
                                  itemBuilder: (_, i) {
                                    final p = pos.visibleProducts[i];
                                    return _ProductCard(
                                      product: p,
                                      onTap: () =>
                                          _addToActiveCart(context, pos, p),
                                      onLongPress: () =>
                                          _show86Sheet(context, pos, p),
                                    );
                                  },
                                );
                              },
                            ),
                          ),
                  ),
                ],
              );
              // Tablet: products on the left, cart panel docked on the right.
              // Phone: a compact cart remains visible below the product grid.
              if (wide) {
                return Row(
                  children: [
                    Expanded(child: productSide),
                    const VerticalDivider(width: 1, color: HaHoColors.border),
                    SizedBox(width: 360, child: const _CartSheet()),
                  ],
                );
              }
              return Column(
                children: [
                  Expanded(child: productSide),
                  SizedBox(
                    height: (outer.maxHeight * (short ? 0.4 : 0.36)).clamp(
                      short ? 180.0 : 220.0,
                      280.0,
                    ),
                    child: PosMobileCart(
                      actionLabel: context.watch<PosDeviceSettings>().showPrep
                          ? 'Review order'
                          : 'Checkout',
                      busy:
                          pos.busy ||
                          !context.watch<PosDeviceSettings>().loaded,
                      onReview: () => context.read<PosDeviceSettings>().showPrep
                          ? _showCartSheet(context)
                          : _checkoutDirectly(),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _checkoutDirectly() async {
    final pos = context.read<PosProvider>();
    if (pos.busy || pos.activeTab == null) return;
    if (pos.activeTab!.amountPaid >= pos.activeTab!.total) {
      _showCartSheet(context);
      return;
    }
    if (!await pos.saveActive()) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(pos.error ?? 'Could not save order.')),
        );
      return;
    }
    if (!mounted || pos.activeTab == null) return;
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => CheckoutScreen(order: pos.activeTab!)),
    );
  }

  /// Tap on a product card. If the product has options/variations, open
  /// the options sheet so the operator can pick before adding. Otherwise
  /// add directly with default qty=1.
  Future<bool> _addToActiveCart(
    BuildContext context,
    PosProvider pos,
    PosProduct p, {
    bool scanned = false,
  }) async {
    // 86'd or out of stock — never let it onto a tab.
    if (!p.isAvailable) {
      final why = p.eightySixed
          ? "${p.name} is 86'd${(p.eightySixReason?.isNotEmpty ?? false) ? ' · ${p.eightySixReason}' : ''}"
          : '${p.name} is out of stock';
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(why),
          backgroundColor: HaHoColors.warning,
          duration: const Duration(milliseconds: 1400),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return false;
    }
    // A fixed prep station is routing metadata, not a choice to repeat on
    // every scan. Products with real choices still require selection.
    final useDefaults =
        scanned &&
        p.variations.length <= 1 &&
        p.attributes.every((attribute) => attribute.options.length == 1);
    if ((p.hasOptions || p.hasVariations) && !useDefaults) {
      return await _showOptionsSheet(context, pos, p);
    }
    if (pos.activeTab == null) pos.newCart();
    pos.addLineItem(
      p.toLineItem(
        selectedOptions: useDefaults
            ? {
                for (final attribute in p.attributes)
                  attribute.name: attribute.options.single.value,
              }
            : const {},
      ),
    );
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added ${p.name}'),
        duration: const Duration(milliseconds: 800),
        behavior: SnackBarBehavior.floating,
      ),
    );
    return true;
  }

  /// Long-press a product → 86 it (mark out) or un-86 it. Writes the
  /// bm_location_product overlay; the grid refreshes on success.
  void _show86Sheet(BuildContext context, PosProvider pos, PosProduct p) {
    final reasonController = TextEditingController(
      text: p.eightySixReason ?? '',
    );
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 18,
          bottom: MediaQuery.of(sheetCtx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              p.name,
              style: HaHoTextStyles.h3,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              p.eightySixed
                  ? "Currently 86'd — bring it back to sell it again."
                  : "86 this item to pull it off every POS at this location.",
              style: HaHoTextStyles.bodySmall.copyWith(
                color: HaHoColors.textGray,
              ),
            ),
            const SizedBox(height: 16),
            if (!p.eightySixed)
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(
                  labelText: 'Reason (optional)',
                  hintText: 'Out of prep, supplier delay…',
                  border: OutlineInputBorder(),
                ),
              ),
            if (!p.eightySixed) const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: p.eightySixed
                      ? HaHoColors.success
                      : HaHoColors.warning,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: Icon(
                  p.eightySixed ? Icons.check_circle_outline : Icons.block,
                ),
                label: Text(
                  p.eightySixed ? 'Un-86 · make available' : "86 · mark out",
                ),
                onPressed: () async {
                  Navigator.pop(sheetCtx);
                  final ok = await pos.toggleEightySix(
                    p,
                    reason: reasonController.text.trim().isEmpty
                        ? null
                        : reasonController.text.trim(),
                  );
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).hideCurrentSnackBar();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        ok
                            ? (p.eightySixed
                                  ? '${p.name} is back on the menu'
                                  : "${p.name} is 86'd")
                            : 'Could not update — try again',
                      ),
                      behavior: SnackBarBehavior.floating,
                      duration: const Duration(milliseconds: 1200),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<bool> _showOptionsSheet(BuildContext context, PosProvider pos, PosProduct p) async {
    return await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ProductOptionsSheet(product: p, pos: pos),
    ) ?? false;
  }

  void _showCartSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        _cartRoute = ModalRoute.of(sheetContext);
        return const _CartSheet();
      },
    ).whenComplete(() => _cartRoute = null);
  }

  void _showOpenTabs(BuildContext context) {
    final pos = context.read<PosProvider>();
    pos.loadOpenTabs();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _OpenTabsSheet(),
    );
  }
}

class _NoProducts extends StatelessWidget {
  const _NoProducts();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(HaHoSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.inventory_2_outlined,
              size: 48,
              color: HaHoColors.textGray,
            ),
            const SizedBox(height: HaHoSpacing.md),
            Text(
              'No products',
              style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
            ),
            const SizedBox(height: HaHoSpacing.xs),
            Text(
              'Try clearing search or category, or add products on the dashboard.',
              style: HaHoTextStyles.bodySmall.copyWith(
                color: HaHoColors.textGray,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Cart sheet — slides up from bottom when user taps "View cart" FAB.
/// Shows the active tab's line items + tab strip if there are multiple
/// open tabs, plus the action bar (Save / Settle).
class _CartSheet extends StatelessWidget {
  const _CartSheet();

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Consumer<PosProvider>(
        builder: (context, pos, _) {
          final t = pos.activeTab;
          if (t == null) return const SizedBox.shrink();
          return Column(
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: HaHoColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Tab switcher (when more than one cart open)
              if (pos.tabs.length > 1) _TabStrip(),
              // Header with paid badge when applicable — makes the operator's
              // mental model immediate ("this tab is closed, I'm just viewing
              // it"). Skipped for fresh carts to keep the empty state clean.
              if (t.isPersisted && (t.amountPaid > 0 || t.total > 0))
                _TabStateHeader(tab: t),
              // Items + payments — one scroll surface so partial-pay tabs can
              // show "what was bought" and "what's been paid so far" in the
              // same glance, instead of hiding payments behind a separate
              // screen that makes operators think they have to charge again.
              Expanded(
                child: t.productItems.isEmpty && t.payments.isEmpty
                    ? Center(
                        child: Text(
                          'Cart is empty',
                          style: HaHoTextStyles.body.copyWith(
                            color: HaHoColors.textGray,
                          ),
                        ),
                      )
                    : ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(
                          HaHoSpacing.md,
                          HaHoSpacing.md,
                          HaHoSpacing.md,
                          HaHoSpacing.lg,
                        ),
                        children: [
                          if (t.productItems.isNotEmpty) ...[
                            if (context.watch<PosDeviceSettings>().showPrep &&
                                !t.isPaid &&
                                t.productItems.any((item) => item.isUnfired))
                              const Padding(
                                padding: EdgeInsets.only(bottom: 12),
                                child: Text(
                                  'Select rows to send to prep separately.',
                                  style: TextStyle(
                                    color: HaHoColors.textGray,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            for (int i = 0; i < t.productItems.length; i++) ...[
                              _LineItemRow(
                                item: t.productItems[i],
                                lineIndex: i,
                              ),
                              if (i < t.productItems.length - 1)
                                const Divider(
                                  height: 1,
                                  color: HaHoColors.border,
                                ),
                            ],
                          ],
                          if (t.payments.isNotEmpty) ...[
                            const SizedBox(height: HaHoSpacing.lg),
                            _PaymentsSection(tab: t),
                          ],
                        ],
                      ),
              ),
              // Action bar — pinned at the bottom of the sheet
              const _ActionBar(),
            ],
          );
        },
      ),
    );
  }
}

/// Open tabs sheet — appears via the receipt icon in the AppBar. Lets the
/// operator switch to a previously-saved tab without losing the current
/// product browse position.
class _OpenTabsSheet extends StatelessWidget {
  const _OpenTabsSheet();

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      builder: (_, scrollController) => Consumer<PosProvider>(
        builder: (context, pos, _) {
          return Column(
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: HaHoColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  HaHoSpacing.lg,
                  4,
                  HaHoSpacing.lg,
                  HaHoSpacing.md,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Open tabs', style: HaHoTextStyles.h3),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.add),
                      label: const Text('New'),
                      onPressed: () {
                        pos.newCart();
                        Navigator.pop(context);
                      },
                    ),
                  ],
                ),
              ),
              Expanded(
                child: pos.tabs.isEmpty
                    ? Center(
                        child: Text(
                          'No open tabs',
                          style: HaHoTextStyles.body.copyWith(
                            color: HaHoColors.textGray,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: pos.tabs.length,
                        itemBuilder: (_, i) {
                          final t = pos.tabs[i];
                          final selected = i == pos.activeIndex;
                          final qty = t.productItems.fold<num>(
                            0,
                            (s, x) => s + x.quantity,
                          );
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: selected
                                  ? HaHoColors.primary
                                  : HaHoColors.cardLight,
                              foregroundColor: selected
                                  ? Colors.white
                                  : HaHoColors.textGray,
                              child: Icon(
                                t.isPersisted
                                    ? Icons.bookmark
                                    : Icons.shopping_cart_outlined,
                                size: 18,
                              ),
                            ),
                            title: Text(t.displayLabel),
                            subtitle: Text(
                              '$qty item${qty == 1 ? '' : 's'} · \$${t.subtotal.toStringAsFixed(2)}',
                            ),
                            trailing: selected
                                ? const Icon(
                                    Icons.check,
                                    color: HaHoColors.primary,
                                  )
                                : null,
                            onTap: () {
                              pos.switchTo(i);
                              Navigator.pop(context);
                            },
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Top horizontal tab strip ─────────────────────────────────────────────

class _TabStrip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<PosProvider>(
      builder: (context, pos, _) {
        return Container(
          height: 56,
          color: Colors.white,
          child: Row(
            children: [
              Expanded(
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: pos.tabs.length,
                  padding: const EdgeInsets.symmetric(
                    horizontal: HaHoSpacing.sm,
                  ),
                  itemBuilder: (_, i) {
                    final t = pos.tabs[i];
                    final selected = i == pos.activeIndex;
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 8,
                      ),
                      child: GestureDetector(
                        onTap: () => pos.switchTo(i),
                        onLongPress: () => _confirmDismiss(context, i, t),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: HaHoSpacing.md,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: selected
                                ? HaHoColors.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(
                              HaHoRadius.pill,
                            ),
                            border: Border.all(
                              color: selected
                                  ? HaHoColors.primary
                                  : HaHoColors.border,
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                t.isPersisted
                                    ? Icons.bookmark
                                    : Icons.shopping_cart_outlined,
                                size: 14,
                                color: selected
                                    ? Colors.white
                                    : HaHoColors.textDark,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                t.displayLabel,
                                style: HaHoTextStyles.bodySmall.copyWith(
                                  color: selected
                                      ? Colors.white
                                      : HaHoColors.textDark,
                                  fontWeight: selected
                                      ? FontWeight.w600
                                      : FontWeight.w500,
                                ),
                              ),
                              if (t.productItems.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color:
                                        (selected
                                                ? Colors.white
                                                : HaHoColors.primary)
                                            .withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(
                                      HaHoRadius.sm,
                                    ),
                                  ),
                                  child: Text(
                                    '${t.productItems.length}',
                                    style: HaHoTextStyles.caption.copyWith(
                                      color: selected
                                          ? Colors.white
                                          : HaHoColors.primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                              // Close button on the selected pill — drops it
                              // from this device's view immediately. Server
                              // record stays put. The long-press menu is the
                              // place to actually delete.
                              if (selected) ...[
                                const SizedBox(width: 6),
                                InkWell(
                                  onTap: () => pos.dismissTab(i),
                                  customBorder: const CircleBorder(),
                                  child: Padding(
                                    padding: const EdgeInsets.all(2),
                                    child: Icon(
                                      Icons.close,
                                      size: 14,
                                      color: Colors.white.withValues(
                                        alpha: 0.85,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.sm),
                child: IconButton(
                  icon: const Icon(Icons.add_circle, color: HaHoColors.primary),
                  tooltip: 'New cart',
                  onPressed: () => _newCartDialog(context, pos),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Long-press on a tab → choose what to do with it. Persisted tabs can
  /// be HIDDEN (drops from the local list, server keeps it) or DELETED
  /// (drops from the server entirely — only allowed when there are no
  /// payments and no fired items). Local-only carts just discard.
  void _confirmDismiss(BuildContext context, int index, PosOrder tab) async {
    final pos = context.read<PosProvider>();
    if (!tab.isPersisted) {
      // Local cart — single Discard action, no need for a menu.
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Discard cart?'),
          content: const Text(
            'Unsaved items will be lost. This cart was never saved to the server.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              style: TextButton.styleFrom(foregroundColor: HaHoColors.error),
              child: const Text('Discard'),
            ),
          ],
        ),
      );
      if (ok == true && context.mounted) pos.dismissTab(index);
      return;
    }
    // Persisted tab — show an action sheet with both options.
    final canDelete =
        tab.amountPaid == 0 && !tab.productItems.any((l) => l.isFired);
    final result = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                HaHoSpacing.lg,
                HaHoSpacing.md,
                HaHoSpacing.lg,
                HaHoSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      tab.displayLabel,
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.visibility_off_outlined),
              title: const Text('Hide from this device'),
              subtitle: const Text(
                'Tab stays on the server; other devices still see it.',
              ),
              onTap: () => Navigator.pop(sctx, 'hide'),
            ),
            ListTile(
              leading: Icon(
                Icons.delete_outline,
                color: canDelete ? HaHoColors.error : HaHoColors.textGray,
              ),
              title: Text(
                'Delete tab permanently',
                style: TextStyle(
                  color: canDelete ? HaHoColors.error : HaHoColors.textGray,
                ),
              ),
              subtitle: Text(
                canDelete
                    ? 'Removes the tab from the server. Zero-value / wrongly-opened tabs.'
                    : 'Not allowed — tab has payments or fired items. Refund or use no-show instead.',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
              enabled: canDelete,
              onTap: canDelete ? () => Navigator.pop(sctx, 'delete') : null,
            ),
            const SizedBox(height: HaHoSpacing.sm),
          ],
        ),
      ),
    );
    if (result == 'hide' && context.mounted) {
      pos.dismissTab(index);
    } else if (result == 'delete' && context.mounted) {
      final ok = await pos.deleteTab(index);
      if (!context.mounted) return;
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(pos.error ?? 'Delete failed'),
            backgroundColor: HaHoColors.error,
          ),
        );
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Tab deleted')));
      }
    }
  }

  void _newCartDialog(BuildContext context, PosProvider pos) async {
    final labelController = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New cart'),
        content: TextField(
          controller: labelController,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Tab label (optional)',
            hintText: 'e.g. Table 7, Walk-up #3, Smith party',
          ),
          textInputAction: TextInputAction.done,
          onSubmitted: (v) => Navigator.pop(context, v),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, labelController.text),
            child: const Text('Open'),
          ),
        ],
      ),
    );
    if (result != null) {
      pos.newCart(tabLabel: result.trim().isEmpty ? null : result.trim());
    }
  }
}

class _CatChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _CatChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(HaHoRadius.pill),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: HaHoSpacing.lg,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: selected ? HaHoColors.primary : HaHoColors.cardLight,
          borderRadius: BorderRadius.circular(HaHoRadius.pill),
          border: Border.all(
            color: selected ? HaHoColors.primary : HaHoColors.border,
            width: 1,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: HaHoTextStyles.bodySmall.copyWith(
            color: selected ? Colors.white : HaHoColors.textDark,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

/// Day-part menu pill (Dinner / Brunch / Happy hour …). Styled distinct from
/// the category chips so the two axes read differently.
/// Seats offered on a table order: 1–4, more once a higher seat is in use.
List<int> _seatNumbers(PosProvider pos) {
  var top = 4;
  for (final l in pos.activeTab?.productItems ?? const <PosLineItem>[]) {
    final n = int.tryParse(l.seat ?? '') ?? 0;
    if (n >= top) top = n + 1;
  }
  final s = int.tryParse(pos.activeSeat ?? '') ?? 0;
  if (s >= top) top = s + 1;
  return [for (var i = 1; i <= top.clamp(4, 12); i++) i];
}

class _SeatChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _SeatChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HaHoRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? HaHoColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
            border: Border.all(color: selected ? HaHoColors.accent : HaHoColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(label == 'Table' ? Icons.table_restaurant_outlined : Icons.event_seat_outlined,
                  size: 16, color: selected ? Colors.white : HaHoColors.textGray),
              const SizedBox(width: 6),
              Text(label,
                  style: HaHoTextStyles.bodySmall.copyWith(
                      color: selected ? Colors.white : HaHoColors.textDark, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _MenuChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  IconData get _icon {
    switch (label) {
      case 'Dinner':
        return Icons.nightlight_outlined;
      case 'Brunch':
        return Icons.wb_sunny_outlined;
      case 'Late night':
        return Icons.wine_bar_outlined;
      case 'Happy hour':
        return Icons.local_cafe_outlined;
      default:
        return Icons.restaurant_menu;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(HaHoRadius.pill),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? HaHoColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(HaHoRadius.pill),
          border: Border.all(
            color: selected ? HaHoColors.accent : HaHoColors.border,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _icon,
              size: 14,
              color: selected ? Colors.white : HaHoColors.textGray,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: HaHoTextStyles.caption.copyWith(
                color: selected ? Colors.white : HaHoColors.textDark,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final PosProduct product;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  const _ProductCard({
    required this.product,
    required this.onTap,
    this.onLongPress,
  });

  // Station chip color by prep station bucket.
  static Color _stationColor(String s) {
    switch (s.toUpperCase()) {
      case 'BAR':
        return HaHoColors.accent;
      case 'BARISTA':
        return HaHoColors.primary;
      case 'EVENTS':
        return HaHoColors.success;
      case 'KITCHEN':
        return HaHoColors.warning;
      default:
        return HaHoColors.textGray;
    }
  }

  @override
  Widget build(BuildContext context) {
    final unavailable = !product.isAvailable;
    final hasOverride =
        product.priceOverride != null && product.priceOverride != product.price;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(HaHoRadius.lg),
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        child: Opacity(
          opacity: unavailable ? 0.55 : 1.0,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(HaHoRadius.lg),
              border: Border.all(
                color: product.eightySixed
                    ? HaHoColors.warning
                    : HaHoColors.border,
                width: product.eightySixed ? 1.5 : 1,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Square image with station chip + availability badge overlaid.
                Expanded(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(
                        color: HaHoColors.background,
                        child:
                            product.imageUrl != null &&
                                product.imageUrl!.isNotEmpty
                            ? Image.network(
                                product.imageUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    _ProductPlaceholder(name: product.name),
                              )
                            : _ProductPlaceholder(name: product.name),
                      ),
                      // Station chip (KITCHEN / BAR / BARISTA …) top-left.
                      if (product.prepStation != null &&
                          product.prepStation!.isNotEmpty)
                        Positioned(
                          top: 6,
                          left: 6,
                          child: _chip(
                            product.prepStation!.toUpperCase(),
                            _stationColor(product.prepStation!),
                          ),
                        ),
                      // Availability badge top-right: 86'd wins over Out/stock.
                      if (product.eightySixed)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: _chip(
                            "86'D",
                            HaHoColors.warning,
                            filled: true,
                          ),
                        )
                      else if (product.isOutOfStock)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: _chip('OUT', HaHoColors.error, filled: true),
                        )
                      else if (product.stock != null)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: _chip(
                            '${product.stock!.toInt()} left',
                            product.stock! <= 5
                                ? HaHoColors.error
                                : HaHoColors.textDark,
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        product.name,
                        style: HaHoTextStyles.caption.copyWith(
                          fontWeight: FontWeight.w600,
                          color: HaHoColors.textDark,
                          height: 1.2,
                          decoration: product.eightySixed
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            '\$${product.effectivePrice.toStringAsFixed(2)}',
                            style: HaHoTextStyles.caption.copyWith(
                              color: hasOverride
                                  ? HaHoColors.success
                                  : HaHoColors.textDark,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          if (hasOverride) ...[
                            const SizedBox(width: 5),
                            Text(
                              '\$${product.price.toStringAsFixed(2)}',
                              style: HaHoTextStyles.caption.copyWith(
                                color: HaHoColors.textGray,
                                decoration: TextDecoration.lineThrough,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ],
                      ),
                      // 86 reason line, when present.
                      if (product.eightySixed &&
                          (product.eightySixReason?.isNotEmpty ?? false)) ...[
                        const SizedBox(height: 2),
                        Text(
                          product.eightySixReason!,
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.warning,
                            fontSize: 10,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, Color color, {bool filled = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: filled ? color : Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(HaHoRadius.sm),
        border: filled ? null : Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: filled ? Colors.white : color,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _ProductPlaceholder extends StatelessWidget {
  final String name;
  const _ProductPlaceholder({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: HaHoColors.cardLight,
      alignment: Alignment.center,
      child: Padding(
        padding: const EdgeInsets.all(HaHoSpacing.sm),
        child: Text(
          name,
          textAlign: TextAlign.center,
          style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}

class _LineItemRow extends StatelessWidget {
  final PosLineItem item;
  final int lineIndex;
  const _LineItemRow({required this.item, required this.lineIndex});

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosProvider>();
    final showPrep = context.watch<PosDeviceSettings>().showPrep;
    // A paid check is read-only: nothing left to fire or change.
    final locked = pos.activeTab?.isPaid == true;
    final canSelect = showPrep && !locked && item.id.isNotEmpty && item.isUnfired;
    final selected = canSelect && pos.isLineSelectedForFire(item.id);
    final optsLine = [
      ...item.seatAndCourse,
      ...item.options.map((o) => o['value'] ?? '').where((v) => v.isNotEmpty),
    ].join(' · ');

    // Two-row layout. Row 1 = name (big, primary) + line total top-right.
    // Row 2 = compact qty stepper + unit price reminder. Separating qty
    // and total lets each grow as needed; 4-digit prices no longer fight
    // the +/− buttons for space.
    return InkWell(
      onTap: canSelect ? () => pos.toggleFireSelection(item.id) : null,
      onLongPress: item.isFired || locked ? null : () => pos.removeLineItem(lineIndex),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: HaHoSpacing.sm,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: HaHoColors.border.withValues(alpha: 0.5)),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Selection checkbox / fire indicator — slim 28dp column.
            if (showPrep)
              SizedBox(
                width: 28,
                child: canSelect
                    ? Checkbox(
                        value: selected,
                        visualDensity: VisualDensity.compact,
                        onChanged: (_) => pos.toggleFireSelection(item.id),
                      )
                    : item.isFired
                    ? const Icon(
                        Icons.local_fire_department,
                        size: 16,
                        color: HaHoColors.success,
                      )
                    : const SizedBox.shrink(),
              ),
            // Item details — flexes to fill remaining horizontal space.
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Row 1: name + line total. Both fight here, so the
                  // name wraps to two lines if needed and the total takes
                  // intrinsic width.
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.name,
                          style: HaHoTextStyles.body.copyWith(
                            fontWeight: FontWeight.w600,
                            color: HaHoColors.textDark,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '\$${item.amount.toStringAsFixed(2)}',
                        style: HaHoTextStyles.body.copyWith(
                          fontWeight: FontWeight.w700,
                          color: HaHoColors.textDark,
                        ),
                      ),
                    ],
                  ),
                  // Options / notes line.
                  if (optsLine.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        optsLine,
                        style: HaHoTextStyles.caption.copyWith(
                          color: HaHoColors.textGray,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  if ((item.specialInstructions ?? '').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '"${item.specialInstructions}"',
                        style: HaHoTextStyles.caption.copyWith(
                          color: HaHoColors.textGray,
                          fontStyle: FontStyle.italic,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  // Row 2: compact qty stepper. Single pill so − N + take
                  // about 88dp instead of the old 100+ with separate icon
                  // buttons. Unit-price reminder sits next to it.
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(
                      children: [
                        _QtyStepper(
                          quantity: item.quantity,
                          enabled: !item.isFired && !locked,
                          onDec: () => pos.adjustQty(lineIndex, -1),
                          onInc: () => pos.adjustQty(lineIndex, 1),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            '@ \$${item.unitPrice.toStringAsFixed(2)}',
                            style: HaHoTextStyles.caption.copyWith(
                              color: HaHoColors.textGray,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.isFired) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 5,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: HaHoColors.success.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(
                                HaHoRadius.sm,
                              ),
                            ),
                            child: Text(
                              'FIRED',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: HaHoColors.success,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact qty stepper. Width ≈ 88dp — much tighter than two icon-buttons
/// with a separate qty text in between.
class _QtyStepper extends StatelessWidget {
  final num quantity;
  final bool enabled;
  final VoidCallback onDec;
  final VoidCallback onInc;
  const _QtyStepper({
    required this.quantity,
    required this.enabled,
    required this.onDec,
    required this.onInc,
  });

  @override
  Widget build(BuildContext context) {
    final fg = enabled ? HaHoColors.textDark : HaHoColors.textGray;
    return Container(
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.pill),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: enabled ? onDec : null,
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
            child: SizedBox(
              width: 28,
              height: 28,
              child: Icon(Icons.remove, size: 14, color: fg),
            ),
          ),
          Container(
            width: 28,
            alignment: Alignment.center,
            child: Text(
              '$quantity',
              style: HaHoTextStyles.bodySmall.copyWith(
                fontWeight: FontWeight.w700,
                color: fg,
              ),
            ),
          ),
          InkWell(
            onTap: enabled ? onInc : null,
            borderRadius: BorderRadius.circular(HaHoRadius.pill),
            child: SizedBox(
              width: 28,
              height: 28,
              child: Icon(Icons.add, size: 14, color: fg),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Bottom action bar (subtotal + buttons) ───────────────────────────────

class _ActionBar extends StatefulWidget {
  const _ActionBar();

  @override
  State<_ActionBar> createState() => _ActionBarState();
}

class _ActionBarState extends State<_ActionBar> {
  bool _printing = false;

  @override
  Widget build(BuildContext context) {
    return Consumer<PosProvider>(
      builder: (context, pos, _) {
        final t = pos.activeTab!;
        final paid = t.amountPaid;
        final total = t.total;
        final remaining = (total - paid);
        final fullyPaid = paid >= total && total > 0;
        final partial = paid > 0 && paid < total;

        return Container(
          padding: EdgeInsets.fromLTRB(
            HaHoSpacing.lg,
            HaHoSpacing.md,
            HaHoSpacing.lg,
            MediaQuery.of(context).padding.bottom + HaHoSpacing.md,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: HaHoColors.border)),
          ),
          child: Column(
            children: [
              // Totals row — Subtotal/Total + Paid + Balance (partial only).
              // Putting balance front-and-centre on partial tabs is what makes
              // "I still owe $X" obvious instead of looking like a fresh tab.
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullyPaid || partial ? 'Total' : 'Subtotal',
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.textGray,
                          ),
                        ),
                        Text(
                          '\$${(fullyPaid || partial ? total : t.subtotal).toStringAsFixed(2)}',
                          style: HaHoTextStyles.h3,
                        ),
                      ],
                    ),
                  ),
                  if (paid > 0)
                    Padding(
                      padding: const EdgeInsets.only(right: HaHoSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Paid',
                            style: HaHoTextStyles.caption.copyWith(
                              color: HaHoColors.success,
                            ),
                          ),
                          Text(
                            '\$${paid.toStringAsFixed(2)}',
                            style: HaHoTextStyles.body.copyWith(
                              color: HaHoColors.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (partial)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Balance',
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.warning,
                          ),
                        ),
                        Text(
                          '\$${remaining.toStringAsFixed(2)}',
                          style: HaHoTextStyles.body.copyWith(
                            color: HaHoColors.warning,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              if (pos.error != null) ...[
                const SizedBox(height: HaHoSpacing.sm),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(HaHoSpacing.sm),
                  decoration: BoxDecoration(
                    color: HaHoColors.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(HaHoRadius.md),
                    border: Border.all(
                      color: HaHoColors.error.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline,
                        color: HaHoColors.error,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          pos.error!,
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.error,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: HaHoSpacing.sm),
              // Tab management (persisted tabs only): move to a table/section,
              // split the check, or print it. Front-desk actions from the audit.
              if (t.isPersisted) ...[
                Row(
                  children: [
                    Expanded(
                      child: _miniAction(
                        Icons.swap_horiz,
                        'Transfer',
                        (pos.busy || t.status == 'completed')
                            ? null
                            : () => _showTransferSheet(context, pos, t),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _miniAction(
                        Icons.call_split,
                        'Split',
                        (pos.busy ||
                                t.amountPaid > 0 ||
                                t.productItems.fold<num>(
                                      0,
                                      (sum, item) => sum + item.quantity,
                                    ) <
                                    2)
                            ? null
                            : () => _showSplitSheet(context, pos, t),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _miniAction(
                        Icons.receipt_long,
                        _printing ? 'Printing…' : 'Print',
                        (pos.busy || _printing || t.productItems.isEmpty)
                            ? null
                            : () => _printCheck(context, pos, t),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: HaHoSpacing.sm),
              ],
              // Action set depends on tab state:
              //   FULLY PAID → Receipt + Refund (no Settle button — the
              //     operator was getting confused, looked like fresh checkout)
              //   PARTIAL    → Save + Fire row, then "Settle $balance" prominent
              //   UNPAID     → Save + Fire + Settle (original flow)
              if (fullyPaid) ...[
                _PaidActions(tab: t),
                if (t.status == 'completed')
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: Text(
                      'Check closed',
                      style: TextStyle(
                        color: Color(0xFF16776B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else if (t.status == 'paid') ...[
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: pos.busy
                        ? null
                        : () async {
                            final closed = await pos.closeActive();
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  closed
                                      ? 'Check closed'
                                      : (pos.error ??
                                            'Could not close this check'),
                                ),
                              ),
                            );
                          },
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: Text(pos.busy ? 'Closing…' : 'Close check'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16776B),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ] else ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.save_outlined, size: 18),
                        label: Text(t.isPersisted ? 'Update' : 'Save'),
                        onPressed: pos.busy
                            ? null
                            : () async {
                                final ok = await pos.saveActive();
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context)
                                    .hideCurrentSnackBar();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      ok
                                          ? (t.isPersisted
                                                ? 'Tab updated'
                                                : 'Tab saved')
                                          : (pos.error ?? 'Save failed'),
                                    ),
                                    backgroundColor: ok
                                        ? HaHoColors.success
                                        : HaHoColors.error,
                                  ),
                                );
                              },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            vertical: HaHoSpacing.md,
                          ),
                        ),
                      ),
                    ),
                    if (context.watch<PosDeviceSettings>().showPrep) ...[
                      const SizedBox(width: HaHoSpacing.md),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          icon: const Icon(
                            Icons.local_fire_department,
                            size: 18,
                          ),
                          label: Text(
                            pos.fireSelection.isEmpty
                                ? 'Send to prep'
                                : 'Send selected (${pos.fireSelection.length})',
                          ),
                          onLongPress: (_hasUnfired(t) && !pos.busy)
                              ? () => _saveThenFire(
                                  context,
                                  pos,
                                  t,
                                  customize: true,
                                )
                              : null,
                          onPressed: (_hasUnfired(t) && !pos.busy)
                              ? () => _saveThenFire(context, pos, t)
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: HaHoColors.warning,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              vertical: HaHoSpacing.md,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: HaHoSpacing.sm),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.payments_outlined, size: 18),
                    label: Text(
                      partial
                          ? 'Checkout balance · \$${remaining.toStringAsFixed(2)}'
                          : 'Checkout',
                    ),
                    onPressed: (t.productItems.isNotEmpty && !pos.busy)
                        ? () => _saveThenSettle(context, pos, t)
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: HaHoColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        vertical: HaHoSpacing.md,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  /// True when the tab has at least one line that hasn't been fired yet.
  /// Used to gate the Send-to-kitchen button.
  bool _hasUnfired(PosOrder t) => t.productItems.any((line) => !line.isFired);

  /// Auto-save the tab (if local) then open the fire sheet. The server
  /// requires a persisted order to fire against — bundling the save here
  /// removes the "click Save first" gotcha.
  Future<void> _saveThenFire(
    BuildContext context,
    PosProvider pos,
    PosOrder t, {
    bool customize = false,
  }) async {
    if (!context.read<PosDeviceSettings>().showPrep) return;
    final selectedBeforeSave = Set<String>.of(pos.fireSelection);
    // Always save first — even on a persisted tab. The save round-trips
    // each newly-added line through /storefront/order/:id/items so the
    // server can stamp a stable id. /fire then matches against THAT id.
    // If we skipped this when the tab was already persisted, freshly-added
    // lines (still on the client with `ln-…` ids) would never get the
    // server id, and fire would 400 with "No matching items found".
    final saved = await pos.saveActive();
    if (!context.mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(pos.error ?? 'Save failed'),
          backgroundColor: HaHoColors.error,
        ),
      );
      return;
    }
    final active = pos.activeTab;
    if (!context.mounted || active == null) return;
    // Reconcile the fire selection — client-side ids (`ln-…`) just got
    // replaced with server-stamped ids during save. Anything still in the
    // selection that doesn't exist on the saved order is stale; drop it.
    // Then if the selection is empty, treat as "fire ALL unfired".
    final validIds = active.productItems.map((l) => l.id).toSet();
    if (selectedBeforeSave.isNotEmpty &&
        !validIds.containsAll(selectedBeforeSave)) {
      pos.clearFireSelection();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Items saved. Select the items to send again; their IDs changed during saving.',
          ),
        ),
      );
      return;
    }
    pos.fireSelection.retainWhere(validIds.contains);
    if (pos.fireSelection.isEmpty) {
      for (final line in active.productItems) {
        if (!line.isFired && line.id.isNotEmpty)
          pos.toggleFireSelection(line.id);
      }
    }
    if (customize) {
      _showFireSheet(context, pos, active);
      return;
    }
    final count = pos.fireSelection.length;
    final ok = await pos.fireSelected();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Sent $count item row${count == 1 ? '' : 's'} to prep'
              : (pos.error ?? 'Send failed'),
        ),
        backgroundColor: ok ? HaHoColors.success : HaHoColors.error,
      ),
    );
  }

  /// Always save before settling — even on an already-persisted tab.
  /// The bug this fixes: operator opens a saved tab, adds more items
  /// locally, taps Settle → server-side order is missing the new items
  /// because `saveActive` was only called for first-time tab creation.
  /// Calling it unconditionally pushes any local additions through the
  /// same path Send-to-kitchen uses.
  Future<void> _saveThenSettle(
    BuildContext context,
    PosProvider pos,
    PosOrder t,
  ) async {
    final saved = await pos.saveActive();
    if (!context.mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(pos.error ?? 'Save failed'),
          backgroundColor: HaHoColors.error,
        ),
      );
      return;
    }
    final active = pos.activeTab;
    if (!context.mounted || active == null) return;
    _showSettleSheet(context, pos, active);
  }

  void _showFireSheet(BuildContext context, PosProvider pos, PosOrder t) {
    pos.loadWorkflowDefs();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _FireSheet(pos: pos, tab: t),
    );
  }

  void _showSettleSheet(BuildContext context, PosProvider pos, PosOrder t) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => CheckoutScreen(order: t)));
  }

  // ─── Tab management: transfer / split / print ──────────────────────────

  Widget _miniAction(IconData icon, String label, VoidCallback? onTap) {
    return OutlinedButton.icon(
      icon: Icon(icon, size: 16),
      label: Text(label, style: const TextStyle(fontSize: 12)),
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  void _showTransferSheet(BuildContext context, PosProvider pos, PosOrder t) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => FutureBuilder<List<ServicePoint>>(
        future: operationsService.findServicePoints(
          businessLocationId: pos.businessLocationId,
        ),
        builder: (ctx, snap) {
          final spots = snap.data ?? const <ServicePoint>[];
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 18,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Move tab to…', style: HaHoTextStyles.h3),
                const SizedBox(height: 12),
                if (snap.connectionState == ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (spots.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      'No tables/service points configured for this location.',
                      style: HaHoTextStyles.bodySmall.copyWith(
                        color: HaHoColors.textGray,
                      ),
                    ),
                  )
                else
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 360),
                    child: SingleChildScrollView(
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: spots
                            .map(
                              (sp) => ActionChip(
                                avatar: Icon(
                                  sp.isAvailable
                                      ? Icons.event_seat_outlined
                                      : Icons.event_seat,
                                  size: 16,
                                  color: sp.isAvailable
                                      ? HaHoColors.success
                                      : HaHoColors.warning,
                                ),
                                label: Text(sp.displayLabel),
                                onPressed: () async {
                                  Navigator.pop(sheetCtx);
                                  try {
                                    await posService.transferTab(
                                      orderId: t.sk,
                                      servicePointId: sp.name,
                                    );
                                    await pos.loadOpenTabs();
                                    if (!context.mounted) return;
                                    _toast(
                                      context,
                                      'Moved to ${sp.displayLabel}',
                                    );
                                  } catch (_) {
                                    if (!context.mounted) return;
                                    _toast(
                                      context,
                                      'Transfer failed',
                                      error: true,
                                    );
                                  }
                                },
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showSplitSheet(BuildContext context, PosProvider pos, PosOrder t) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 18,
          bottom: MediaQuery.of(sheetCtx).padding.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Split check', style: HaHoTextStyles.h3),
            const SizedBox(height: 4),
            Text(
              'Distribute items across separate checks. Totals depend on each check’s items.',
              style: HaHoTextStyles.bodySmall.copyWith(
                color: HaHoColors.textGray,
              ),
            ),
            const SizedBox(height: 16),
            // Separate checks, one per guest: each seat's items move to its
            // own check (server by-item split; each check re-priced and taxed).
            if (_seatGroups(t).length >= 2) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.event_seat_outlined),
                  label: Text('By seat · ${_seatGroups(t).length} checks'),
                  onPressed: () async {
                    Navigator.pop(sheetCtx);
                    await _splitBySeat(context, pos, t);
                  },
                ),
              ),
              const SizedBox(height: 12),
              Text('Or evenly by value', style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray)),
              const SizedBox(height: 8),
            ],
            Wrap(
              spacing: 10,
              children: [2, 3, 4, 5]
                  .where(
                    (n) =>
                        n <=
                        t.productItems.fold<num>(
                          0,
                          (sum, item) => sum + item.quantity,
                        ),
                  )
                  .map(
                    (n) => ChoiceChip(
                      label: Text('$n ways'),
                      selected: false,
                      onSelected: (_) async {
                        Navigator.pop(sheetCtx);
                        try {
                          await posService.splitTab(orderId: t.sk, parts: n);
                          await pos.loadOpenTabs();
                          if (!context.mounted) return;
                          _toast(context, 'Split $n ways');
                        } catch (_) {
                          if (!context.mounted) return;
                          _toast(context, 'Split failed', error: true);
                        }
                      },
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  /// Seat → the line ids on it ('' = shared by the table), seats in order.
  Map<String, List<String>> _seatGroups(PosOrder t) {
    final g = <String, List<String>>{};
    for (final l in t.productItems) {
      if (l.id.isEmpty) continue;
      g.putIfAbsent(l.seat ?? '', () => []).add(l.id);
    }
    final keys = g.keys.toList()
      ..sort((a, b) => (int.tryParse(a) ?? 0).compareTo(int.tryParse(b) ?? 0));
    return {for (final k in keys) k: g[k]!};
  }

  Future<void> _splitBySeat(BuildContext context, PosProvider pos, PosOrder t) async {
    // Unsaved additions would be lost when the tabs reload: save first.
    if (!await pos.saveActive()) {
      if (context.mounted) _toast(context, pos.error ?? 'Could not save the check', error: true);
      return;
    }
    final saved = pos.activeTab ?? t;
    final groups = _seatGroups(saved);
    final base = saved.displayLabel;
    final seats = groups.keys.where((k) => k.isNotEmpty).toList();
    // The first seat (with any shared items) stays on this check; every other seat gets its own.
    final keepSeat = seats.isEmpty ? '' : seats.first;
    try {
      // The check that keeps the first seat is renamed with the first move
      // (unless shared table items stay on it too).
      final keepName = keepSeat.isNotEmpty && !groups.containsKey('') ? '$base · Seat $keepSeat' : null;
      var first = true;
      for (final seat in seats.skip(1)) {
        await posService.splitTab(orderId: saved.sk, itemIds: groups[seat]!, alias: '$base · Seat $seat',
            sourceAlias: first ? keepName : null);
        first = false;
      }
      await pos.loadOpenTabs();
      if (!context.mounted) return;
      _toast(context, 'Split into ${seats.length} checks, one per seat');
    } catch (_) {
      if (!context.mounted) return;
      _toast(context, 'Split failed', error: true);
    }
  }

  Future<void> _printCheck(
    BuildContext context,
    PosProvider pos,
    PosOrder t,
  ) async {
    if (_printing) return;
    setState(() => _printing = true);
    try {
      // Persist edits before rendering the check. Completed checks are read-only.
      if (t.status != 'completed' && t.amountPaid == 0) {
        if (!await pos.saveActive()) {
          throw Exception(
            pos.error ?? 'Could not save the check before printing.',
          );
        }
      }
      final payload = await posService.getCheckPayload(t.sk);
      if (payload == null) {
        throw Exception('Server returned no check payload.');
      }
      // This device owns its paired printer; the server's print-check endpoint
      // instead requires a separately configured venue printer hub.
      await printerService.printServerPayload(payload);
      if (!context.mounted) return;
      _toast(context, 'Check data sent to printer. Check paper output.');
    } catch (e) {
      if (!context.mounted) return;
      _toast(
        context,
        'Print failed: ${e.toString().replaceFirst('Exception: ', '')}',
        error: true,
      );
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  void _toast(BuildContext context, String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? HaHoColors.error : HaHoColors.success,
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: error ? 6 : 3),
      ),
    );
  }
}

// ─── Product options sheet ────────────────────────────────────────────────
// Picks attribute values (size, modifiers, etc.), maps to variation for
// price/sku, captures special instructions, then adds to cart.
class _ProductOptionsSheet extends StatefulWidget {
  final PosProduct product;
  final PosProvider pos;
  const _ProductOptionsSheet({required this.product, required this.pos});

  @override
  State<_ProductOptionsSheet> createState() => _ProductOptionsSheetState();
}

class _ProductOptionsSheetState extends State<_ProductOptionsSheet> {
  /// Picked option per attribute group: { attribute.name → option.value }
  final Map<String, String> _selected = {};
  final TextEditingController _instructions = TextEditingController();
  num _qty = 1;

  @override
  void initState() {
    super.initState();
    // Pre-pick the first option in each group for variations to resolve
    // immediately. Operator can change before confirming.
    for (final attr in widget.product.attributes) {
      if (attr.options.isNotEmpty) {
        _selected[attr.name] = attr.options.first.value;
      }
    }
  }

  @override
  void dispose() {
    _instructions.dispose();
    super.dispose();
  }

  /// Whether every attribute group has a value chosen.
  bool get _isComplete {
    for (final attr in widget.product.attributes) {
      if (_selected[attr.name] == null) return false;
    }
    return true;
  }

  PosProductVariation? get _variation =>
      widget.product.findVariation(_selected);

  num get _unitPrice => _variation?.price ?? widget.product.effectivePrice;
  num get _lineTotal => _unitPrice * _qty;

  void _confirm() {
    if (!_isComplete && widget.product.attributes.isNotEmpty) return;
    if (widget.pos.activeTab == null) widget.pos.newCart();
    final line = widget.product.toLineItem(
      quantity: _qty,
      selectedOptions: Map<String, String>.from(_selected),
      specialInstructions: _instructions.text.trim().isEmpty
          ? null
          : _instructions.text.trim(),
    );
    widget.pos.addLineItem(line);
    Navigator.pop(context, true);
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added ${widget.product.name}'),
        duration: const Duration(milliseconds: 800),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: widget.product.attributes.length <= 2 ? 0.55 : 0.8,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) {
        final p = widget.product;
        return Column(
          children: [
            // Drag handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: HaHoColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Hero — image, name, price
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
              child: Row(
                children: [
                  if (p.imageUrl != null && p.imageUrl!.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(HaHoRadius.md),
                      child: Image.network(
                        p.imageUrl!,
                        width: 64,
                        height: 64,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 64,
                          height: 64,
                          color: HaHoColors.cardLight,
                        ),
                      ),
                    )
                  else
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: HaHoColors.cardLight,
                        borderRadius: BorderRadius.circular(HaHoRadius.md),
                      ),
                      child: const Icon(
                        Icons.shopping_bag_outlined,
                        color: HaHoColors.textGray,
                      ),
                    ),
                  const SizedBox(width: HaHoSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          p.name,
                          style: HaHoTextStyles.h3,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '\$${_unitPrice.toStringAsFixed(2)}',
                          style: HaHoTextStyles.body.copyWith(
                            color: HaHoColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: HaHoSpacing.lg),
            // Scrolling area — option groups + instructions
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
                children: [
                  ...p.attributes.map(
                    (attr) => _AttributeGroup(
                      attribute: attr,
                      selected: _selected[attr.name],
                      // What a choice adds to the price (Add bacon +$2.00): the
                      // variation price with it, against the group's first choice.
                      extraFor: (value) {
                        if (attr.options.isEmpty) return 0;
                        num priceWith(String v) =>
                            p.findVariation({..._selected, attr.name: v})?.price ?? p.effectivePrice;
                        return priceWith(value) - priceWith(attr.options.first.value);
                      },
                      onPick: (value) =>
                          setState(() => _selected[attr.name] = value),
                    ),
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  Text(
                    'Special instructions',
                    style: HaHoTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: HaHoSpacing.xs),
                  TextField(
                    controller: _instructions,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'e.g. no onions, extra crispy',
                      filled: true,
                      fillColor: HaHoColors.cardLight,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(HaHoRadius.md),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: HaHoSpacing.md,
                        vertical: HaHoSpacing.sm,
                      ),
                    ),
                  ),
                  const SizedBox(height: HaHoSpacing.xl),
                ],
              ),
            ),
            // Footer — qty stepper + add button
            Container(
              padding: EdgeInsets.fromLTRB(
                HaHoSpacing.lg,
                HaHoSpacing.md,
                HaHoSpacing.lg,
                MediaQuery.of(context).padding.bottom + HaHoSpacing.md,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: HaHoColors.border)),
              ),
              child: Row(
                children: [
                  // Qty stepper
                  Container(
                    decoration: BoxDecoration(
                      color: HaHoColors.cardLight,
                      borderRadius: BorderRadius.circular(HaHoRadius.pill),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove),
                          onPressed: _qty > 1
                              ? () => setState(() => _qty -= 1)
                              : null,
                        ),
                        SizedBox(
                          width: 28,
                          child: Text(
                            '$_qty',
                            textAlign: TextAlign.center,
                            style: HaHoTextStyles.body.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add),
                          onPressed: () => setState(() => _qty += 1),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: HaHoSpacing.md),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: HaHoColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          vertical: HaHoSpacing.md,
                        ),
                      ),
                      onPressed: _isComplete ? _confirm : null,
                      child: Text('Add — \$${_lineTotal.toStringAsFixed(2)}'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _AttributeGroup extends StatelessWidget {
  final PosProductAttribute attribute;
  final String? selected;
  final ValueChanged<String> onPick;
  final num Function(String value)? extraFor;
  const _AttributeGroup({
    required this.attribute,
    required this.selected,
    required this.onPick,
    this.extraFor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: HaHoSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            attribute.label,
            style: HaHoTextStyles.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: HaHoSpacing.xs),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: attribute.options.map((opt) {
              final isSelected = opt.value == selected;
              return InkWell(
                onTap: () => onPick(opt.value),
                borderRadius: BorderRadius.circular(HaHoRadius.pill),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: HaHoSpacing.lg,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? HaHoColors.primary
                        : HaHoColors.cardLight,
                    borderRadius: BorderRadius.circular(HaHoRadius.pill),
                    border: Border.all(
                      color: isSelected
                          ? HaHoColors.primary
                          : HaHoColors.border,
                      width: 1,
                    ),
                  ),
                  child: Text(
                    '${opt.label.isNotEmpty ? opt.label : opt.value}${(extraFor?.call(opt.value) ?? 0) > 0 ? '  +\$${extraFor!(opt.value).toStringAsFixed(2)}' : ''}',
                    style: HaHoTextStyles.bodySmall.copyWith(
                      color: isSelected ? Colors.white : HaHoColors.textDark,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ─── Fire confirmation sheet ──────────────────────────────────────────────
// Shown after the operator hits "Fire N items" on the cart action bar.
// Optional long-press: choose an explicit workflow override
// and override course / seat / specialInstructions before sending.
class _FireSheet extends StatefulWidget {
  final PosProvider pos;
  final PosOrder tab;
  const _FireSheet({required this.pos, required this.tab});

  @override
  State<_FireSheet> createState() => _FireSheetState();
}

class _FireSheetState extends State<_FireSheet> {
  /// 'auto' = server prep-pipeline, split by station; otherwise the
  /// chosen workflow definition sk overrides for ALL selected lines.
  String _workflowSelection = 'auto';
  String? _course;
  final _seat = TextEditingController();
  final _instructions = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Pre-fill course from the first selected line that has a defaultCourse
    // hint via its product (we don't have that here directly — but the
    // line's options or a saved override could carry it later).
    // Today we leave _course null and the operator picks.
    _seat.text = widget.tab.servicePointId ?? '';
  }

  @override
  void dispose() {
    _seat.dispose();
    _instructions.dispose();
    super.dispose();
  }

  List<PosLineItem> get _selectedLines {
    final ids = widget.pos.fireSelection;
    return widget.tab.productItems.where((l) => ids.contains(l.id)).toList();
  }

  Future<void> _submit() async {
    final ok = await widget.pos.fireSelected(
      workflowId: _workflowSelection == 'auto' ? null : _workflowSelection,
      course: _course,
      seat: _seat.text.trim().isEmpty ? null : _seat.text.trim(),
      specialInstructions: _instructions.text.trim().isEmpty
          ? null
          : _instructions.text.trim(),
    );
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Fired')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosProvider>();
    final selectedLines = _selectedLines;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Column(
        children: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: HaHoColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
            child: Row(
              children: [
                const Icon(
                  Icons.local_fire_department,
                  color: HaHoColors.warning,
                ),
                const SizedBox(width: HaHoSpacing.sm),
                Text(
                  'Fire ${selectedLines.length} item${selectedLines.length == 1 ? '' : 's'}',
                  style: HaHoTextStyles.h3,
                ),
              ],
            ),
          ),
          const SizedBox(height: HaHoSpacing.md),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
              children: [
                // Workflow selection
                Text(
                  'Workflow',
                  style: HaHoTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: HaHoSpacing.xs),
                RadioListTile<String>(
                  value: 'auto',
                  groupValue: _workflowSelection,
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: const Text('Route to prep stations'),
                  subtitle: const Text(
                    'Send items to their configured prep stations.',
                  ),
                  onChanged: (v) =>
                      setState(() => _workflowSelection = v ?? 'auto'),
                ),
                if (pos.workflowDefs.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: HaHoSpacing.sm,
                    ),
                    child: Text(
                      'Loading workflows…',
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.textGray,
                      ),
                    ),
                  ),
                ...pos.workflowDefs.map((def) {
                  final data = def['data'] is Map ? def['data'] as Map : def;
                  final sk = (def['sk'] ?? data['sk'] ?? '').toString();
                  final title = (data['title'] ?? data['name'] ?? sk)
                      .toString();
                  return RadioListTile<String>(
                    value: sk,
                    groupValue: _workflowSelection,
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(title),
                    subtitle: Text(
                      (data['name'] ?? '').toString(),
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.textGray,
                      ),
                    ),
                    onChanged: (v) =>
                        setState(() => _workflowSelection = v ?? 'auto'),
                  );
                }),
                const SizedBox(height: HaHoSpacing.md),
                // Course
                Text(
                  'Course (optional)',
                  style: HaHoTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: HaHoSpacing.xs),
                Wrap(
                  spacing: 8,
                  children: ['appetizer', 'main', 'dessert', 'drinks', 'side']
                      .map(
                        (c) => ChoiceChip(
                          label: Text(c),
                          selected: _course == c,
                          onSelected: (sel) =>
                              setState(() => _course = sel ? c : null),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: HaHoSpacing.md),
                // Seat / table
                TextField(
                  controller: _seat,
                  decoration: const InputDecoration(
                    labelText: 'Seat / table (optional)',
                    hintText: 'e.g. T7, Bar-2, Seat 3',
                  ),
                ),
                const SizedBox(height: HaHoSpacing.sm),
                TextField(
                  controller: _instructions,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Batch instructions (optional)',
                    hintText: 'Goes on the ticket alongside item-level notes',
                  ),
                ),
                const SizedBox(height: HaHoSpacing.lg),
                if (pos.error != null)
                  Container(
                    padding: const EdgeInsets.all(HaHoSpacing.sm),
                    decoration: BoxDecoration(
                      color: HaHoColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(HaHoRadius.md),
                    ),
                    child: Text(
                      pos.error!,
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              HaHoSpacing.lg,
              HaHoSpacing.md,
              HaHoSpacing.lg,
              MediaQuery.of(context).padding.bottom + HaHoSpacing.md,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: HaHoColors.border)),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: pos.busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.local_fire_department, size: 18),
                label: Text(pos.busy ? 'Firing…' : 'Send'),
                onPressed: pos.busy ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: HaHoColors.warning,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Tab state header ─────────────────────────────────────────────────────
//
// Sits above the items list when the tab is persisted. Makes the operator's
// mental model immediate ("this is a paid tab I'm reviewing" vs "this is an
// open cart") and shows the order number so the receipt they're about to
// reprint has a known identity.

class _TabStateHeader extends StatelessWidget {
  final PosOrder tab;
  const _TabStateHeader({required this.tab});

  @override
  Widget build(BuildContext context) {
    final paid = tab.amountPaid;
    final total = tab.total;
    final fullyPaid = paid >= total && total > 0;
    final partial = paid > 0 && paid < total;

    Color tone;
    String label;
    IconData icon;
    if (fullyPaid) {
      tone = HaHoColors.success;
      label = tab.amountRefunded > 0
          ? 'PAID · \$${tab.amountRefunded.toStringAsFixed(2)} refunded'
          : 'PAID';
      icon = Icons.check_circle;
    } else if (partial) {
      tone = HaHoColors.warning;
      label = 'PARTIAL · \$${(total - paid).toStringAsFixed(2)} due';
      icon = Icons.schedule;
    } else {
      tone = HaHoColors.textGray;
      label = 'OPEN';
      icon = Icons.shopping_cart_outlined;
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(
        HaHoSpacing.md,
        HaHoSpacing.sm,
        HaHoSpacing.md,
        0,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: HaHoSpacing.md,
        vertical: HaHoSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        border: Border.all(color: tone.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, color: tone, size: 18),
          const SizedBox(width: HaHoSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: HaHoTextStyles.caption.copyWith(
                    color: tone,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                if (tab.number != null && tab.number!.isNotEmpty)
                  Text(
                    // "Table 4 · Order #HQCBKW383": whose check it is first.
                    [
                      if ((tab.tabLabel ?? tab.alias ?? '').trim().isNotEmpty)
                        tab.displayLabel,
                      'Order #${tab.number}',
                    ].join(' · '),
                    style: HaHoTextStyles.bodySmall.copyWith(
                      color: HaHoColors.textDark,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          Text(
            '\$${total.toStringAsFixed(2)}',
            style: HaHoTextStyles.body.copyWith(
              color: HaHoColors.textDark,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Payments section ─────────────────────────────────────────────────────
//
// Renders below the items list when the tab has at least one payment.
// Each row shows method, last4/ref, amount, and a "Refund" affordance.
// Refunded payments are dimmed and the line shows the refund amount.

class _PaymentsSection extends StatelessWidget {
  final PosOrder tab;
  const _PaymentsSection({required this.tab});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: HaHoSpacing.sm),
          child: Text(
            'PAYMENTS',
            style: HaHoTextStyles.caption.copyWith(
              fontWeight: FontWeight.w700,
              color: HaHoColors.textGray,
              letterSpacing: 1.2,
            ),
          ),
        ),
        for (int i = 0; i < tab.payments.length; i++)
          _PaymentRow(payment: tab.payments[i], tab: tab),
      ],
    );
  }
}

class _PaymentRow extends StatelessWidget {
  final Map<String, dynamic> payment;
  final PosOrder tab;
  const _PaymentRow({required this.payment, required this.tab});

  @override
  Widget build(BuildContext context) {
    final amount = (payment['amount'] as num?) ?? 0;
    final method = (payment['method'] ?? 'payment').toString();
    final last4 = (payment['last4'] ?? payment['cardLast4'] ?? '').toString();
    final isRefund = payment['isRefund'] == true || amount < 0;
    // A refund's ref is the server's own record key: not for the guest or staff.
    final ref = isRefund ? '' : (payment['ref'] ?? '').toString();
    final refunded = payment['refunded'] == true || amount < 0;
    // The name this register uses for the method (e.g. Other → "Venmo").
    final methodName = context.watch<PosDeviceSettings>().displayName(method.toLowerCase());
    final refundedAmount = (payment['refundedAmount'] as num?) ?? 0;

    final tone = isRefund
        ? HaHoColors.error
        : refunded
        ? HaHoColors.textGray
        : HaHoColors.textDark;

    return Container(
      margin: const EdgeInsets.only(bottom: HaHoSpacing.sm),
      padding: const EdgeInsets.all(HaHoSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Row(
        children: [
          Icon(_iconFor(method), size: 18, color: tone),
          const SizedBox(width: HaHoSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isRefund ? 'Refund · $methodName' : methodName,
                  style: HaHoTextStyles.bodySmall.copyWith(
                    fontWeight: FontWeight.w700,
                    color: tone,
                  ),
                ),
                if (last4.isNotEmpty || ref.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      [
                        if (last4.isNotEmpty) '•••• $last4',
                        if (ref.isNotEmpty) ref,
                      ].join(' · '),
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.textGray,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                if (refunded && !isRefund && refundedAmount > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'Refunded \$${refundedAmount.toStringAsFixed(2)}',
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amount < 0 ? '−\$${(-amount).toStringAsFixed(2)}' : '\$${amount.toStringAsFixed(2)}',
                style: HaHoTextStyles.body.copyWith(
                  fontWeight: FontWeight.w700,
                  color: tone,
                  decoration: refunded && !isRefund
                      ? TextDecoration.lineThrough
                      : null,
                ),
              ),
              if (!isRefund && !refunded)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: TextButton(
                    onPressed: () => _showRefundDialog(context, payment),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      minimumSize: const Size(0, 24),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      'Refund',
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.error,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _iconFor(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
        return Icons.payments_outlined;
      case 'card':
      case 'tap-to-pay':
      case 'taptopay':
      case 'm2':
        return Icons.credit_card;
      case 'bank':
      case 'transfer':
        return Icons.account_balance_outlined;
      default:
        return Icons.receipt_outlined;
    }
  }

  void _showRefundDialog(BuildContext context, Map<String, dynamic> payment) {
    showDialog(
      context: context,
      builder: (dialogCtx) => _RefundDialog(payment: payment),
    );
  }
}

// ─── Refund dialog ────────────────────────────────────────────────────────
//
// Lets the operator pick full vs partial refund + add a reason. Server
// records a negative sf_transaction and decrements amountPaid.

class _RefundDialog extends StatefulWidget {
  final Map<String, dynamic> payment;
  const _RefundDialog({required this.payment});

  @override
  State<_RefundDialog> createState() => _RefundDialogState();
}

class _RefundDialogState extends State<_RefundDialog> {
  late final TextEditingController _amountCtrl;
  final _reasonCtrl = TextEditingController();
  bool _partial = false;
  bool _busy = false;
  bool _cashBack = false;
  /// Lines the guest brought back (partial refund by item).
  final Set<String> _returned = {};
  /// One id per refund: a retry after a dropped connection finishes the same
  /// refund on the server instead of recording a second one.
  final String _operationKey =
      'pos-refund-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';

  @override
  void initState() {
    super.initState();
    final amount = (widget.payment['amount'] as num?) ?? 0;
    _amountCtrl = TextEditingController(text: amount.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  /// What the returned lines cost the guest: each line with its share of the
  /// sale's tax (the tab's own subtotal and tax), never more than this payment.
  num _returnedValue(PosOrder? tab, num original) {
    if (tab == null) return 0;
    final sub = tab.subtotal > 0 ? tab.subtotal : tab.localSubtotal;
    final taxShare = sub > 0 ? tab.tax / sub : 0;
    num v = 0;
    for (final l in tab.productItems) {
      if (_returned.contains(l.id)) v += (l.amount - l.discount) * (1 + taxShare);
    }
    v = (v * 100).roundToDouble() / 100;
    return v > original ? original : v;
  }

  @override
  Widget build(BuildContext context) {
    final original = (widget.payment['amount'] as num?) ?? 0;
    final rawMethod = (widget.payment['method'] ?? 'payment').toString();
    final method = rawMethod.isEmpty ? 'payment' : rawMethod[0].toUpperCase() + rawMethod.substring(1).toLowerCase();
    final isCash = rawMethod.toLowerCase() == 'cash';
    final transactionId = (widget.payment['transactionId'] ?? '').toString();
    final ref = (widget.payment['ref'] ?? '').toString();
    final tab = context.read<PosProvider>().activeTab;
    final lines = (tab?.productItems ?? const <PosLineItem>[]).where((l) => l.id.isNotEmpty).toList();
    final byItem = _partial && lines.isNotEmpty;
    final amount = byItem ? _returnedValue(tab, original) : (double.tryParse(_amountCtrl.text.trim()) ?? 0);
    final ready = !_busy && amount > 0 && (!isCash || _cashBack);

    return AlertDialog(
      title: Text('Refund · $method'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Original payment: \$${original.toStringAsFixed(2)}',
              style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.textGray),
            ),
            const SizedBox(height: HaHoSpacing.md),
            Wrap(
              spacing: HaHoSpacing.sm,
              children: [
                ChoiceChip(
                  label: const Text('Full'),
                  showCheckmark: false,
                  selected: !_partial,
                  onSelected: (_) => setState(() {
                    _partial = false;
                    _amountCtrl.text = original.toStringAsFixed(2);
                  }),
                ),
                ChoiceChip(
                  label: Text(lines.isNotEmpty ? 'Returned items' : 'Partial'),
                  showCheckmark: false,
                  selected: _partial,
                  onSelected: (_) => setState(() => _partial = true),
                ),
              ],
            ),
            const SizedBox(height: HaHoSpacing.md),
            if (byItem) ...[
              for (final l in lines)
                CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _returned.contains(l.id),
                  onChanged: (v) => setState(() => v == true ? _returned.add(l.id) : _returned.remove(l.id)),
                  title: Text(l.quantity == 1 ? l.name : '${l.quantity}× ${l.name}'),
                  secondary: Text('\$${(l.amount - l.discount).toStringAsFixed(2)}'),
                ),
              const SizedBox(height: HaHoSpacing.sm),
              Text(
                'Refund with tax: \$${amount.toStringAsFixed(2)}',
                style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w700),
              ),
            ] else
              TextField(
                controller: _amountCtrl,
                enabled: _partial,
                onChanged: (_) => setState(() {}),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount',
                  prefixText: '\$ ',
                  border: OutlineInputBorder(),
                ),
              ),
            const SizedBox(height: HaHoSpacing.md),
            TextField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            if (isCash)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: _cashBack,
                onChanged: (v) => setState(() => _cashBack = v == true),
                title: Text('Cash handed back: \$${amount.toStringAsFixed(2)}'),
                subtitle: const Text('Give the guest the cash first; the refund is recorded once it is back in their hand.'),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: HaHoColors.error,
            foregroundColor: Colors.white,
          ),
          onPressed: !ready
              ? null
              : () async {
                  if (amount > original + 0.005) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Cannot refund more than \$${original.toStringAsFixed(2)}.')),
                    );
                    return;
                  }
                  setState(() => _busy = true);
                  final pos = context.read<PosProvider>();
                  final full = !_partial || (amount - original).abs() < 0.005;
                  final names = byItem
                      ? lines.where((l) => _returned.contains(l.id)).map((l) => l.name).join(', ')
                      : '';
                  final reason = [
                    if (names.isNotEmpty) 'Returned: $names',
                    if (_reasonCtrl.text.trim().isNotEmpty) _reasonCtrl.text.trim(),
                  ].join(' · ');
                  final ok = await pos.refundPayment(
                    transactionId: transactionId.isNotEmpty ? transactionId : null,
                    ref: ref.isNotEmpty ? ref : null,
                    amount: full ? null : amount,
                    reason: reason.isEmpty ? null : reason,
                    cashReturned: isCash ? true : null,
                    operationKey: _operationKey,
                  );
                  if (!context.mounted) return;
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        ok
                            ? 'Refunded \$${(full ? original : amount).toStringAsFixed(2)}'
                            : (pos.error ?? 'Refund failed'),
                      ),
                      backgroundColor: ok ? HaHoColors.success : HaHoColors.error,
                    ),
                  );
                },
          child: Text(
            _busy
                ? 'Refunding…'
                : 'Refund \$${amount.toStringAsFixed(2)}',
          ),
        ),
      ],
    );
  }
}

// ─── Fully-paid action row ────────────────────────────────────────────────
//
// Replaces the Save/Fire/Settle row when the tab is fully paid. Settle is
// hidden (it confused operators into thinking they had to charge again);
// instead: reprint, email, or SMS the receipt. Refund happens per-payment
// from the payments list above — not here, since a refund needs to know
// WHICH tender to reverse.

class _PaidActions extends StatelessWidget {
  final PosOrder tab;
  const _PaidActions({required this.tab});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.print_outlined, size: 18),
            label: const Text('Print'),
            onPressed: () => _print(context),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
            ),
          ),
        ),
        const SizedBox(width: HaHoSpacing.sm),
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.email_outlined, size: 18),
            label: const Text('Email'),
            onPressed: () => _showSendSheet(context, 'email'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
            ),
          ),
        ),
        const SizedBox(width: HaHoSpacing.sm),
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.sms_outlined, size: 18),
            label: const Text('SMS'),
            onPressed: () => _showSendSheet(context, 'sms'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _print(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final payload = await posService.getReceiptPayload(
        tab.sk,
        copy: 'customer',
      );
      if (payload == null) {
        throw Exception('Server returned no receipt payload.');
      }
      await printerService.printServerPayload(payload);
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Receipt data sent to printer. Check paper output.'),
          backgroundColor: HaHoColors.success,
        ),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Print failed: ${e.toString().replaceFirst('Exception: ', '')}',
          ),
          backgroundColor: HaHoColors.error,
        ),
      );
    }
  }

  void _showSendSheet(BuildContext context, String mode) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(HaHoRadius.xl),
        ),
      ),
      builder: (_) => _SendReceiptSheet(tab: tab, mode: mode),
    );
  }
}

class _SendReceiptSheet extends StatefulWidget {
  final PosOrder tab;
  final String mode; // 'email' | 'sms'
  const _SendReceiptSheet({required this.tab, required this.mode});

  @override
  State<_SendReceiptSheet> createState() => _SendReceiptSheetState();
}

class _SendReceiptSheetState extends State<_SendReceiptSheet> {
  late final TextEditingController _ctrl;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: widget.mode == 'email'
          ? (widget.tab.email ?? '')
          : (widget.tab.phone ?? ''),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEmail = widget.mode == 'email';
    return Padding(
      padding: EdgeInsets.fromLTRB(
        HaHoSpacing.lg,
        HaHoSpacing.md,
        HaHoSpacing.lg,
        MediaQuery.of(context).viewInsets.bottom + HaHoSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: HaHoColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Text(
            isEmail ? 'Email receipt' : 'Text receipt',
            style: HaHoTextStyles.h3,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: HaHoSpacing.md),
          TextField(
            controller: _ctrl,
            autofocus: true,
            keyboardType: isEmail
                ? TextInputType.emailAddress
                : TextInputType.phone,
            decoration: InputDecoration(
              labelText: isEmail ? 'Email address' : 'Phone number',
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: HaHoSpacing.lg),
          ElevatedButton.icon(
            icon: Icon(isEmail ? Icons.email_outlined : Icons.sms_outlined),
            label: Text(_busy ? 'Sending…' : 'Send'),
            style: ElevatedButton.styleFrom(
              backgroundColor: HaHoColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
            ),
            onPressed: _busy
                ? null
                : () async {
                    final contact = _ctrl.text.trim();
                    if (contact.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            isEmail
                                ? 'Enter an email address.'
                                : 'Enter a phone number.',
                          ),
                        ),
                      );
                      return;
                    }
                    setState(() => _busy = true);
                    final messenger = ScaffoldMessenger.of(context);
                    final navigator = Navigator.of(context);
                    try {
                      final result = await posService.sendReceipt(
                        widget.tab.sk,
                        mode: widget.mode,
                        to: contact,
                      );
                      if (!mounted) return;
                      navigator.pop();
                      final sent = result['sent'];
                      if (sent is num && sent > 0) {
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text('Receipt sent to $contact'),
                            backgroundColor: HaHoColors.success,
                          ),
                        );
                      } else {
                        messenger.showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Server accepted the request but didn\'t dispatch — check template / integration in admin.',
                            ),
                            backgroundColor: HaHoColors.warning,
                          ),
                        );
                      }
                    } catch (e) {
                      if (!mounted) return;
                      setState(() => _busy = false);
                      messenger.showSnackBar(
                        SnackBar(
                          content: Text(
                            'Send failed: ${e.toString().replaceFirst('Exception: ', '')}',
                          ),
                          backgroundColor: HaHoColors.error,
                        ),
                      );
                    }
                  },
          ),
        ],
      ),
    );
  }
}
