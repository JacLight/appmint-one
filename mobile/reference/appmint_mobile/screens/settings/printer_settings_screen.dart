import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/thermal/thermal_printer.dart' as ftp;
import '../../services/thermal/thermal_printer.dart' as fp;
import '../../config/haho_theme.dart';
import '../../services/printer_service.dart';
import '../../services/pos_service.dart';
import '../../models/pos_order_model.dart';
import '../../services/thermal/classic_printer.dart';
import '../../utils/bluetooth_permissions.dart';

/// Printer pairing + test screen. Persists the selected printer per device
/// so the next print "just works" without re-picking.
class PrinterSettingsScreen extends StatefulWidget {
  const PrinterSettingsScreen({super.key});

  @override
  State<PrinterSettingsScreen> createState() => _PrinterSettingsScreenState();
}

class _PrinterSettingsScreenState extends State<PrinterSettingsScreen> {
  List<fp.Printer> _devices = const [];

  /// The BLE sweep returns every device in range, most of which advertise no
  /// name and are not printers at all. Those are kept behind a toggle rather
  /// than dropped — a printer that does not advertise a name is rare but real,
  /// and hiding it outright would leave no way to pair it.
  bool _showUnnamed = false;
  bool _classic = ClassicPrinter.supported;
  bool _scanning = false;
  bool _connecting = false;
  bool _printing = false;
  String? _error;
  bool _bleOn = true;
  int _paperMm = 80;
  StreamSubscription<List<fp.Printer>>? _devicesSub;
  StreamSubscription<bool>? _bleSub;

  @override
  void initState() {
    super.initState();
    // Try silent reconnect to the saved default so the operator sees
    // "Connected" status instead of forcing them to re-pair every time.
    printerService.connectionRevision.addListener(_connectionChanged);
    _restorePrinter();

    _devicesSub = printerService.devicesStream.listen((list) {
      if (mounted && !_classic) setState(() => _devices = list);
    });
    _bleSub = ftp.FlutterThermalPrinter.instance.isBleTurnedOnStream.listen((
      on,
    ) {
      if (mounted) setState(() => _bleOn = on);
    });
  }

  Future<void> _restorePrinter() async {
    _connecting = true;
    try {
      final ok = await printerService.reconnectDefault();
      if (mounted) {
        setState(() => _error = ok ? null : printerService.lastConnectError);
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Printer reconnect failed: $e');
    } finally {
      if (mounted) {
        setState(() {
          _connecting = false;
          _paperMm = printerService.paperMm;
        });
      }
    }
  }

  void _connectionChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    printerService.connectionRevision.removeListener(_connectionChanged);
    _devicesSub?.cancel();
    _bleSub?.cancel();
    printerService.stopScan();
    if (ClassicPrinter.supported) ClassicPrinter.stopScan();
    super.dispose();
  }

  Future<void> _scan() async {
    setState(() {
      _scanning = true;
      _devices = const [];
    });
    try {
      final permissionError = await ensureBluetoothPermissions();
      if (permissionError != null) throw StateError(permissionError);
      if (_classic) {
        final devices = await ClassicPrinter.scan();
        if (mounted) setState(() => _devices = devices);
      } else {
        await printerService.startScan();
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Scan failed: $e');
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  Future<void> _connect(fp.Printer p) async {
    if (_connecting) return;
    setState(() {
      _connecting = true;
      _error = null;
    });
    final ok = await printerService.connect(
      p,
      paperMm: _paperMm,
      classic: _classic,
    );
    if (!mounted) return;
    setState(() {
      _connecting = false;
      _error = ok
          ? null
          : printerService.lastConnectError ?? 'Printer pairing failed.';
    });
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Bluetooth connected. Send a test print to check paper output.',
          ),
        ),
      );
    }
  }

  Future<void> _testPrint() async {
    if (_printing) return;
    setState(() {
      _printing = true;
      _error = null;
    });
    try {
      await printerService.printReceipt([
        const ReceiptHeader(name: 'Test Receipt', subtitle: 'Appmint Mobile'),
        ReceiptLine('Printed: ${DateTime.now()}', centered: true),
        const ReceiptDivider(),
        const ReceiptItem(quantity: 2, name: 'Coffee', lineTotal: 8.00),
        const ReceiptItem(
          quantity: 1,
          name: 'Croissant',
          lineTotal: 4.50,
          options: ['Warmed', 'No nuts'],
          specialInstructions: 'Extra napkins',
        ),
        const ReceiptDivider(),
        const ReceiptKv('Subtotal', '12.50'),
        const ReceiptKv('Tax', '1.00'),
        const ReceiptKv('Total', '13.50', bold: true),
        const ReceiptFeed(2),
        const ReceiptLine('Thank you!', centered: true, bold: true),
      ], paperMm: _paperMm);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Receipt data sent. Check the paper output.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Print failed: $e');
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  Future<void> _printProductCode() async {
    if (_printing || _connecting) return;
    setState(() {
      _printing = true;
      _error = null;
    });
    try {
      final products = await posService.getProducts(pageSize: 100);
      if (!mounted) return;
      if (products.isEmpty) {
        setState(
          () => _error =
              'No products available. Add a product before printing its code.',
        );
        return;
      }
      final product = await showModalBottomSheet<PosProduct>(
        context: context,
        showDragHandle: true,
        builder: (sheetContext) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Print product code',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
                ),
              ),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: products.length,
                  itemBuilder: (_, index) {
                    final item = products[index];
                    return ListTile(
                      leading: const Icon(Icons.qr_code),
                      title: Text(item.name),
                      subtitle: Text(
                        item.sku.isEmpty ? 'Product QR code' : item.sku,
                      ),
                      onTap: () => Navigator.pop(sheetContext, item),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
      if (product == null || !mounted) return;
      final code = product.sku.trim().isNotEmpty
          ? product.sku.trim()
          : 'appmint://sf_product/${product.sk}';
      final canPrintBars =
          code.length <= (_paperMm == 58 ? 12 : 20) &&
          RegExp(r'^[ -~]+$').hasMatch(code);
      await printerService.printReceipt([
        ReceiptHeader(name: product.name),
        const ReceiptLine('Scan to add this item in POS', centered: true),
        const ReceiptFeed(),
        if (canPrintBars) ...[
          ReceiptBarcode(code, type: 'CODE128'),
          const ReceiptFeed(2),
        ],
        ReceiptBarcode(code),
        const ReceiptFeed(),
        ReceiptLine(code, centered: true),
      ], paperMm: _paperMm);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Code sent for ${product.name}. Check the printed label.',
          ),
        ),
      );
    } catch (e) {
      if (mounted) setState(() => _error = 'Product label failed: $e');
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  Future<void> _testDrawer() async {
    try {
      await printerService.openDrawer();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Drawer kicked')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Drawer failed: $e'),
          backgroundColor: HaHoColors.error,
        ),
      );
    }
  }

  /// A device's own name, or nothing. A MAC address is not a name — it went in
  /// the subtitle already, and repeating it as the title is what turned this
  /// screen into a wall of codes.
  static String _nameOf(fp.Printer d) => (d.name ?? '').trim();

  static String _printerName(fp.Printer d) {
    final n = _nameOf(d);
    return n.isEmpty ? 'Unnamed device' : n;
  }

  /// Named devices first, deduplicated by address; the nameless ones only when
  /// asked for.
  List<fp.Printer> get _visibleDevices {
    final seen = <String>{};
    final seenNames = <String>{};
    final named = <fp.Printer>[];
    final unnamed = <fp.Printer>[];
    for (final d in _devices) {
      final key = (d.address ?? '').trim();
      if (key.isNotEmpty && !seen.add(key)) continue;
      final name = _nameOf(d);
      if (name.isEmpty) {
        unnamed.add(d);
        continue;
      }
      // BLE devices rotate their advertising address for privacy, so one
      // speaker turns up repeatedly under different MACs. Address alone cannot
      // catch that; the name can.
      if (!_classic && !seenNames.add(name.toLowerCase())) continue;
      named.add(d);
    }
    named.sort(
      (a, b) => _nameOf(a).toLowerCase().compareTo(_nameOf(b).toLowerCase()),
    );
    return _showUnnamed ? [...named, ...unnamed] : named;
  }

  int get _unnamedCount {
    final seen = <String>{};
    var n = 0;
    for (final d in _devices) {
      final key = (d.address ?? '').trim();
      if (key.isNotEmpty && !seen.add(key)) continue;
      if (_nameOf(d).isEmpty) n++;
    }
    return n;
  }

  ButtonStyle get _selectorStyle => ButtonStyle(
    backgroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.selected)
          ? const Color(0xFF16776B)
          : Colors.white,
    ),
    foregroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.selected)
          ? Colors.white
          : const Color(0xFF192C36),
    ),
    side: const WidgetStatePropertyAll(BorderSide(color: Color(0xFFDFE6E5))),
  );

  @override
  Widget build(BuildContext context) {
    final connected = printerService.connected;
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        backgroundColor: HaHoColors.background,
        elevation: 0,
        title: const Text('Printer'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(HaHoSpacing.lg),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                _error!,
                style: const TextStyle(color: HaHoColors.error),
              ),
            ),
          if (_connecting)
            const Padding(
              padding: EdgeInsets.only(bottom: 16),
              child: Column(
                children: [
                  LinearProgressIndicator(),
                  SizedBox(height: 8),
                  Text(
                    'Connecting… complete the Android pairing prompt if shown.',
                  ),
                ],
              ),
            ),
          if (!_bleOn)
            Container(
              padding: const EdgeInsets.all(HaHoSpacing.md),
              margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
              decoration: BoxDecoration(
                color: HaHoColors.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(HaHoRadius.md),
                border: Border.all(color: HaHoColors.warning),
              ),
              child: Row(
                children: const [
                  Icon(Icons.bluetooth_disabled, color: HaHoColors.warning),
                  SizedBox(width: HaHoSpacing.sm),
                  Expanded(
                    child: Text(
                      'Bluetooth is off. Turn it on to discover Bluetooth printers.',
                    ),
                  ),
                ],
              ),
            ),
          // Currently connected
          Container(
            padding: const EdgeInsets.all(HaHoSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(HaHoRadius.lg),
              border: Border.all(color: HaHoColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Default printer',
                  style: HaHoTextStyles.bodySmall.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
                const SizedBox(height: 6),
                if (connected != null) ...[
                  Row(
                    children: [
                      const Icon(Icons.print, color: HaHoColors.success),
                      const SizedBox(width: HaHoSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              connected.name ?? '(unnamed)',
                              style: HaHoTextStyles.body.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${connected.address ?? ''} · ${printerService.transportLabel} connected',
                              style: HaHoTextStyles.caption.copyWith(
                                color: HaHoColors.textGray,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () async {
                          await printerService.forgetDefault();
                          if (mounted) setState(() {});
                        },
                        child: const Text('Forget'),
                      ),
                    ],
                  ),
                  const SizedBox(height: HaHoSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _printing || _connecting
                              ? null
                              : _testPrint,
                          icon: const Icon(Icons.receipt_long, size: 18),
                          label: Text(_printing ? 'Sending…' : 'Test print'),
                        ),
                      ),
                      const SizedBox(width: HaHoSpacing.sm),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _testDrawer,
                          icon: const Icon(Icons.payments_outlined, size: 18),
                          label: const Text('Kick drawer'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: HaHoSpacing.sm),
                  OutlinedButton.icon(
                    onPressed: _printing || _connecting
                        ? null
                        : _printProductCode,
                    icon: const Icon(Icons.qr_code, size: 18),
                    label: const Text('Print product code'),
                  ),
                ] else
                  Text(
                    'Printer disconnected.',
                    style: HaHoTextStyles.body.copyWith(
                      color: HaHoColors.textGray,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: HaHoSpacing.md),
          // Paper size selector
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: HaHoSpacing.md,
              vertical: HaHoSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(HaHoRadius.lg),
              border: Border.all(color: HaHoColors.border),
            ),
            child: Row(
              children: [
                Text('Paper width', style: HaHoTextStyles.body),
                const Spacer(),
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(value: 58, label: Text('58 mm')),
                    ButtonSegment(value: 80, label: Text('80 mm')),
                  ],
                  style: _selectorStyle,
                  selected: {_paperMm},
                  onSelectionChanged: (s) => setState(() => _paperMm = s.first),
                ),
              ],
            ),
          ),
          const SizedBox(height: HaHoSpacing.md),
          if (ClassicPrinter.supported) ...[
            SegmentedButton<bool>(
              style: _selectorStyle,
              segments: const [
                ButtonSegment(value: true, label: Text('Bluetooth (PIN)')),
                ButtonSegment(value: false, label: Text('BLE / USB')),
              ],
              selected: {_classic},
              onSelectionChanged: _connecting || _scanning
                  ? null
                  : (selection) {
                      setState(() {
                        _classic = selection.first;
                        _devices = [];
                        _error = null;
                      });
                      _scan();
                    },
            ),
            const SizedBox(height: HaHoSpacing.md),
          ],
          // Discovered devices
          Row(
            children: [
              // Honest heading: a BLE scan cannot tell a printer from a
              // speaker, so claiming these are all printers is a lie the
              // operator has to unpick themselves.
              Text(
                'Nearby devices',
                style: HaHoTextStyles.body.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: _scanning || _connecting ? null : _scan,
                icon: _scanning
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 18),
                label: Text(_scanning ? 'Scanning…' : 'Scan'),
              ),
            ],
          ),
          const SizedBox(height: HaHoSpacing.xs),
          Text(
            _classic
                ? 'Select your printer. Enter its PIN when Android asks.'
                : 'Choose your printer by name, usually its model number.',
            style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
          ),
          const SizedBox(height: HaHoSpacing.sm),
          if (_unnamedCount > 0) ...[
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _showUnnamed = !_showUnnamed),
                icon: Icon(
                  _showUnnamed
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 16,
                ),
                label: Text(
                  _showUnnamed
                      ? 'Hide $_unnamedCount unnamed device${_unnamedCount == 1 ? '' : 's'}'
                      : 'Show $_unnamedCount unnamed device${_unnamedCount == 1 ? '' : 's'}',
                ),
              ),
            ),
            const SizedBox(height: HaHoSpacing.xs),
          ],
          if (_visibleDevices.isEmpty)
            Container(
              padding: const EdgeInsets.all(HaHoSpacing.lg),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(HaHoRadius.lg),
                border: Border.all(color: HaHoColors.border),
              ),
              child: Text(
                _scanning
                    ? 'Looking for printers…'
                    : _unnamedCount > 0
                    ? 'Nothing nearby is advertising a printer name. '
                          '$_unnamedCount unnamed device${_unnamedCount == 1 ? ' is' : 's are'} in range — '
                          'show them above if your printer is one of them.'
                    : 'No printers found. Tap Scan.',
                textAlign: TextAlign.center,
                style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
              ),
            )
          else
            ..._visibleDevices.map(
              (d) => Card(
                margin: const EdgeInsets.only(bottom: 6),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(HaHoRadius.lg),
                  side: const BorderSide(color: HaHoColors.border),
                ),
                child: ListTile(
                  leading: const Icon(Icons.print_outlined),
                  title: Text(_printerName(d)),
                  subtitle: Text(
                    '${d.address ?? ''} · ${_classic ? 'Bluetooth Classic' : d.connectionType?.name ?? ''}',
                  ),
                  trailing: ElevatedButton(
                    onPressed: _connecting || connected?.address == d.address
                        ? null
                        : () => _connect(d),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: HaHoColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: Text(
                      connected?.address == d.address ? 'Connected' : 'Connect',
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
