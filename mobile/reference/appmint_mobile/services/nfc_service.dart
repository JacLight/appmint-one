import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/nfc_manager_android.dart';
import 'package:nfc_manager/nfc_manager_ios.dart';
import 'package:nfc_manager_ndef/nfc_manager_ndef.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'nfc_card_codec.dart';

/// One card read, from either source.
/// [cardUid] = the chip's factory-burned hardware serial (anti-clone key the
/// server authenticates against). [employeeId] = the writable pointer the
/// card carries (NDEF text), used as the login identifier.
class CardTap {
  final String cardUid;
  final String? employeeId;
  final String source; // 'device' | 'ble'
  const CardTap(this.cardUid, this.employeeId, this.source);
}

/// Unified NFC card reader — the card analogue of ScannerService.
///
/// Two sources, one [cardStream]:
///   1. On-device NFC (iPhone Core NFC / Android NFC) when the hardware
///      exists. iPads have NO NFC — [deviceNfcAvailable] is false there.
///   2. An attached Bluetooth NFC reader (generic BLE serial, same pattern as
///      the BLE barcode scanner) so no-NFC devices can still tap cards. It is
///      paired/managed in the Devices screen like the scanner & printer.
class NfcService {
  NfcService._();
  static final NfcService instance = NfcService._();

  final _controller = StreamController<CardTap>.broadcast();
  Stream<CardTap> get cardStream => _controller.stream;

  /// Bumped on any state change so widgets can rebuild.
  final ValueNotifier<int> revision = ValueNotifier(0);
  void _bump() => revision.value++;

  bool _deviceNfcAvailable = false;
  bool get deviceNfcAvailable => _deviceNfcAvailable;

  bool _initialized = false;
  Future<void> ensureInitialized() async {
    if (_initialized) return;
    _initialized = true;
    try {
      _deviceNfcAvailable = (await NfcManager.instance.checkAvailability()) == NfcAvailability.enabled;
    } catch (_) {
      _deviceNfcAvailable = false;
    }
    _bump();
    unawaited(_tryAutoReconnectBle());
  }

  // ─── On-device NFC ────────────────────────────────────────────────────────

  bool _sessionActive = false;
  bool get sessionActive => _sessionActive;

  /// Start a single on-device tap. Resolves with the read card, or null if
  /// cancelled/failed. Safe no-op (returns null) when the device has no NFC —
  /// callers should fall back to the attached BLE reader.
  Future<CardTap?> readOnDevice({
    String alertMessage = 'Hold your card near the device',
  }) async {
    if (!_deviceNfcAvailable) return null;
    final completer = Completer<CardTap?>();
    _sessionActive = true;
    _bump();
    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
        invalidateAfterFirstReadIos: false,
        alertMessageIos: alertMessage,
        onDiscovered: (NfcTag tag) async {
          final uid = _extractUid(tag);
          final emp = _extractNdefText(tag);
          try {
            await NfcManager.instance.stopSession();
          } catch (_) {}
          _sessionActive = false;
          _bump();
          if (uid == null || uid.isEmpty) {
            if (!completer.isCompleted) completer.complete(null);
            return;
          }
          final tap = CardTap(uid, emp, 'device');
          _controller.add(tap);
          if (!completer.isCompleted) completer.complete(tap);
        },
      );
    } catch (e) {
      _sessionActive = false;
      _bump();
      if (!completer.isCompleted) completer.complete(null);
    }
    return completer.future;
  }

  Future<void> cancelOnDevice() async {
    if (!_sessionActive) return;
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {}
    _sessionActive = false;
    _bump();
  }

  /// Read the native tag identifier through the platform-specific API.
  String? _extractUid(NfcTag tag) {
    final List<int>? id = switch (defaultTargetPlatform) {
      TargetPlatform.android => NfcTagAndroid.from(tag)?.id,
      TargetPlatform.iOS => MiFareIos.from(tag)?.identifier ??
          Iso7816Ios.from(tag)?.identifier ??
          Iso15693Ios.from(tag)?.identifier ??
          FeliCaIos.from(tag)?.currentIDm,
      _ => null,
    };
    if (id == null || id.isEmpty) return null;
    return id.map((b) => b.toRadixString(16).padLeft(2, '0')).join().toUpperCase();
  }

  /// First NDEF text record = the employeeId written to the card.
  String? _extractNdefText(NfcTag tag) {
    try {
      final ndef = Ndef.from(tag);
      return decodeEmployeeCard(ndef?.cachedMessage);
    } catch (_) {}
    return null;
  }

  /// Write the employeeId onto a writable tag (admin issuance, on-device).
  Future<bool> writeEmployeeId(String employeeId) async {
    if (!_deviceNfcAvailable) return false;
    final completer = Completer<bool>();
    _sessionActive = true;
    _bump();
    try {
      await NfcManager.instance.startSession(
        pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
        invalidateAfterFirstReadIos: false,
        alertMessageIos: 'Hold the new card to write it',
        onDiscovered: (NfcTag tag) async {
          var ok = false;
          try {
            final ndef = Ndef.from(tag);
            if (ndef != null && ndef.isWritable) {
              await ndef.write(message: encodeEmployeeCard(employeeId));
              ok = true;
            }
          } catch (_) {}
          try {
            await NfcManager.instance.stopSession();
          } catch (_) {}
          _sessionActive = false;
          _bump();
          if (!completer.isCompleted) completer.complete(ok);
        },
      );
    } catch (_) {
      _sessionActive = false;
      _bump();
      if (!completer.isCompleted) completer.complete(false);
    }
    return completer.future;
  }

  // ─── Attached Bluetooth NFC reader (generic BLE serial) ──────────────────

  static const _kBleId = 'nfc_reader_ble_device_id';

  BluetoothDevice? _bleDevice;
  StreamSubscription<BluetoothConnectionState>? _bleConnSub;
  StreamSubscription<List<int>>? _bleCharSub;
  final List<int> _bleBuf = [];

  bool get isBleConnected => _bleDevice != null;
  String? get connectedBleName => _bleDevice?.platformName.isNotEmpty == true
      ? _bleDevice!.platformName
      : _bleDevice?.remoteId.str;

  Stream<BluetoothAdapterState> get bleAdapterState =>
      FlutterBluePlus.adapterState;
  BluetoothAdapterState get bleAdapterStateNow =>
      FlutterBluePlus.adapterStateNow;
  Stream<List<ScanResult>> get bleScanResults => FlutterBluePlus.scanResults;

  /// Devices the phone already knows about, which a scan will never show — a
  /// bonded or connected BLE device stops advertising. Asks all three
  /// interfaces (this app's connections, the OS's, and Android's paired list)
  /// and deduplicates by remote id.
  Future<List<BluetoothDevice>> knownDevices() async {
    final out = <String, BluetoothDevice>{};
    for (final d in FlutterBluePlus.connectedDevices) {
      out[d.remoteId.str] = d;
    }
    try {
      for (final d in await FlutterBluePlus.systemDevices(<Guid>[])) {
        out[d.remoteId.str] = d;
      }
    } catch (_) {/* not supported on this platform */}
    try {
      for (final d in await FlutterBluePlus.bondedDevices) {
        out[d.remoteId.str] = d;
      }
    } catch (_) {/* Android-only */}
    return out.values.toList();
  }
  bool get isBleScanning => FlutterBluePlus.isScanningNow;

  Future<bool> ensureBluetoothOn() async {
    if (!(await FlutterBluePlus.isSupported)) return false;
    if (FlutterBluePlus.adapterStateNow == BluetoothAdapterState.on) {
      return true;
    }
    try {
      await FlutterBluePlus.turnOn(); // Android only; throws on iOS
      await FlutterBluePlus.adapterState
          .firstWhere((s) => s == BluetoothAdapterState.on)
          .timeout(const Duration(seconds: 6));
      return true;
    } catch (_) {
      return FlutterBluePlus.adapterStateNow == BluetoothAdapterState.on;
    }
  }

  Future<void> startBleScan() async {
    // Restart rather than bail out. Returning early when a scan was already
    // in flight made "Rescan" a silent no-op — the spinner ran and the list
    // never changed.
    if (FlutterBluePlus.isScanningNow) {
      await FlutterBluePlus.stopScan();
    }
    await FlutterBluePlus.startScan(
      timeout: const Duration(seconds: 12),
      // MUST stay false. The manifest caps ACCESS_FINE_LOCATION at
      // maxSdkVersion=30, so on Android 12+ it can never be granted, and
      // asking for it makes the scan return nothing at all — which is why
      // this list was empty while the printer's scan (which passes false)
      // found devices fine. BLUETOOTH_SCAN is declared neverForLocation, so
      // no location permission is needed to discover devices.
      androidUsesFineLocation: false,
    );
    _bump();
  }

  Future<void> stopBleScan() async {
    if (FlutterBluePlus.isScanningNow) await FlutterBluePlus.stopScan();
    _bump();
  }

  Future<void> connectBleReader(BluetoothDevice device) async {
    await stopBleScan();
    await disconnectBle(forget: false);
    await device.connect(timeout: const Duration(seconds: 15));
    _bleDevice = device;
    _bleConnSub = device.connectionState.listen((s) {
      if (s == BluetoothConnectionState.disconnected) {
        _bleCharSub?.cancel();
        _bleCharSub = null;
        _bleDevice = null;
        _bump();
      }
    });
    final bound = await _bindNotify(device);
    if (!bound) {
      await disconnectBle();
      throw Exception(
        'Connected, but this reader exposes no readable output. Put it in '
        'BLE/serial mode (not HID) and retry.',
      );
    }
    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_kBleId, device.remoteId.str);
    } catch (_) {}
    _bump();
  }

  Future<bool> _bindNotify(BluetoothDevice device) async {
    final services = await device.discoverServices();
    BluetoothCharacteristic? target;
    for (final s in services) {
      for (final c in s.characteristics) {
        if (c.properties.notify || c.properties.indicate) {
          target = c;
          break;
        }
      }
      if (target != null) break;
    }
    if (target == null) return false;
    await target.setNotifyValue(true);
    _bleCharSub = target.onValueReceived.listen(_onBleBytes);
    return true;
  }

  /// Accumulate bytes; CR/LF terminates a read. The reader emits the card
  /// UID, optionally `UID|employeeId` (or comma/space separated).
  void _onBleBytes(List<int> bytes) {
    for (final b in bytes) {
      if (b == 0x0D || b == 0x0A) {
        _flushBle();
      } else {
        _bleBuf.add(b);
      }
    }
  }

  void _flushBle() {
    if (_bleBuf.isEmpty) return;
    final raw = String.fromCharCodes(_bleBuf).trim();
    _bleBuf.clear();
    if (raw.isEmpty) return;
    final parts = raw.split(RegExp(r'[|,;\s]+'));
    final uid = parts.first.trim().toUpperCase();
    final emp = parts.length > 1 ? parts[1].trim() : null;
    if (uid.isEmpty) return;
    _controller.add(CardTap(uid, (emp != null && emp.isEmpty) ? null : emp,
        'ble'));
  }

  Future<void> disconnectBle({bool forget = true}) async {
    await _bleConnSub?.cancel();
    _bleConnSub = null;
    await _bleCharSub?.cancel();
    _bleCharSub = null;
    final d = _bleDevice;
    _bleDevice = null;
    if (d != null) {
      try {
        await d.disconnect();
      } catch (_) {}
    }
    if (forget) {
      try {
        final p = await SharedPreferences.getInstance();
        await p.remove(_kBleId);
      } catch (_) {}
    }
    _bump();
  }

  Future<void> _tryAutoReconnectBle() async {
    try {
      final p = await SharedPreferences.getInstance();
      final id = p.getString(_kBleId);
      if (id == null) return;
      if (FlutterBluePlus.adapterStateNow != BluetoothAdapterState.on) return;
      final dev = BluetoothDevice.fromId(id);
      await connectBleReader(dev);
    } catch (_) {/* silent — user can re-pair in Devices */}
  }

  /// True when a card can be read by *some* source right now.
  bool get canReadCards => _deviceNfcAvailable || isBleConnected;
}

final nfcService = NfcService.instance;
