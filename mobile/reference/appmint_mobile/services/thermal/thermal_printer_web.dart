// ignore_for_file: constant_identifier_names, depend_on_referenced_packages
import 'dart:async';

// ESC/POS rendering is pure Dart and works on the web; only the transport is missing.
export 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';

enum ConnectionType { BLE, USB, NETWORK }

class Printer {
  Printer({
    this.address,
    this.name,
    this.connectionType,
    this.isConnected,
    this.vendorId,
    this.productId,
  });
  final String? address;
  final String? name;
  final ConnectionType? connectionType;
  final bool? isConnected;
  final String? vendorId;
  final String? productId;
  Map<String, dynamic> toJson() => {
    'address': address,
    'name': name,
    'connectionType': connectionType?.name,
    'isConnected': isConnected,
    'vendorId': vendorId,
    'productId': productId,
  };
}

/// Web has no BLE/USB printer transport: scans find nothing, connects fail,
/// prints throw — the UI surfaces that instead of pretending to print.
class FlutterThermalPrinter {
  FlutterThermalPrinter._();
  static final FlutterThermalPrinter instance = FlutterThermalPrinter._();
  final _devices = StreamController<List<Printer>>.broadcast();
  Stream<List<Printer>> get devicesStream => _devices.stream;
  Stream<bool> get isBleTurnedOnStream => Stream<bool>.value(false);
  Future<bool> connect(Printer device) async => false;
  Future<void> disconnect(Printer device) async {}
  Future<void> printData(
    Printer device,
    List<int> bytes, {
    bool longData = false,
  }) async {
    throw UnsupportedError('Printing is not available in the web build');
  }

  Future<void> getPrinters({
    Duration refreshDuration = const Duration(seconds: 2),
    List<ConnectionType> connectionTypes = const [],
    bool androidUsesFineLocation = false,
  }) async {
    _devices.add(const []);
  }

  Future<void> stopScan() async {}
}

Future<bool> thermalPrinterConnected(Printer printer) async => false;
Stream<bool> thermalPrinterConnection(Printer printer) => const Stream.empty();
Future<void> verifyThermalPrinter(Printer printer) async =>
    throw UnsupportedError('Printing is not available in the web build');
Future<void> writeThermalPrinter(Printer printer, List<int> bytes) async =>
    throw UnsupportedError('Printing is not available in the web build');
