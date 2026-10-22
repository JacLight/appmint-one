import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_thermal_printer/flutter_thermal_printer.dart';
import 'package:flutter_thermal_printer/flutter_thermal_printer_platform_interface.dart';
import 'package:flutter_thermal_printer/printer_manager.dart';
import 'package:flutter_thermal_printer/utils/printer.dart';

export 'package:flutter_thermal_printer/flutter_thermal_printer.dart';
export 'package:flutter_thermal_printer/utils/printer.dart';

Future<bool> thermalPrinterConnected(Printer printer) async =>
    PrinterManager.instance.isConnected(printer);

Stream<bool> thermalPrinterConnection(Printer printer) =>
    printer.connectionType == ConnectionType.BLE
    ? printer.connectionStream
    : const Stream.empty();

Future<BleCharacteristic> _printCharacteristic(Printer printer) async {
  final services = await printer.discoverServices();
  final writable = services
      .expand((service) => service.characteristics)
      .where(
        (c) =>
            c.properties.contains(CharacteristicProperty.write) ||
            c.properties.contains(CharacteristicProperty.writeWithoutResponse),
      )
      .toList();
  // Common ESC/POS serial services. Do not write to an arbitrary control
  // characteristic when an unrelated Bluetooth device has several of them.
  for (final shortId in ['ffe1', 'ff02', 'ae01', '2af1']) {
    for (final c in writable) {
      if (c.uuid.toLowerCase() == '0000$shortId-0000-1000-8000-00805f9b34fb') {
        return c;
      }
    }
  }
  if (writable.length == 1) return writable.single;
  throw StateError(
    writable.isEmpty
        ? 'This device has no writable Bluetooth print connection.'
        : 'Cannot identify a supported Bluetooth print connection for this device.',
  );
}

Future<void> verifyThermalPrinter(Printer printer) async {
  if (!await thermalPrinterConnected(printer)) {
    throw StateError('Printer disconnected. Pair it again before printing.');
  }
  if (printer.connectionType == ConnectionType.BLE) {
    await _printCharacteristic(printer);
    if (!await thermalPrinterConnected(printer)) {
      throw StateError('Printer disconnected during pairing.');
    }
  }
}

/// The package's printData catches transport errors and returns success. Use
/// its underlying transports directly so callers receive the actual failure.
Future<void> writeThermalPrinter(Printer printer, List<int> bytes) async {
  if (!await thermalPrinterConnected(printer)) {
    throw StateError('Printer disconnected. Nothing was sent.');
  }
  if (printer.connectionType == ConnectionType.BLE) {
    final characteristic = await _printCharacteristic(printer);
    final acknowledged = characteristic.properties.contains(
      CharacteristicProperty.write,
    );
    // Twenty bytes fits the minimum BLE MTU, including printers that reject
    // MTU negotiation. Never retry a partial job automatically (duplicate tickets).
    for (var offset = 0; offset < bytes.length; offset += 20) {
      final end = (offset + 20).clamp(0, bytes.length);
      await characteristic.write(
        bytes.sublist(offset, end),
        withResponse: acknowledged,
        timeout: const Duration(seconds: 10),
      );
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  } else if (Platform.isWindows) {
    await FlutterThermalPrinter.instance.printData(printer, bytes);
  } else {
    await FlutterThermalPrinterPlatform.instance.printText(
      printer,
      Uint8List.fromList(bytes),
      path: printer.address,
    );
  }
  if (!await thermalPrinterConnected(printer)) {
    throw StateError(
      'Printer disconnected while sending. Check the paper before retrying.',
    );
  }
}
