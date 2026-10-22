import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'http_client.dart';
import 'first_stream_match.dart';

/// Stripe Terminal SDK wrapper for card-present payments via BLE readers
/// like the Stripe M2, plus Tap to Pay on iPhone/Android.
///
/// Lifecycle:
///   1. ensureInitialized() — happens on first use. Asks the SDK for a
///      connection token via our backend (/client/stowbo/host/terminal/
///      connection-token). The SDK then caches the token and rotates as
///      needed.
///   2. ensureLocationForListing() — register against the host’s saved listing.
///   3. startDiscovery() — listens on the SDK's discoverReaders stream.
///   4. connectReader(reader, locationId) — pair a specific reader. The
///      paired reader's serial is persisted so the next session can
///      auto-reconnect.
///   5. takePayment(amount, currency, ...) — full charge flow:
///         a. POST /client/stowbo/host/terminal/intent → client_secret
///         b. retrievePaymentIntent(clientSecret) on SDK
///         c. collectPaymentMethod(pi) → reader prompts "tap"
///         d. confirmPaymentIntent(pi) → submit to Stripe
///         e. returns PaymentIntent.id for tab.settle ref
///
/// Failures bubble up as exceptions so the caller (Settle sheet) can
/// surface them in the inline error UI.
class StripeTerminalService {
  static final StripeTerminalService _instance = StripeTerminalService._();
  factory StripeTerminalService() => _instance;
  StripeTerminalService._();

  final AppengineHttpClient _http = appengineHttpClient;

  bool _initialized = false;
  Future<void>? _initializing;
  Future<void>? _restoring;
  Terminal? _terminal;
  Reader? _connectedReader;

  /// Surfaces firmware-update progress to UI listeners while a reader is
  /// being paired. The first-time pair on an M2 can take 30–90s if a
  /// firmware update is pending — without showing the progress the
  /// operator thinks the app is hung. UI binds with ValueListenable.
  final ValueNotifier<ReaderUpdate?> updateProgress =
      ValueNotifier<ReaderUpdate?>(null);

  /// Bumps whenever a reader connects or disconnects, so any UI (e.g. the
  /// top-panel ReaderChip) can flip live via ValueListenable — without waiting
  /// for an app-resume or a manual refresh.
  final ValueNotifier<int> connectionRevision = ValueNotifier<int>(0);
  void _bumpConnection() => connectionRevision.value++;
  /// Which kind of reader is currently active. Drives the right
  /// disconnect / display path. 'bluetooth' = M2 / BBPOS-style external,
  /// 'tapToPay' = the phone's built-in NFC (Tap to Pay on iPhone / Android).
  String? _connectionKind;
  String? _locationId;

  // Persisted prefs — last paired reader's serial + chosen Stripe Location.
  static const _kSerial = 'stripe_terminal_reader_serial';
  static const _kLocation = 'stowbo_terminal_listing_location_id';
  static const _kKind = 'stripe_terminal_connection_kind';

  Reader? get connectedReader => _connectedReader;
  String? get connectionKind => _connectionKind;
  String? get locationId => _locationId;
  bool get isInitialized => _initialized;
  bool get isConnected => _connectedReader != null;
  bool get isTapToPay => _connectionKind == 'tapToPay';

  /// Initialize the SDK exactly once. Subsequent calls are no-ops.
  Future<void> ensureInitialized() async {
    if (_initialized) return;
    final pending = _initializing ??= _initialize();
    try {
      await pending;
    } finally {
      if (identical(_initializing, pending)) _initializing = null;
    }
  }

  Future<void> _initialize() async {
    await Terminal.initTerminal(
      shouldPrintLogs: kDebugMode,
      fetchToken: _fetchConnectionToken,
    );
    _terminal = Terminal.instance;
    final p = await SharedPreferences.getInstance();
    _locationId = p.getString(_kLocation);
    _initialized = true;
  }

  /// Startup, pairing and checkout share the same restoration attempt. SDK
  /// initialization never launches discovery in the background.
  Future<void> restoreConnection() async {
    if (isConnected) return;
    final pending = _restoring ??= _restoreSavedConnection();
    try {
      await pending;
    } finally {
      if (identical(_restoring, pending)) _restoring = null;
    }
  }

  Future<void> _restoreSavedConnection() async {
    try {
      final p = await SharedPreferences.getInstance();
      if (p.getString(_kKind) == null || p.getString(_kLocation) == null) return;
      await ensureInitialized();
      await _restoreLastConnection();
    } catch (e) {
      if (kDebugMode) debugPrint('StripeTerminal: restore failed: $e');
    }
  }

  /// Re-attach to whatever the operator last paired — Tap to Pay (just
  /// re-enable the built-in NFC) or a Bluetooth reader (discover by
  /// saved serial). Best-effort; silent on failure.
  Future<void> _restoreLastConnection() async {
    final p = await SharedPreferences.getInstance();
    final kind = p.getString(_kKind);
    final savedSerial = p.getString(_kSerial);
    if (kind == null || kind.isEmpty) return;
    if (_locationId == null || _locationId!.isEmpty) return;
    try {
      if (kind == 'tapToPay') {
        // Skip silently on unsupported devices (iPad, older iPhones).
        // Operator might have paired Tap to Pay on a sister iPhone — we
        // don't want to spam them with errors on every cold start when
        // this particular device can't support it.
        final supported = await probeTapToPaySupport();
        if (!supported) {
          if (kDebugMode) debugPrint('StripeTerminal: skipping Tap to Pay restore — device unsupported');
          return;
        }
        await enableTapToPay(merchantDisplayName: 'Stowbo');
        if (kDebugMode) debugPrint('StripeTerminal: restored Tap to Pay');
        return;
      }
      if (kind == 'bluetooth' && savedSerial != null && savedSerial.isNotEmpty) {
        if (kDebugMode) debugPrint('StripeTerminal: trying to restore M2 $savedSerial');
        // Stream discovers nearby readers; stop at the first batch that
        // contains our saved serial, OR after a short timeout if the M2
        // isn't around (powered off / not in BT range).
        final batch = await firstStreamMatch<List<Reader>>(
          _terminal!.discoverReaders(
            const BluetoothDiscoveryConfiguration(timeout: Duration(seconds: 15)),
          ),
          (batch) => batch.any((r) => r.serialNumber == savedSerial),
          timeout: const Duration(seconds: 15),
        );
        final reader = batch?.firstWhere((r) => r.serialNumber == savedSerial);
        if (reader != null) {
          await connectBluetooth(reader, locationId: _locationId);
          if (kDebugMode) debugPrint('StripeTerminal: restored M2 $savedSerial');
        } else if (kDebugMode) {
          debugPrint('StripeTerminal: saved M2 $savedSerial not found (powered off or out of range)');
        }
      }
    } catch (e) {
      if (kDebugMode) debugPrint('StripeTerminal: restore failed silently: $e');
    }
  }

  Future<String> _fetchConnectionToken() async {
    final response = await _http.post('/client/stowbo/host/terminal/connection-token');
    if (response is! Map) {
      throw Exception('Connection token: unexpected response shape');
    }
    final secret = response['secret']?.toString();
    if (secret == null || secret.isEmpty) {
      throw Exception('Connection token: server returned no secret');
    }
    return secret;
  }

  /// List the org's Stripe Terminal Locations. Operator picks one to
  /// register their reader against; we persist it for next time.
  Future<List<Location>> listLocations() async {
    await ensureInitialized();
    return await _terminal!.listLocations(limit: 50);
  }

  /// Resolve the approved host's owned listing and saved address on the server.
  /// Missing address fields must be completed on the listing before pairing.
  Future<String> ensureLocationForListing(String listingId) async {
    await ensureInitialized();
    final response = await _http.post(
      '/client/stowbo/host/terminal/location',
      body: {'listingId': listingId},
    );
    if (response is! Map) {
      throw Exception('ensureLocation: unexpected response shape');
    }
    final id = (response['id'] ?? '').toString();
    if (id.isEmpty) throw Exception('ensureLocation: server returned no location id');
    await setLocation(id);
    return id;
  }

  Future<void> setLocation(String locationId) async {
    _locationId = locationId;
    final p = await SharedPreferences.getInstance();
    await p.setString(_kLocation, locationId);
  }

  /// Stream the running list of discovered BLUETOOTH readers (M2, BBPOS,
  /// WisePad, etc). Cancels the subscription to stop discovery.
  Stream<List<Reader>> discoverBluetoothReaders({bool simulated = false}) async* {
    await ensureInitialized();
    yield* _terminal!.discoverReaders(
      BluetoothDiscoveryConfiguration(
        isSimulated: simulated,
        timeout: const Duration(seconds: 30),
      ),
    );
  }

  /// Discover Tap to Pay — uses the phone's built-in NFC. Emits a single
  /// list with the device's built-in reader (when supported). On iPhone
  /// requires iOS 16.4+ on iPhone XS+; on Android requires NFC + Android 11+.
  Stream<List<Reader>> discoverTapToPayReaders({bool simulated = false}) async* {
    await ensureInitialized();
    yield* _terminal!.discoverReaders(
      TapToPayDiscoveryConfiguration(isSimulated: simulated),
    );
  }

  /// Pair a Bluetooth reader (e.g. Stripe M2). Locks the reader to the
  /// selected Stripe Terminal Location so transactions report against the
  /// right venue in the Stripe dashboard.
  Future<Reader> connect(Reader reader, {String? locationId}) =>
      connectBluetooth(reader, locationId: locationId);

  Future<Reader> connectBluetooth(Reader reader, {String? locationId}) async {
    await ensureInitialized();
    final loc = locationId ?? _locationId;
    if (loc == null || loc.isEmpty) {
      throw Exception(
        'Choose a listing with a complete business address before pairing.',
      );
    }
    final connected = await _terminal!.connectReader(
      reader,
      configuration: BluetoothConnectionConfiguration(
        locationId: loc,
        autoReconnectOnUnexpectedDisconnect: true,
        readerDelegate: _ReaderDelegate(),
      ),
    );
    _connectedReader = connected;
    _connectionKind = 'bluetooth';
    _bumpConnection();
    final p = await SharedPreferences.getInstance();
    await p.setString(_kSerial, connected.serialNumber);
    await p.setString(_kKind, 'bluetooth');
    return connected;
  }

  /// Pair the device's built-in Tap-to-Pay reader. No external hardware
  /// needed — the operator can take card payments by tapping the phone.
  Future<Reader> connectTapToPay(
    Reader reader, {
    String? locationId,
    String? merchantDisplayName,
  }) async {
    await ensureInitialized();
    final loc = locationId ?? _locationId;
    if (loc == null || loc.isEmpty) {
      throw Exception(
        'Choose a listing with a complete business address before pairing.',
      );
    }
    final connected = await _terminal!.connectReader(
      reader,
      configuration: TapToPayConnectionConfiguration(
        locationId: loc,
        merchantDisplayName: merchantDisplayName,
        readerDelegate: _TapToPayDelegate(),
      ),
    );
    _connectedReader = connected;
    _connectionKind = 'tapToPay';
    _bumpConnection();
    final p = await SharedPreferences.getInstance();
    await p.setString(_kSerial, connected.serialNumber);
    await p.setString(_kKind, 'tapToPay');
    return connected;
  }

  /// Cached "this device can do Tap to Pay" probe. Apple Tap to Pay is
  /// iPhone-only (XS+ / iOS 16.4+) — iPads return
  /// `unsupportedMobileDeviceConfiguration` from the SDK. We probe once
  /// per session so the UI can hide the Tap to Pay chip when it's not
  /// available, instead of showing it and erroring at charge time.
  bool? _tapToPaySupported;
  bool? get tapToPaySupported => _tapToPaySupported;

  /// Probe support without prompting the operator. Subsequent calls
  /// return the cached result. Returns false on platforms where the
  /// SDK rejects Tap to Pay discovery for any reason (iPad, old iOS,
  /// missing entitlement, etc.).
  Future<bool> probeTapToPaySupport() async {
    if (_tapToPaySupported != null) return _tapToPaySupported!;
    await ensureInitialized();
    try {
      // The discover stream emits empty/errors immediately on unsupported
      // devices. Pull one batch with a tight timeout.
      final batch = await firstStreamMatch<List<Reader>>(
        _terminal!.discoverReaders(const TapToPayDiscoveryConfiguration()),
        (batch) => batch.isNotEmpty,
        timeout: const Duration(seconds: 3),
      );
      _tapToPaySupported = batch != null;
    } catch (_) {
      _tapToPaySupported = false;
    }
    return _tapToPaySupported!;
  }

  /// One-shot Tap to Pay enablement. No separate "Scan / Enable" UX needed
  /// for the device's built-in reader — the SDK discovers exactly one
  /// reader (this phone), using the location resolved from the host listing.
  ///
  /// Throws a clear message when the device doesn't support Tap to Pay
  /// (iPads, older iPhones) or no Stripe Terminal Locations exist.
  Future<bool> enableTapToPay({String? merchantDisplayName}) async {
    await ensureInitialized();
    if (_terminal == null) throw Exception('Stripe Terminal SDK init failed.');
    if (isTapToPay && isConnected) return true;
    // Different reader paired (e.g. an M2) — disconnect first.
    if (isConnected) await disconnect();
    final locId = _locationId;
    if (locId == null || locId.isEmpty) {
      throw Exception('Choose a listing with a complete business address before taking a card payment.');
    }
    // Discover — emits a single batch with the built-in reader (if
    // supported). On iPad / older devices the SDK either emits empty or
    // throws TerminalExceptionCode.unsupportedMobileDeviceConfiguration.
    Reader? reader;
    try {
      final batch = await firstStreamMatch<List<Reader>>(
        _terminal!.discoverReaders(const TapToPayDiscoveryConfiguration()),
        (batch) => batch.isNotEmpty,
        timeout: const Duration(seconds: 30),
      );
      reader = batch?.first;
    } catch (e) {
      _tapToPaySupported = false;
      throw Exception(
        'Tap to Pay isn\'t available on this device. '
        'It requires an iPhone XS or newer running iOS 16.4+. '
        'Pair a Stripe M2 reader instead — both work with Apple Pay, '
        'tap-to-pay cards, and swipe.',
      );
    }
    if (reader == null) {
      _tapToPaySupported = false;
      throw Exception(
        'Tap to Pay isn\'t available on this device. '
        'It requires an iPhone XS or newer running iOS 16.4+. '
        'Pair a Stripe M2 reader instead.',
      );
    }
    _tapToPaySupported = true;
    await connectTapToPay(
      reader,
      locationId: locId,
      merchantDisplayName: merchantDisplayName ?? 'Appmint',
    );
    return true;
  }

  Future<void> disconnect() async {
    if (_terminal == null) return;
    try {
      await _terminal!.disconnectReader();
    } catch (_) {}
    _connectedReader = null;
    _connectionKind = null;
    final p = await SharedPreferences.getInstance();
    await p.remove(_kSerial);
    await p.remove(_kKind);
    _bumpConnection();
  }

  /// Take a payment via the connected reader. Returns the PaymentIntent
  /// id on success — caller passes that to /pos/tab/:id/settle as the
  /// `ref` with `gateway: 'stripe'`.
  Future<String> takePayment({
    required num amount,
    required String currency,
    String? bookingId,
    String? category,
    String? email,
    String? description,
  }) async {
    await ensureInitialized();
    if (_terminal == null) throw Exception('Stripe Terminal not initialized.');
    if (_connectedReader == null) {
      throw Exception(
        'No reader connected. Pair an M2 or enable Tap to Pay in Settings → Payments.',
      );
    }

    // 1. Server creates the card_present PaymentIntent.
    final response = await _http.post(
      '/client/stowbo/host/terminal/intent',
      body: {
        'amount': amount,
        'currency': currency.toLowerCase(),
        if (bookingId != null && bookingId.isNotEmpty) 'bookingId': bookingId,
        if (category != null) 'category': category,
        if (email != null && email.isNotEmpty) 'email': email,
        if (description != null && description.isNotEmpty) 'description': description,
      },
    );
    if (response is! Map) {
      throw Exception('Terminal intent: unexpected response');
    }
    final clientSecret = (response['client_secret'] ?? response['clientSecret'])?.toString();
    if (clientSecret == null || clientSecret.isEmpty) {
      throw Exception('Terminal intent: server returned no client_secret');
    }

    // 2. Retrieve PI on SDK side, collect via reader, confirm.
    final pi = await _terminal!.retrievePaymentIntent(clientSecret);
    final collected = await _terminal!.collectPaymentMethod(pi);
    final confirmed = await _terminal!.confirmPaymentIntent(collected);
    return confirmed.id;
  }
}

/// Snapshot of a reader-firmware install in progress. Surfaced via
/// [StripeTerminalService.updateProgress] so the pairing UI can render a
/// progress bar + estimated time instead of the operator staring at a
/// vague spinner during a long firmware update.
class ReaderUpdate {
  final double progress; // 0.0 – 1.0
  /// 'installing' | 'finished'
  final String phase;
  final String? errorMessage;
  const ReaderUpdate({
    required this.progress,
    required this.phase,
    this.errorMessage,
  });
}

/// Forwards reader lifecycle events to a callback so we can pipe them
/// into [StripeTerminalService.updateProgress] from outside this file.
class _ReaderDelegate extends MobileReaderDelegate {
  @override
  void onReportAvailableUpdate(ReaderSoftwareUpdate update) {
    if (kDebugMode) debugPrint('StripeTerminal: reader update available');
    stripeTerminalService.updateProgress.value =
        const ReaderUpdate(progress: 0, phase: 'installing');
  }

  @override
  void onStartInstallingUpdate(ReaderSoftwareUpdate update, Cancellable cancelUpdate) {
    if (kDebugMode) debugPrint('StripeTerminal: installing reader update');
    stripeTerminalService.updateProgress.value =
        const ReaderUpdate(progress: 0, phase: 'installing');
  }

  @override
  void onReportReaderSoftwareUpdateProgress(double progress) {
    if (kDebugMode) {
      debugPrint(
          'StripeTerminal: reader update progress ${(progress * 100).toStringAsFixed(0)}%');
    }
    stripeTerminalService.updateProgress.value =
        ReaderUpdate(progress: progress, phase: 'installing');
  }

  @override
  void onFinishInstallingUpdate(ReaderSoftwareUpdate? update, TerminalException? exception) {
    if (kDebugMode) {
      debugPrint('StripeTerminal: reader update finished — ${exception?.message ?? 'ok'}');
    }
    stripeTerminalService.updateProgress.value = ReaderUpdate(
      progress: 1,
      phase: 'finished',
      errorMessage: exception?.message,
    );
    // Clear after a brief delay so the UI can show the "done" state
    // before reverting to the regular pairing spinner.
    Future.delayed(const Duration(seconds: 1), () {
      stripeTerminalService.updateProgress.value = null;
    });
  }

  @override
  void onRequestReaderInput(List<ReaderInputOption> options) {
    if (kDebugMode) debugPrint('StripeTerminal: reader requests input — $options');
  }

  @override
  void onRequestReaderDisplayMessage(ReaderDisplayMessage message) {
    if (kDebugMode) debugPrint('StripeTerminal: reader display — $message');
  }
}

/// Delegate for Tap to Pay (built-in NFC) — emits reader-input prompts
/// (the "Tap card" moment) and disconnect/reconnect events.
class _TapToPayDelegate extends TapToPayReaderDelegate {
  @override
  void onRequestReaderInput(List<ReaderInputOption> options) {
    if (kDebugMode) debugPrint('TapToPay: input requested — $options');
  }

  @override
  void onRequestReaderDisplayMessage(ReaderDisplayMessage message) {
    if (kDebugMode) debugPrint('TapToPay: display — $message');
  }

  @override
  void onStartInstallingUpdate(ReaderSoftwareUpdate update, Cancellable cancelUpdate) {
    if (kDebugMode) debugPrint('TapToPay: installing reader update');
  }

  @override
  void onReportReaderSoftwareUpdateProgress(double progress) {
    if (kDebugMode) {
      debugPrint('TapToPay: update progress ${(progress * 100).toStringAsFixed(0)}%');
    }
  }

  @override
  void onFinishInstallingUpdate(ReaderSoftwareUpdate? update, TerminalException? exception) {
    if (kDebugMode) {
      debugPrint('TapToPay: update finished — ${exception?.message ?? 'ok'}');
    }
  }
}

final stripeTerminalService = StripeTerminalService();
