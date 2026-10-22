import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../screens/scanner/code_scanner_screen.dart';

/// Where a scan came from.
enum ScanSource { camera, hid, ble }

/// A single scan result, broadcast on [ScannerService.scanStream] so any
/// screen (POS, checkout, reservations) can react to a scan regardless of
/// which widget currently has focus.
class ScanEvent {
  final String code;
  final ScanSource source;
  final DateTime at;
  const ScanEvent(this.code, this.source, this.at);

  @override
  String toString() => 'ScanEvent($code, $source)';
}

/// Unified barcode/QR scanner device service — the scanner analogue of
/// [StripeTerminalService] for the M2 reader.
///
/// Two scan sources, one stream:
///
///  1. **Camera** — wraps the existing [scanCode] / [CodeScannerScreen]
///     flow. Works on every device with no extra hardware. Used by the
///     explicit "scan" button. Results are also pushed onto [scanStream].
///
///  2. **HID wedge** — most external BLE/USB barcode scanners (Socket
///     Mobile, Honeywell, generic) pair at the OS level and behave as a
///     keyboard: they "type" the barcode characters extremely fast and
///     finish with Enter. iOS/Android do NOT let an app pair or manage an
///     HID device, so there is no M2-style connect/disconnect here. What
///     we CAN do — and this is the real upgrade — is install an app-wide
///     [HardwareKeyboard] handler that recognises the machine-fast
///     keystroke burst and emits it as a [ScanEvent], so a paired scanner
///     works *anywhere* in the app (scan → add to cart) instead of only
///     inside a focused text field.
///
/// The HID handler is non-consuming (returns false): it never swallows
/// keystrokes, so manual keyboard typing keeps working untouched. It only
/// accumulates characters while they arrive faster than a human can type
/// (inter-key gap below [_hidMaxGap]); human typing has larger gaps so the
/// buffer never builds and no false scan is ever emitted.
class ScannerService {
  static final ScannerService _instance = ScannerService._();
  factory ScannerService() => _instance;
  ScannerService._();

  // ── Tuning ──────────────────────────────────────────────────────────
  /// Max gap between two keystrokes to still count as one machine burst.
  /// Human typing is ~80-250ms/char; HID scanners are <20ms/char.
  static const Duration _hidMaxGap = Duration(milliseconds: 60);

  /// Minimum buffered chars before a burst+Enter counts as a scan — guards
  /// against a stray fast double-tap being read as a 1-char "barcode".
  static const int _hidMinLength = 3;

  /// A HID scanner is considered "present" if one fired within this window.
  static const Duration _hidPresenceWindow = Duration(minutes: 10);

  static const _kHidEnabled = 'scanner_hid_capture_enabled';
  static const _kCameraEnabled = 'scanner_camera_enabled';

  final _controller = StreamController<ScanEvent>.broadcast();

  /// Broadcast stream of every scan (camera or HID). Subscribe from any
  /// screen; remember to cancel the subscription on dispose.
  Stream<ScanEvent> get scanStream => _controller.stream;

  /// UI binds to this with ValueListenableBuilder for live status (mirrors
  /// StripeTerminalService.updateProgress). Bumps on every state change.
  final ValueNotifier<int> revision = ValueNotifier<int>(0);

  bool _initialized = false;
  bool _hidCaptureEnabled = true;
  // Camera scanning is ON by default and always available — the ONLY thing
  // that disables it is the explicit switch in Devices → Barcode scanner.
  bool _cameraScanEnabled = true;
  bool _handlerInstalled = false;

  static const _inputChannel = MethodChannel('appmint/scanner/input');
  StreamSubscription<dynamic>? _inputDevicesSub;
  List<String> _connectedHidScanners = [];
  bool get isHidConnected => _connectedHidScanners.isNotEmpty;
  String? get connectedHidName => _connectedHidScanners.firstOrNull;

  void _setInputDevices(dynamic names) {
    _connectedHidScanners = names is List
        ? names.whereType<String>().toList()
        : [];
    _bump();
  }

  Future<void> refreshInputDevices() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      _setInputDevices(await _inputChannel.invokeMethod('connectedScanners'));
    } catch (_) {
      // Older native builds and non-Android platforms retain HID capture.
    }
  }

  ScanEvent? _lastScan;
  DateTime? _lastHidScanAt;

  // HID burst accumulator
  final StringBuffer _hidBuf = StringBuffer();
  DateTime? _lastKeyAt;

  bool get isInitialized => _initialized;
  bool get hidCaptureEnabled => _hidCaptureEnabled;
  bool get cameraScanEnabled => _cameraScanEnabled;
  ScanEvent? get lastScan => _lastScan;
  DateTime? get lastHidScanAt => _lastHidScanAt;

  /// True if an HID scan was seen recently — best-effort "is a hardware
  /// scanner attached" signal (the OS won't tell us; a recent wedge scan
  /// is the only evidence available).
  bool get hidLikelyPresent {
    final t = _lastHidScanAt;
    return t != null && DateTime.now().difference(t) < _hidPresenceWindow;
  }

  void _bump() => revision.value++;

  /// Idempotent. Loads the persisted HID-capture preference and installs
  /// the app-wide keyboard handler if enabled. Call once at app start
  /// (and any time before first scan use).
  Future<void> ensureInitialized() async {
    if (_initialized) return;
    try {
      final p = await SharedPreferences.getInstance();
      _hidCaptureEnabled = p.getBool(_kHidEnabled) ?? true;
      _cameraScanEnabled = p.getBool(_kCameraEnabled) ?? true;
    } catch (_) {
      _hidCaptureEnabled = true;
      _cameraScanEnabled = true;
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      _inputDevicesSub ??= const EventChannel('appmint/scanner/input/state')
          .receiveBroadcastStream()
          .listen(_setInputDevices, onError: (Object _) {});
      await refreshInputDevices();
    }
    if (_hidCaptureEnabled) _installHidHandler();
    _initialized = true;
    _bump();
    // Best-effort reconnect to the last BLE scanner — fire-and-forget so
    // app startup is never blocked on a scanner being in range.
    // Restoration runs after sign-in and whenever the app resumes.
  }

  /// Turn the app-wide HID wedge capture on/off (persisted). Camera
  /// scanning is unaffected and always available.
  Future<void> setHidCaptureEnabled(bool enabled) async {
    _hidCaptureEnabled = enabled;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_kHidEnabled, enabled);
    } catch (_) {}
    if (enabled) {
      _installHidHandler();
    } else {
      _removeHidHandler();
      _hidBuf.clear();
      _lastKeyAt = null;
    }
    _bump();
  }

  /// Enable/disable the camera scanner (persisted). Default ON. This is the
  /// ONLY control over camera scanning — it is never gated by HID/BLE state.
  Future<void> setCameraScanEnabled(bool enabled) async {
    _cameraScanEnabled = enabled;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_kCameraEnabled, enabled);
    } catch (_) {}
    _bump();
  }

  // ── Camera path ─────────────────────────────────────────────────────

  /// Launch the camera scanner. Returns the scanned string (or null if
  /// cancelled). The result is also pushed onto [scanStream] so listeners
  /// get a single consistent event channel for both sources.
  Future<String?> scanWithCamera(
    BuildContext context, {
    String title = 'Scan',
    String? hint,
    List<BarcodeFormat> formats = const [],
  }) async {
    final code = await scanCode(
      context,
      title: title,
      hint: hint,
      formats: formats,
    );
    if (code != null && code.trim().isNotEmpty) {
      _emit(code.trim(), ScanSource.camera);
    }
    return code;
  }

  // ── HID wedge path ──────────────────────────────────────────────────

  void _installHidHandler() {
    if (_handlerInstalled) return;
    HardwareKeyboard.instance.addHandler(_onKey);
    _handlerInstalled = true;
  }

  void _removeHidHandler() {
    if (!_handlerInstalled) return;
    HardwareKeyboard.instance.removeHandler(_onKey);
    _handlerInstalled = false;
  }

  /// Non-consuming key handler (always returns false). Accumulates only
  /// machine-fast keystroke bursts; emits a scan on the terminating Enter.
  bool _onKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final now = DateTime.now();
    final isEnter =
        event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.numpadEnter;

    if (isEnter) {
      final gapOk =
          _lastKeyAt != null && now.difference(_lastKeyAt!) < _hidMaxGap;
      final code = _hidBuf.toString();
      _hidBuf.clear();
      _lastKeyAt = null;
      if (gapOk && code.length >= _hidMinLength) {
        _emit(code, ScanSource.hid);
      }
      return false;
    }

    final ch = event.character;
    // Only printable single chars contribute to a barcode.
    if (ch == null || ch.isEmpty || ch.codeUnitAt(0) < 0x20) {
      return false;
    }

    if (_lastKeyAt == null || now.difference(_lastKeyAt!) < _hidMaxGap) {
      // Still within a fast burst (or the first key) — accumulate.
      _hidBuf.write(ch);
    } else {
      // Gap too large → human typing. Restart the buffer from this key.
      _hidBuf
        ..clear()
        ..write(ch);
    }
    _lastKeyAt = now;
    return false; // never consume — manual typing stays intact
  }

  // ── BLE scanner path (true in-app discover + connect, M2-style) ─────
  //
  // For scanners running in BLE-peripheral / serial mode (NOT HID mode —
  // iOS hides HID peripherals from apps). We scan, list, tap-to-connect,
  // subscribe to the device's notify characteristic, and turn incoming
  // bytes into ScanEvents. No iOS Settings hand-off.

  // Nordic UART Service — the most common "serial over BLE" profile used
  // by barcode scanners. TX (device→host, notify) carries the barcode.
  static final Guid _nusService = Guid('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
  static final Guid _nusTx = Guid('6e400003-b5a3-f393-e0a9-e50e24dcca9e');

  static const _kBleDeviceId = 'scanner_ble_device_id';

  BluetoothDevice? _bleDevice;
  Future<void>? _restoring;
  bool _connecting = false;
  StreamSubscription<BluetoothConnectionState>? _bleConnSub;
  StreamSubscription<List<int>>? _bleCharSub;
  final List<int> _bleBuf = [];
  DateTime? _lastBleScanAt;

  DateTime? get lastBleScanAt => _lastBleScanAt;
  BluetoothDevice? get connectedBleDevice => _bleDevice;
  String? get connectedBleName => _bleDevice?.platformName.isNotEmpty == true
      ? _bleDevice!.platformName
      : _bleDevice?.remoteId.str;
  bool get isBleConnected => _bleDevice != null;

  /// Adapter on/off/unauthorized state — UI drives the "turn on Bluetooth"
  /// prompt from this.
  Stream<BluetoothAdapterState> get bleAdapterState =>
      FlutterBluePlus.adapterState;
  BluetoothAdapterState get bleAdapterStateNow =>
      FlutterBluePlus.adapterStateNow;

  /// Live discovery results while scanning.
  Stream<List<ScanResult>> get bleScanResults => FlutterBluePlus.scanResults;

  /// Devices this phone already knows about, which a scan will **never** show.
  ///
  /// A BLE device stops advertising once it is bonded or connected, so
  /// `FlutterBluePlus.scanResults` cannot contain it. Pairing a scanner in
  /// Android's own Bluetooth settings and then finding nothing in the app is
  /// exactly this — the scan is working, the device simply is not shouting any
  /// more. Three separate interfaces have to be asked:
  ///
  ///  * [FlutterBluePlus.connectedDevices] — connected to *this* app
  ///  * [FlutterBluePlus.systemDevices]    — connected to the OS by any app
  ///  * [FlutterBluePlus.bondedDevices]    — Android's paired list
  ///
  /// Deduplicated by remote id, since a device commonly appears in more than one.
  Future<List<BluetoothDevice>> knownDevices() async {
    final out = <String, BluetoothDevice>{};
    for (final d in FlutterBluePlus.connectedDevices) {
      out[d.remoteId.str] = d;
    }
    try {
      for (final d in await FlutterBluePlus.systemDevices(<Guid>[])) {
        out[d.remoteId.str] = d;
      }
    } catch (_) {
      /* not supported on this platform */
    }
    try {
      for (final d in await FlutterBluePlus.bondedDevices) {
        out[d.remoteId.str] = d;
      }
    } catch (_) {
      /* Android-only */
    }
    return out.values.toList();
  }

  bool get isBleScanning => FlutterBluePlus.isScanningNow;

  /// Ensure the radio is on. Android: turn it on programmatically. iOS:
  /// Apple forbids apps toggling Bluetooth — return false so the UI shows
  /// a prompt (it does NOT bounce the user to Settings to "scan").
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

  /// Connect a chosen scanner, find its data characteristic, and start
  /// turning its output into ScanEvents. Persists the device for
  /// auto-reconnect next launch.
  Future<void> connectBleScanner(BluetoothDevice device) async {
    await _restoring;
    _connecting = true;
    try {
      await _connectBleScanner(device);
    } finally {
      _connecting = false;
    }
  }

  Future<void> _connectBleScanner(BluetoothDevice device) async {
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

    final bound = await _bindBleNotify(device);
    if (!bound) {
      await disconnectBle();
      throw Exception(
        'Connected, but this device has no readable scan output — it may '
        'be in HID mode. Switch it to BLE/serial mode and retry.',
      );
    }

    try {
      final p = await SharedPreferences.getInstance();
      await p.setString(_kBleDeviceId, device.remoteId.str);
    } catch (_) {}
    _bump();
  }

  /// Find a notify characteristic (prefer Nordic UART TX; else the first
  /// notify-capable char on any service) and subscribe to it.
  Future<bool> _bindBleNotify(BluetoothDevice device) async {
    final services = await device.discoverServices();
    BluetoothCharacteristic? target;

    for (final s in services) {
      if (s.uuid == _nusService) {
        for (final c in s.characteristics) {
          if (c.uuid == _nusTx) {
            target = c;
            break;
          }
        }
      }
      if (target != null) break;
    }
    target ??= () {
      for (final s in services) {
        for (final c in s.characteristics) {
          if (c.properties.notify || c.properties.indicate) return c;
        }
      }
      return null;
    }();

    if (target == null) return false;

    await target.setNotifyValue(true);
    _bleCharSub = target.onValueReceived.listen(_onBleBytes);
    return true;
  }

  /// Accumulate incoming bytes; a CR or LF terminates a barcode (most
  /// scanners append CR/LF). Decode the rest as ASCII/UTF-8 and emit.
  void _onBleBytes(List<int> bytes) {
    for (final b in bytes) {
      if (b == 0x0D || b == 0x0A) {
        if (_bleBuf.isNotEmpty) {
          final code = utf8.decode(_bleBuf, allowMalformed: true).trim();
          _bleBuf.clear();
          if (code.length >= _hidMinLength) _emit(code, ScanSource.ble);
        }
      } else if (b >= 0x20) {
        _bleBuf.add(b);
      }
    }
    // Some scanners send no terminator — flush a non-trivial buffer if it
    // arrived as one packet.
    if (_bleBuf.length >= _hidMinLength &&
        bytes.isNotEmpty &&
        bytes.last != 0x0D &&
        bytes.last != 0x0A) {
      // Defer slightly: if more bytes are coming they'll append; if not,
      // a microtask flush keeps single-packet scanners working.
      scheduleMicrotask(() {
        if (_bleBuf.isNotEmpty) {
          final code = utf8.decode(_bleBuf, allowMalformed: true).trim();
          _bleBuf.clear();
          if (code.length >= _hidMinLength) _emit(code, ScanSource.ble);
        }
      });
    }
  }

  Future<void> disconnectBle({bool forget = true}) async {
    await _bleCharSub?.cancel();
    _bleCharSub = null;
    await _bleConnSub?.cancel();
    _bleConnSub = null;
    try {
      await _bleDevice?.disconnect();
    } catch (_) {}
    _bleDevice = null;
    _bleBuf.clear();
    if (forget) {
      try {
        final p = await SharedPreferences.getInstance();
        await p.remove(_kBleDeviceId);
      } catch (_) {}
    }
    _bump();
  }

  /// Best-effort reconnect to the last paired BLE scanner on launch.
  Future<void> reconnectSaved() => _restoring ??= _restoreBleConnection()
      .whenComplete(() => _restoring = null);

  Future<void> _restoreBleConnection() async {
    await refreshInputDevices();
    if (_connecting || isBleConnected || FlutterBluePlus.isScanningNow) return;
    try {
      final p = await SharedPreferences.getInstance();
      final id = p.getString(_kBleDeviceId);
      if (id == null || id.isEmpty) return;
      // The cached state starts as unknown after a cold launch. Subscribe to
      // initialize CoreBluetooth instead of waiting forever for Settings to
      // start discovery and populate the cache.
      final adapter = await FlutterBluePlus.adapterState
          .firstWhere((state) => state != BluetoothAdapterState.unknown)
          .timeout(const Duration(seconds: 6));
      if (adapter != BluetoothAdapterState.on) return;
      final device = BluetoothDevice.fromId(id);
      await device.connect(timeout: const Duration(seconds: 8));
      _bleDevice = device;
      _bleConnSub = device.connectionState.listen((s) {
        if (s == BluetoothConnectionState.disconnected) {
          _bleCharSub?.cancel();
          _bleCharSub = null;
          _bleDevice = null;
          _bump();
        }
      });
      if (!await _bindBleNotify(device)) {
        await disconnectBle(forget: false);
        return;
      }
      _bump();
    } catch (_) {
      await disconnectBle(forget: false);
      // Keep the saved device for the next foreground retry.
    }
  }

  void _emit(String code, ScanSource source) {
    final ev = ScanEvent(code, source, DateTime.now());
    _lastScan = ev;
    if (source == ScanSource.hid) _lastHidScanAt = ev.at;
    if (source == ScanSource.ble) _lastBleScanAt = ev.at;
    if (!_controller.isClosed) _controller.add(ev);
    _bump();
  }

  void dispose() {
    _inputDevicesSub?.cancel();
    _removeHidHandler();
    _bleCharSub?.cancel();
    _bleConnSub?.cancel();
    _controller.close();
  }
}

/// Singleton, same access pattern as `stripeTerminalService` / `printerService`.
final scannerService = ScannerService();
