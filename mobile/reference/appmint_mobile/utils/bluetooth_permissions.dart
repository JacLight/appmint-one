import 'dart:io';

import 'package:permission_handler/permission_handler.dart';

/// Ask for the Bluetooth permissions Android 12+ requires at runtime.
///
/// Declaring them in `AndroidManifest.xml` is not enough. From Android 12
/// (API 31) `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` are runtime permissions,
/// and until they are granted a BLE scan quietly returns an empty list and a
/// connect attempt fails. There is no error and no device — the operator is
/// left holding a reader that simply never appears in the list, which is
/// indistinguishable from broken hardware.
///
/// iOS asks for Bluetooth itself, driven by the usage strings in `Info.plist`,
/// so there is nothing to request here.
///
/// Returns `null` when everything needed is granted, or a sentence saying what
/// is missing and how to fix it — meant to be shown on screen, never swallowed.
Future<String?> ensureBluetoothPermissions() async {
  if (!Platform.isAndroid) return null;

  final statuses = await [
    Permission.bluetoothScan,
    Permission.bluetoothConnect,
  ].request();

  if (statuses.values.every((s) => s.isGranted)) return null;

  // "Permanently denied" means the OS will no longer show the prompt, so
  // asking again does nothing and the only way through is the settings app.
  if (statuses.values.any((s) => s.isPermanentlyDenied)) {
    return 'Bluetooth permission is blocked for Appmint Mobile, so it cannot '
        'see nearby devices. Open Settings → Apps → Appmint Mobile '
        '→ Permissions → Nearby devices and allow it, then try again.';
  }
  return 'Appmint Mobile needs the "Nearby devices" permission to find '
      'Bluetooth devices. Tap scan again and allow it.';
}

/// Open the OS settings page for this app, for when permission was
/// permanently denied and the prompt will not come back.
Future<void> openAppPermissionSettings() => openAppSettings();

/// Turn a flutter_blue_plus connect failure into something an operator can act on.
///
/// `FlutterBluePlusException | connect | android-code: 147 |
/// GATT_CONNECTION_TIMEOUT` tells the person nothing. On this fleet the usual
/// cause is concrete: the device is a Bluetooth **Classic** (BR/EDR) scanner
/// paired as a keyboard, and flutter_blue_plus only speaks BLE — it can never
/// connect to one, however healthy the device is.
String describeBleConnectError(Object e) {
  final raw = e.toString();
  final looksLikeNoGatt = raw.contains('GATT_CONNECTION_TIMEOUT') ||
      raw.contains('android-code: 147') ||
      raw.contains('android-code: 133');
  if (looksLikeNoGatt) {
    return 'That device did not answer as a Bluetooth LE device. Scanners '
        'paired as a keyboard (HID) or over Bluetooth Classic / SPP cannot be '
        'connected here — they already work by typing straight into the app, '
        'so leave "App-wide hardware scanner" on and just scan. '
        'If it did stop working, re-pair it in Android’s Bluetooth settings.';
  }
  return raw.replaceAll('Exception: ', '');
}

/// Permissions a Stripe Terminal reader (M2, WisePad, WisePOS) needs before it
/// can be discovered over Bluetooth.
///
/// Stripe's Android SDK additionally requires **ACCESS_FINE_LOCATION** — on
/// every Android version, not just old ones — and requires location services
/// to actually be switched on. Without it `discoverReaders` simply yields
/// nothing, with no error, which is indistinguishable from "no reader nearby".
///
/// Returns null when everything needed is granted, or a sentence naming what
/// is missing.
Future<String?> ensureTerminalPermissions() async {
  if (!Platform.isAndroid) return null;

  final bluetooth = await ensureBluetoothPermissions();
  if (bluetooth != null) return bluetooth;

  final location = await Permission.locationWhenInUse.request();
  if (location.isPermanentlyDenied) {
    return 'Location permission is blocked for Appmint Mobile. Stripe requires '
        'it to find a Bluetooth card reader. Open Settings \u2192 Apps \u2192 '
        'Appmint Mobile \u2192 Permissions \u2192 Location and allow it.';
  }
  if (!location.isGranted) {
    return 'Stripe needs the Location permission to find a Bluetooth card '
        'reader. It is not used to track you \u2014 Android requires it for '
        'Bluetooth discovery. Tap scan again and allow it.';
  }

  // Granted is not enough: the SDK also needs location services switched on.
  if (!await Permission.location.serviceStatus.isEnabled) {
    return 'Turn Location on in Android quick settings. Stripe cannot discover '
        'a Bluetooth reader while location services are off, even with the '
        'permission granted.';
  }
  return null;
}
