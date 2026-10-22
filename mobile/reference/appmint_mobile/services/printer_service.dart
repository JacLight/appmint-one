import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'thermal/thermal_printer.dart';
import 'thermal/classic_printer.dart';
import 'thermal/receipt_qr.dart';
import 'thermal/thermal_printer.dart' as fp;

import 'package:shared_preferences/shared_preferences.dart';

/// Receipt block — a single semantic chunk the renderer turns into ESC/POS
/// commands. Decoupled from the printer driver so a receipt can be reused
/// across paper sizes, layouts, or rendered to PDF in the future.
sealed class ReceiptBlock {
  const ReceiptBlock();
}

class ReceiptHeader extends ReceiptBlock {
  final String name;
  final String? subtitle;
  const ReceiptHeader({required this.name, this.subtitle});
}

class ReceiptLine extends ReceiptBlock {
  final String text;
  final bool bold;
  final bool centered;
  final ReceiptSize size;
  const ReceiptLine(
    this.text, {
    this.bold = false,
    this.centered = false,
    this.size = ReceiptSize.normal,
  });
}

class ReceiptKv extends ReceiptBlock {
  /// Two-column row — label on left, value on right (right-aligned).
  /// Used for order#, total, tip, change, etc.
  final String label;
  final String value;
  final bool bold;
  const ReceiptKv(this.label, this.value, {this.bold = false});
}

class ReceiptItem extends ReceiptBlock {
  /// Line item — qty + name on top line, price right-aligned. Options /
  /// special instructions wrap below in smaller text.
  final num quantity;
  final String name;
  final num lineTotal;
  final List<String> options;
  final String? specialInstructions;
  const ReceiptItem({
    required this.quantity,
    required this.name,
    required this.lineTotal,
    this.options = const [],
    this.specialInstructions,
  });
}

class ReceiptDivider extends ReceiptBlock {
  const ReceiptDivider();
}

class ReceiptFeed extends ReceiptBlock {
  final int lines;
  const ReceiptFeed([this.lines = 1]);
}

class ReceiptBarcode extends ReceiptBlock {
  /// Renders as QR code by default (most useful for "scan to view receipt"
  /// digital follow-up). Type can be CODE128 for product labels.
  final String data;

  /// 'QR' | 'CODE128' | 'EAN13'
  final String type;
  const ReceiptBarcode(this.data, {this.type = 'QR'});
}

enum ReceiptSize { normal, large, huge }

/// Format the receipt as ESC/POS bytes. Caller hands the bytes to
/// printer.printData(). The package's PaperSize.mm80 is the standard
/// thermal POS width (also accepts mm58 for handheld receipt printers).
class ReceiptRenderer {
  final PaperSize paperSize;
  ReceiptRenderer({this.paperSize = PaperSize.mm80});

  Future<List<int>> render(List<ReceiptBlock> blocks) async {
    final profile = await CapabilityProfile.load();
    final generator = Generator(paperSize, profile);
    final out = <int>[];

    for (final b in blocks) {
      out.addAll(_renderBlock(generator, b));
    }
    out.addAll(generator.feed(3));
    out.addAll(generator.cut());
    return out;
  }

  /// Drawer kick — sent BEFORE or AFTER a print job. Most printers accept
  /// it as a standalone command; some require it riding on a print job.
  /// Generic ESC p m t1 t2 (pulse) — pin 0, on-time 50ms, off-time 250ms.
  Future<List<int>> renderDrawerKick() async {
    final profile = await CapabilityProfile.load();
    final generator = Generator(paperSize, profile);
    return generator.drawer();
  }

  /// Render server-side primitive lines directly to ESC/POS. The server
  /// resolves the template + interpolates the context; we just translate
  /// the resulting primitives one-for-one. Shape per primitive:
  ///   { kind: 'text', text, bold?, size? }   size ∈ 'normal'|'large'|'huge'
  ///   { kind: 'feed', lines? }
  ///   { kind: 'cut' }
  ///   { kind: 'image', url? }    (URL fetched + decoded — TODO; skipped for now)
  ///
  /// Anything else is ignored — we don't second-guess the server.
  Future<List<int>> renderServerLines(List<dynamic> primitives) async {
    final profile = await CapabilityProfile.load();
    final g = Generator(paperSize, profile);
    final out = <int>[];
    for (final raw in primitives) {
      if (raw is! Map) continue;
      final m = Map<String, dynamic>.from(raw);
      switch (m['kind']) {
        case 'text':
          final text = (m['text'] ?? '').toString();
          if (text.isEmpty) continue;
          final size = (m['size'] ?? 'normal').toString();
          final ts = size == 'huge'
              ? PosTextSize.size3
              : (size == 'large' ? PosTextSize.size2 : PosTextSize.size1);
          out.addAll(
            g.text(
              text,
              styles: PosStyles(bold: m['bold'] == true, height: ts, width: ts),
            ),
          );
          break;
        case 'feed':
          final n = (m['lines'] is num) ? (m['lines'] as num).toInt() : 1;
          out.addAll(g.feed(n > 0 ? n : 1));
          break;
        case 'cut':
          out.addAll(g.cut());
          break;
        case 'image':
          // Server emits {url}. Image fetch + decode is async-network; left
          // unimplemented until we hit a template that uses it. Operator
          // sees a text placeholder so the bug is visible.
          final url = (m['url'] ?? '').toString();
          if (url.isNotEmpty) {
            out.addAll(
              g.text(
                '[image: $url]',
                styles: const PosStyles(align: PosAlign.center),
              ),
            );
          }
          break;
        default:
          // Unknown kind — drop silently rather than throwing. Server may
          // emit primitives this Dart version doesn't recognize yet (e.g.
          // a new 'barcode' kind); print job still succeeds for the rest.
          break;
      }
    }
    return out;
  }

  List<int> _renderBlock(Generator g, ReceiptBlock block) {
    switch (block) {
      case ReceiptHeader(name: final n, subtitle: final s):
        final out = <int>[];
        out.addAll(
          g.text(
            n,
            styles: const PosStyles(
              align: PosAlign.center,
              height: PosTextSize.size2,
              width: PosTextSize.size2,
              bold: true,
            ),
          ),
        );
        if (s != null && s.isNotEmpty) {
          out.addAll(
            g.text(s, styles: const PosStyles(align: PosAlign.center)),
          );
        }
        out.addAll(g.feed(1));
        return out;
      case ReceiptLine(:final text, :final bold, :final centered, :final size):
        return g.text(
          text,
          styles: PosStyles(
            align: centered ? PosAlign.center : PosAlign.left,
            bold: bold,
            height: size == ReceiptSize.huge
                ? PosTextSize.size3
                : (size == ReceiptSize.large
                      ? PosTextSize.size2
                      : PosTextSize.size1),
            width: size == ReceiptSize.huge
                ? PosTextSize.size3
                : (size == ReceiptSize.large
                      ? PosTextSize.size2
                      : PosTextSize.size1),
          ),
        );
      case ReceiptKv(:final label, :final value, :final bold):
        return g.row([
          PosColumn(
            text: label,
            width: 8,
            styles: PosStyles(bold: bold),
          ),
          PosColumn(
            text: value,
            width: 4,
            styles: PosStyles(align: PosAlign.right, bold: bold),
          ),
        ]);
      case ReceiptItem(
        :final quantity,
        :final name,
        :final lineTotal,
        :final options,
        :final specialInstructions,
      ):
        final out = <int>[];
        out.addAll(
          g.row([
            PosColumn(text: '${quantity.toString()}x  $name', width: 9),
            PosColumn(
              text: lineTotal.toStringAsFixed(2),
              width: 3,
              styles: const PosStyles(align: PosAlign.right),
            ),
          ]),
        );
        for (final o in options) {
          out.addAll(
            g.text('   $o', styles: const PosStyles(height: PosTextSize.size1)),
          );
        }
        if (specialInstructions != null && specialInstructions.isNotEmpty) {
          out.addAll(
            g.text(
              '   * $specialInstructions',
              styles: const PosStyles(bold: true),
            ),
          );
        }
        return out;
      case ReceiptDivider():
        return g.hr();
      case ReceiptFeed(:final lines):
        return g.feed(lines);
      case ReceiptBarcode(:final data, :final type):
        final out = <int>[];
        if (type == 'QR') {
          // Render the symbol ourselves: some ESC/POS-compatible printers
          // silently ignore the native QR command and print only the label.
          out.addAll(g.imageRaster(receiptQrImage(data)));
          out.addAll(g.feed(1));
        } else {
          // CODE128 — generator API uses Barcode enum, fall through to
          // text for unsupported types rather than throwing.
          try {
            out.addAll(
              g.barcode(
                Barcode.code128(('{B${data.replaceAll('{', '{{')}').split('')),
                width: 2,
                height: 90,
              ),
            );
          } catch (_) {
            out.addAll(
              g.text(data, styles: const PosStyles(align: PosAlign.center)),
            );
          }
        }
        return out;
    }
  }
}

/// Persistent settings for the default printer paired on THIS device.
class _PrinterPrefs {
  static const _kAddress = 'printer_default_address';
  static const _kName = 'printer_default_name';
  static const _kKind = 'printer_default_kind'; // BLE | USB | NETWORK
  static const _kPaper = 'printer_default_paper_mm'; // 58 | 80

  static Future<void> save({
    required String address,
    required String name,
    required String kind,
    int paperMm = 80,
  }) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kAddress, address);
    await p.setString(_kName, name);
    await p.setString(_kKind, kind);
    await p.setInt(_kPaper, paperMm);
  }

  static Future<Map<String, dynamic>?> load() async {
    final p = await SharedPreferences.getInstance();
    final addr = p.getString(_kAddress);
    if (addr == null || addr.isEmpty) return null;
    return {
      'address': addr,
      'name': p.getString(_kName) ?? addr,
      'kind': p.getString(_kKind) ?? 'BLE',
      'paperMm': p.getInt(_kPaper) ?? 80,
    };
  }

  static Future<void> clear() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_kAddress);
    await p.remove(_kName);
    await p.remove(_kKind);
    await p.remove(_kPaper);
  }
}

/// Bluetooth / USB / network ESC/POS printer service. Singleton.
///
/// Lifecycle:
///   - getDevicesStream() — emits the list of nearby paired printers; UI
///     listens to populate a picker.
///   - startScan() / stopScan() — begin/end BLE discovery.
///   - connect(printer) — opens the connection + persists this printer as
///     the device default for next time.
///   - printReceipt(blocks) — uses the currently-connected default; if no
///     printer is connected, tries to reconnect to the saved default first;
///     if no default, throws "No printer configured".
///   - openDrawer() — same connection lookup, sends the kick command.
class PrinterService {
  static final PrinterService _instance = PrinterService._();
  factory PrinterService() => _instance;
  PrinterService._();

  final FlutterThermalPrinter _plugin = FlutterThermalPrinter.instance;
  fp.Printer? _connected;
  int _paperMm = 80;
  StreamSubscription<bool>? _connectionSub;
  bool _connecting = false;
  Future<bool>? _reconnecting;
  bool _classic = false;
  String get transportLabel =>
      _classic ? 'Bluetooth Classic' : (_connected?.connectionType?.name ?? '');
  final ValueNotifier<int> connectionRevision = ValueNotifier<int>(0);

  void _clearConnection() {
    _connected = null;
    connectionRevision.value++;
  }

  fp.Printer? get connected => _connected;
  bool get isConnected => _connected != null;
  int get paperMm => _paperMm;

  Stream<List<fp.Printer>> get devicesStream => _plugin.devicesStream;

  Future<void> startScan({
    Duration timeout = const Duration(seconds: 8),
    List<fp.ConnectionType> types = const [
      fp.ConnectionType.BLE,
      fp.ConnectionType.USB,
    ],
  }) async {
    await _plugin.getPrinters(
      refreshDuration: timeout,
      connectionTypes: types,
      androidUsesFineLocation: false,
    );
  }

  Future<void> stopScan() async {
    await _plugin.stopScan();
  }

  /// Connect to a printer and persist it as the default for next launch.
  /// Why the last [connect] failed, for the UI to show. Swallowing the
  /// exception left "Failed to connect" with no reason at all in release.
  String? lastConnectError;

  Future<bool> connect(
    fp.Printer printer, {
    int paperMm = 80,
    bool classic = false,
  }) async {
    if (_connecting) {
      lastConnectError = 'A printer connection is already in progress.';
      return false;
    }
    _connecting = true;
    lastConnectError = null;
    try {
      await disconnect();
      if (classic) {
        await ClassicPrinter.connect(printer.address ?? '');
      } else {
        final ok = await _plugin.connect(printer);
        if (!ok) {
          throw StateError('The printer refused the connection.');
        }
        await verifyThermalPrinter(printer);
      }
      _classic = classic;
      _connectionSub =
          (classic
                  ? ClassicPrinter.connection
                  : thermalPrinterConnection(printer))
              .listen((connected) {
                if (!connected) _clearConnection();
              }, onError: (Object error) => _clearConnection());
      _connected = printer;
      _paperMm = paperMm;
      await _PrinterPrefs.save(
        address: printer.address ?? '',
        name: printer.name ?? '',
        kind: classic ? 'CLASSIC' : printer.connectionType?.name ?? 'BLE',
        paperMm: paperMm,
      );
      connectionRevision.value++;
      return true;
    } catch (e) {
      lastConnectError =
          (e is PlatformException
                  ? e.message ?? 'Printer connection failed.'
                  : e.toString())
              .replaceAll('Exception: ', '')
              .replaceAll('Bad state: ', '');
      _clearConnection();
      try {
        if (classic) {
          await ClassicPrinter.disconnect();
        } else {
          await _plugin.disconnect(printer);
        }
      } catch (_) {}
      return false;
    } finally {
      _connecting = false;
    }
  }

  Future<void> disconnect() async {
    await _connectionSub?.cancel();
    _connectionSub = null;
    final previous = _connected;
    _clearConnection();
    if (previous != null) {
      try {
        if (_classic) {
          await ClassicPrinter.disconnect();
        } else {
          await _plugin.disconnect(previous);
        }
      } catch (_) {}
    }
  }

  Future<bool> verifyConnected() async {
    final printer = _connected;
    if (printer == null) return false;
    if (!await (_classic
        ? ClassicPrinter.isConnected()
        : thermalPrinterConnected(printer))) {
      _clearConnection();
      return false;
    }
    return true;
  }

  Future<void> _write(List<int> bytes) async {
    final printer = _connected;
    if (printer == null) throw StateError('Printer is disconnected.');
    try {
      if (_classic) {
        await ClassicPrinter.write(bytes);
      } else {
        await writeThermalPrinter(printer, bytes);
      }
    } catch (_) {
      await disconnect();
      rethrow;
    }
  }

  /// Whether this device has a receipt printer paired (a saved default).
  Future<bool> hasSavedDefault() async => (await _PrinterPrefs.load()) != null;

  /// Forget the saved default and disconnect from any active session.
  Future<void> forgetDefault() async {
    await disconnect();
    await _PrinterPrefs.clear();
  }

  /// Attempt to reconnect to the persisted default. Used at app start +
  /// before any print job that doesn't have a connection yet.
  Future<bool> reconnectDefault() => _reconnecting ??= _reconnectDefault()
      .whenComplete(() => _reconnecting = null);

  Future<bool> _reconnectDefault() async {
    if (_connecting) return false;
    if (await verifyConnected()) return true;
    final saved = await _PrinterPrefs.load();
    if (saved == null) return false;
    final kindStr = (saved['kind'] as String?) ?? 'BLE';
    final kind = fp.ConnectionType.values.firstWhere(
      (t) => t.name == kindStr,
      orElse: () => fp.ConnectionType.BLE,
    );
    final p = fp.Printer(
      address: saved['address'] as String?,
      name: saved['name'] as String?,
      connectionType: kind,
      isConnected: false,
    );
    final ok = await connect(
      p,
      paperMm: (saved['paperMm'] as int?) ?? 80,
      classic: kindStr == 'CLASSIC',
    );
    return ok;
  }

  /// Render and print a receipt. Auto-reconnects to the saved default
  /// when not already connected. Throws if no printer is configured at all.
  Future<void> printReceipt(List<ReceiptBlock> blocks, {int? paperMm}) async {
    if (!await verifyConnected() && !await reconnectDefault()) {
      throw Exception(
        'No printer paired on this device. Open Settings → Printer to pair one.',
      );
    }
    final renderer = ReceiptRenderer(
      paperSize: (paperMm ?? _paperMm) == 58 ? PaperSize.mm58 : PaperSize.mm80,
    );
    final bytes = await renderer.render(blocks);
    await _write(bytes);
  }

  /// Print server-rendered primitive lines (from
  /// `/storefront/pos/tab/:id/receipt-payload`). Auto-reconnects to the
  /// saved default. The `width` from the payload picks 58mm vs 80mm paper
  /// when present — server-side width=32 → 58mm, width=48 → 80mm.
  Future<void> printServerPayload(Map<String, dynamic> payload) async {
    if (!await verifyConnected() && !await reconnectDefault()) {
      throw Exception(
        'No printer paired on this device. Open Settings → Printer to pair one.',
      );
    }
    final lines = (payload['lines'] is List)
        ? payload['lines'] as List
        : const [];
    if (lines.isEmpty) {
      throw Exception('Server returned no printable lines for this receipt.');
    }
    // Server width is in characters: 32 ≈ 58mm, 48 ≈ 80mm. Respect it when
    // present, else fall back to the printer's saved paper size.
    final wChars = (payload['width'] is num)
        ? (payload['width'] as num).toInt()
        : null;
    final paper = wChars != null
        ? (wChars <= 32 ? PaperSize.mm58 : PaperSize.mm80)
        : (_paperMm == 58 ? PaperSize.mm58 : PaperSize.mm80);
    final renderer = ReceiptRenderer(paperSize: paper);
    final bytes = await renderer.renderServerLines(lines);
    // The server doesn't emit a final feed/cut on its own — pad and cut here
    // so the receipt tears off cleanly regardless of template.
    final profile = await CapabilityProfile.load();
    final g = Generator(paper, profile);
    final tail = <int>[...g.feed(3), ...g.cut()];
    await _write([...bytes, ...tail]);
  }

  /// Open the cash drawer connected to the printer. Most thermal printers
  /// have a DK port (RJ12) for this — the kick is just a tiny ESC/POS pulse.
  Future<void> openDrawer({int? paperMm}) async {
    if (!await verifyConnected() && !await reconnectDefault()) {
      throw Exception('No printer paired — drawer kick requires a printer.');
    }
    final renderer = ReceiptRenderer(
      paperSize: (paperMm ?? _paperMm) == 58 ? PaperSize.mm58 : PaperSize.mm80,
    );
    final bytes = await renderer.renderDrawerKick();
    await _write(bytes);
  }

  /// Print + kick in one shot. The cash drawer typically piggybacks on
  /// the receipt — opens after the cut.
  Future<void> printReceiptAndKickDrawer(List<ReceiptBlock> blocks) async {
    await printReceipt(blocks);
    await openDrawer();
  }
}

final printerService = PrinterService();
