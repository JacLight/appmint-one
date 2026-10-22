import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'thermal_printer.dart' as fp;

/// Android Bluetooth Classic/SPP transport, separate from the BLE plugin.
class ClassicPrinter {
  static bool get supported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  static const _channel = MethodChannel('appmint/printer/classic');
  static final Stream<bool> connection = const EventChannel(
    'appmint/printer/classic/state',
  ).receiveBroadcastStream().map((event) => event == true);

  static Future<List<fp.Printer>> scan() async {
    final devices = await _channel.invokeListMethod<dynamic>('scan') ?? [];
    return devices
        .map(
          (d) => fp.Printer(
            address: d['address'] as String?,
            name: d['name'] as String?,
            // The plugin model has no Classic enum; service tracks it explicitly.
            connectionType: fp.ConnectionType.BLE,
          ),
        )
        .toList();
  }

  static Future<void> stopScan() => _channel.invokeMethod('stopScan');
  static Future<void> connect(String address) async {
    if (await _channel.invokeMethod<bool>('connect', {'address': address}) !=
        true) {
      throw StateError('Printer connection did not complete.');
    }
  }

  static Future<void> disconnect() => _channel.invokeMethod('disconnect');
  static Future<bool> isConnected() async =>
      await _channel.invokeMethod<bool>('isConnected') == true;
  static Future<void> write(List<int> bytes) =>
      _channel.invokeMethod('write', {'bytes': Uint8List.fromList(bytes)});
}
