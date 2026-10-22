import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'http_client.dart';
import '../config/environment.dart';

/// Stripe Terminal SDK wrapper for card-present payments via BLE readers
/// like the Stripe M2.
///
/// Lifecycle:
///   1. ensureInitialized() — happens on first use. Asks the SDK for a
///      connection token via our backend (/storefront/stripe/terminal/
///      connection-token). The SDK then caches the token and rotates as
///      needed.
///   2. listLocations() — pick a Stripe Terminal Location to register the
///      reader against (each org has 1+ in their Stripe dashboard).
///   3. startDiscovery() — listens on the SDK's discoverReaders stream.
///   4. connectReader(reader, locationId) — pair a specific reader. The
///      paired reader's serial is persisted so the next session can
///      auto-reconnect.
///   5. takePayment(amount, currency, ...) — full charge flow:
///         a. POST /storefront/stripe/terminal/intent → client_secret
///         b. retrievePaymentIntent(clientSecret) on SDK
///         c. collectPaymentMethod(pi) → reader prompts "tap"
///         d. confirmPaymentIntent(pi) → submit to Stripe
///         e. returns PaymentIntent.id for tab.settle ref
///
/// Failures bubble up as exceptions so the caller (Settle sheet) can
/// surface them in the inline error UI.
class StripeTerminalService {
  static bool get simulatorEnabled =>
      kDebugMode &&
      const bool.fromEnvironment('APPMINT_TERMINAL_SIMULATOR') &&
      [
        'localhost',
        '127.0.0.1',
        '10.0.2.2',
      ].contains(Uri.parse(EnvironmentConfig.appengineEndpoint).host);
  static final StripeTerminalService _instance = StripeTerminalService._();
  factory StripeTerminalService() => _instance;
  StripeTerminalService._();

  final AppengineHttpClient _http = appengineHttpClient;

  bool _initialized = false;
  Future<void>? _initializing;
  Future<void>? _restoring;
  bool _discovering = false;
  bool _autoReconnectPaused = false;
  Terminal? _terminal;
  Reader? _connectedReader;

  /// Surfaces firmware-update progress to UI listeners while a reader is
  /// being paired. The first-time pair on an M2 can take 30–90s if a
  /// firmware update is pending — without showing the progress the
  /// operator thinks the app is hung. UI binds with ValueListenable.
  final ValueNotifier<ReaderUpdate?> updateProgress =
      ValueNotifier<ReaderUpdate?>(null);

  /// Which kind of reader is currently active. Drives the right
  /// disconnect / display path. 'bluetooth' = M2 / BBPOS-style external,
  /// 'tapToPay' = the phone's built-in NFC (Tap to Pay on iPhone / Android).
  String? _connectionKind;
  String? _locationId;
  String? _bindingOrgId;
  String? _bindingBusinessId;
  String? _bindingRecordId;
  static const _kBindingOrg = 'stripe_terminal_org';
  static const _kBindingBusiness = 'stripe_terminal_business_location';
  static const _kBindingRecord = 'stripe_terminal_location_record';

  bool isBoundToBusinessLocation(String businessLocationId) =>
      businessLocationId.isNotEmpty &&
      _bindingOrgId == _http.orgId &&
      _bindingBusinessId == businessLocationId &&
      _locationId != null;

  Future<void> clearBusinessLocationBinding() async {
    _bindingOrgId = null;
    _bindingBusinessId = null;
    _bindingRecordId = null;
    _locationId = null;
    await disconnect();
    await _terminal?.clearCachedCredentials();
    final prefs = await SharedPreferences.getInstance();
    for (final key in [
      _kBindingOrg,
      _kBindingBusiness,
      _kBindingRecord,
      _kLocation,
      _kSerial,
      _kKind,
    ]) {
      await prefs.remove(key);
    }
    connectionRevision.value++;
  }

  // Persisted prefs — last paired reader's serial + chosen Stripe Location.
  static const _kSerial = 'stripe_terminal_reader_serial';
  static const _kLocation = 'stripe_terminal_location_id';
  static const _kKind = 'stripe_terminal_connection_kind';

  Reader? get connectedReader => _connectedReader;
  String? get connectionKind => _connectionKind;
  String? get locationId => _locationId;
  bool get isInitialized => _initialized;

  /// The SDK's own view of the link, kept live by [_watchConnectionStatus].
  ///
  /// `_connectedReader != null` alone is a cached flag: it is set once on a
  /// successful connect and cleared only on an explicit disconnect. A reader
  /// that is powered off, out of range or dropped by the SDK left the app
  /// still claiming "connected" — and then the payment fails with no
  /// explanation. Both have to agree before we say connected.
  ConnectionStatus _status = ConnectionStatus.notConnected;
  StreamSubscription<ConnectionStatus>? _statusSub;

  bool get isConnected =>
      _connectedReader != null && _status == ConnectionStatus.connected;

  /// Notified whenever the link comes up or goes down, so screens showing a
  /// "connected" badge can repaint instead of going stale.
  final ValueNotifier<int> connectionRevision = ValueNotifier<int>(0);

  void _watchConnectionStatus() {
    _statusSub ??= _terminal?.onConnectionStatusChange.listen((s) {
      _status = s;
      if (s == ConnectionStatus.notConnected) {
        // The reader is gone. Drop the cached object too, or the next
        // isConnected check compares a stale reader against a fresh status.
        _connectedReader = null;
        _connectionKind = null;
      }
      connectionRevision.value++;
    });
  }

  /// Ask the SDK directly, for the moments that matter (before taking a
  /// payment, when a screen opens) rather than trusting the cached flag.
  Future<bool> verifyConnected() async {
    if (_terminal == null) return false;
    try {
      _status = await _terminal!.getConnectionStatus();
      if (_status == ConnectionStatus.connected) {
        _connectedReader = await _terminal!.getConnectedReader();
        _connectionKind = _connectedReader?.deviceType == DeviceType.tapToPay
            ? 'tapToPay'
            : 'bluetooth';
        connectionRevision.value++;
      }
    } catch (_) {
      return false;
    }
    if (_status != ConnectionStatus.connected) {
      _connectedReader = null;
      _connectionKind = null;
      connectionRevision.value++;
      return false;
    }
    return _connectedReader != null;
  }

  bool get isTapToPay => _connectionKind == 'tapToPay';

  /// Initialize the SDK exactly once. Subsequent calls are no-ops.
  Future<void> ensureInitialized() {
    if (_initialized) return Future.value();
    return _initializing ??= _initialize().whenComplete(
      () => _initializing = null,
    );
  }

  Future<void> _initialize() async {
    try {
      await Terminal.initTerminal(
        shouldPrintLogs: kDebugMode,
        fetchToken: _fetchConnectionToken,
      );
      _terminal = Terminal.instance;
      _watchConnectionStatus();
      // Restore saved location id so the operator doesn't have to re-pick.
      final p = await SharedPreferences.getInstance();
      _locationId = p.getString(_kLocation);
      _bindingOrgId = p.getString(_kBindingOrg);
      _bindingBusinessId = p.getString(_kBindingBusiness);
      _bindingRecordId = p.getString(_kBindingRecord);
      if (_bindingOrgId != _http.orgId ||
          _bindingRecordId != p.getString('location_selected_id')) {
        await clearBusinessLocationBinding();
      }
      _initialized = true;
    } catch (e) {
      if (kDebugMode) debugPrint('StripeTerminalService.init failed: $e');
      rethrow;
    }
  }

  Future<void> reconnectSaved() {
    return _restoring ??= _reconnectSaved().whenComplete(
      () => _restoring = null,
    );
  }

  Future<void> _reconnectSaved() async {
    if (_autoReconnectPaused || _discovering) return;
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getString(_kKind) == null ||
        prefs.getString(_kBindingOrg) != _http.orgId ||
        prefs.getString(_kBindingRecord) !=
            prefs.getString('location_selected_id'))
      return;
    await ensureInitialized();
    if (await verifyConnected() ||
        _status == ConnectionStatus.connecting ||
        _discovering)
      return;
    await _restoreLastConnection();
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
    if (!isBoundToBusinessLocation(_bindingBusinessId ?? '') ||
        _bindingRecordId != p.getString('location_selected_id'))
      return;
    try {
      if (kind == 'tapToPay') {
        // Skip silently on unsupported devices (iPad, older iPhones).
        // Operator might have paired Tap to Pay on a sister iPhone — we
        // don't want to spam them with errors on every cold start when
        // this particular device can't support it.
        final supported = await probeTapToPaySupport();
        if (!supported) {
          if (kDebugMode)
            debugPrint(
              'StripeTerminal: skipping Tap to Pay restore — device unsupported',
            );
          return;
        }
        await enableTapToPay(merchantDisplayName: 'Appmint');
        if (kDebugMode) debugPrint('StripeTerminal: restored Tap to Pay');
        return;
      }
      if (kind == 'bluetooth' &&
          savedSerial != null &&
          savedSerial.isNotEmpty) {
        if (kDebugMode)
          debugPrint('StripeTerminal: trying to restore M2 $savedSerial');
        // Stream discovers nearby readers; stop at the first batch that
        // contains our saved serial, OR after a short timeout if the M2
        // isn't around (powered off / not in BT range).
        // NO `timeout:` — see discoverBluetoothReaders below. Passing one
        // kills the stream before it starts. The `.timeout()` on the future
        // underneath already bounds how long this waits.
        final found = Completer<Reader?>();
        _discovering = true;
        final subscription = _terminal!
            .discoverReaders(
              BluetoothDiscoveryConfiguration(isSimulated: simulatorEnabled),
            )
            .listen(
              (batch) {
                for (final reader in batch) {
                  if (reader.serialNumber == savedSerial &&
                      !found.isCompleted) {
                    found.complete(reader);
                  }
                }
              },
              onError: (Object error, StackTrace stack) {
                if (!found.isCompleted) found.completeError(error, stack);
              },
              onDone: () {
                if (!found.isCompleted) found.complete(null);
              },
            );
        Reader? reader;
        try {
          reader = await found.future.timeout(
            const Duration(seconds: 15),
            onTimeout: () => null,
          );
        } finally {
          await subscription.cancel();
          _discovering = false;
        }
        if (_autoReconnectPaused ||
            !isBoundToBusinessLocation(_bindingBusinessId ?? ''))
          return;
        if (reader != null) {
          await connectBluetooth(reader, locationId: _locationId);
          if (kDebugMode)
            debugPrint('StripeTerminal: restored M2 $savedSerial');
        } else if (kDebugMode) {
          debugPrint(
            'StripeTerminal: saved M2 $savedSerial not found (powered off or out of range)',
          );
        }
      }
    } catch (e) {
      if (kDebugMode) debugPrint('StripeTerminal: restore failed silently: $e');
    }
  }

  Future<String> _fetchConnectionToken() async {
    final response = await _http.post(
      '/storefront/stripe/terminal/connection-token',
    );
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

  /// Server-side find-or-create — given a business location id from our
  /// system, the backend looks up the org's authoritative location record
  /// (title + address) and either returns an existing matching Stripe
  /// Terminal Location or creates one. Operators never need to leave the
  /// app to set up Stripe Locations.
  ///
  /// Throws if the org's location record is missing required address
  /// fields — the error message lists exactly what to fix.
  Future<String> ensureLocationForBusinessLocation(
    String businessLocationId,
  ) async {
    await ensureInitialized();
    final prefs = await SharedPreferences.getInstance();
    final recordId = prefs.getString('location_selected_id');
    if (businessLocationId.isEmpty || recordId == null || recordId.isEmpty) {
      throw StateError('Assign this device to a business location first.');
    }
    if (!isBoundToBusinessLocation(businessLocationId)) {
      await clearBusinessLocationBinding();
    }
    final requestedOrg = _http.orgId;
    final response = await _http.post(
      '/storefront/stripe/terminal/location/ensure',
      body: {'businessLocationId': businessLocationId},
    );
    if (response is! Map) {
      throw Exception('ensureLocation: unexpected response shape');
    }
    final id = (response['id'] ?? '').toString();
    if (id.isEmpty)
      throw Exception('ensureLocation: server returned no location id');
    if (_http.orgId != requestedOrg ||
        prefs.getString('location_selected_id') != recordId) {
      throw StateError('Business location changed during setup. Try again.');
    }
    await setLocation(id);
    _bindingOrgId = requestedOrg;
    _bindingBusinessId = businessLocationId;
    _bindingRecordId = recordId;
    await prefs.setString(_kBindingOrg, _bindingOrgId!);
    await prefs.setString(_kBindingBusiness, businessLocationId);
    await prefs.setString(_kBindingRecord, recordId);
    return id;
  }

  Future<void> setLocation(String locationId) async {
    _locationId = locationId;
    final p = await SharedPreferences.getInstance();
    await p.setString(_kLocation, locationId);
  }

  /// Stream the running list of discovered BLUETOOTH readers (M2, BBPOS,
  /// WisePad, etc). Cancels the subscription to stop discovery.
  Stream<List<Reader>> discoverBluetoothReaders({
    bool simulated = false,
  }) async* {
    await ensureInitialized();
    // Do NOT pass `timeout:`. mek_stripe_terminal's Android side reads it as
    // `serialized[1] as Long?`, but Flutter's codec encodes any int that fits
    // in 32 bits as an Integer — so the cast always throws:
    //
    //   Failed to open event stream
    //   java.lang.ClassCastException: java.lang.Integer cannot be cast to java.lang.Long
    //
    // The stream then dies before a single scan happens, and the UI just shows
    // an empty reader list for ever with no error. The parameter is optional;
    // omitting it leaves the value null, which casts fine.
    await _restoring;
    _discovering = true;
    try {
      yield* _terminal!.discoverReaders(
        BluetoothDiscoveryConfiguration(
          isSimulated: simulated || simulatorEnabled,
        ),
      );
    } finally {
      _discovering = false;
    }
  }

  /// Discover Tap to Pay — uses the phone's built-in NFC. Emits a single
  /// list with the device's built-in reader (when supported). On iPhone
  /// requires iOS 16.4+ on iPhone XS+; on Android requires NFC + Android 11+.
  Stream<List<Reader>> discoverTapToPayReaders({
    bool simulated = false,
  }) async* {
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
    if (!isBoundToBusinessLocation(_bindingBusinessId ?? '')) {
      throw StateError(
        'Configure the card terminal through Business location first.',
      );
    }
    final loc = locationId ?? _locationId;
    if (loc == null || loc.isEmpty) {
      throw Exception(
        'No Stripe Terminal location selected. Pick one from listLocations() first.',
      );
    }
    _autoReconnectPaused = false;
    final bindingOrg = _bindingOrgId;
    final bindingBusiness = _bindingBusinessId;
    final connected = await _terminal!.connectReader(
      reader,
      configuration: BluetoothConnectionConfiguration(
        locationId: loc,
        autoReconnectOnUnexpectedDisconnect: true,
        readerDelegate: _ReaderDelegate(),
      ),
    );
    if (_bindingOrgId != bindingOrg ||
        _bindingBusinessId != bindingBusiness ||
        _locationId != loc ||
        _http.orgId != bindingOrg) {
      await _terminal!.disconnectReader();
      throw StateError(
        'Business location changed while connecting. Reopen location settings.',
      );
    }
    _connectedReader = connected;
    _connectionKind = 'bluetooth';
    _status = ConnectionStatus.connected;
    _watchConnectionStatus();
    connectionRevision.value++;
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
    if (!isBoundToBusinessLocation(_bindingBusinessId ?? '')) {
      throw StateError(
        'Configure the card terminal through Business location first.',
      );
    }
    final bindingOrg = _bindingOrgId;
    final bindingBusiness = _bindingBusinessId;
    final loc = locationId ?? _locationId;
    if (loc == null || loc.isEmpty) {
      throw Exception(
        'No Stripe Terminal location selected. Pick one from listLocations() first.',
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
    if (_bindingOrgId != bindingOrg ||
        _bindingBusinessId != bindingBusiness ||
        _locationId != loc ||
        _http.orgId != bindingOrg) {
      await _terminal!.disconnectReader();
      throw StateError(
        'Business location changed while connecting. Try again.',
      );
    }
    _autoReconnectPaused = false;
    _connectedReader = connected;
    _connectionKind = 'tapToPay';
    _status = ConnectionStatus.connected;
    _watchConnectionStatus();
    connectionRevision.value++;
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
      await _terminal!
          .discoverReaders(TapToPayDiscoveryConfiguration(isSimulated: false))
          .first
          .timeout(const Duration(seconds: 3));
      _tapToPaySupported = true;
    } catch (_) {
      _tapToPaySupported = false;
    }
    return _tapToPaySupported!;
  }

  /// One-shot Tap to Pay enablement. No separate "Scan / Enable" UX needed
  /// for the device's built-in reader — the SDK discovers exactly one
  /// reader (this phone) so we just init, pick a Stripe Terminal Location
  /// (saved one if present, else the first one), discover, and connect.
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
    if (locId == null || !isBoundToBusinessLocation(_bindingBusinessId ?? '')) {
      throw StateError(
        'Set up payments in Business location before enabling Tap to Pay.',
      );
    }
    // Discover — emits a single batch with the built-in reader (if
    // supported). On iPad / older devices the SDK either emits empty or
    // throws TerminalExceptionCode.unsupportedMobileDeviceConfiguration.
    Reader? reader;
    try {
      reader = await _terminal!
          .discoverReaders(TapToPayDiscoveryConfiguration(isSimulated: false))
          .firstWhere(
            (batch) => batch.isNotEmpty,
            orElse: () => const <Reader>[],
          )
          .then((batch) => batch.isEmpty ? null : batch.first);
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

  Future<void> disconnect({bool forget = false}) async {
    _autoReconnectPaused = true;
    if (forget) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kSerial);
      await prefs.remove(_kKind);
    }
    if (_terminal == null) return;
    try {
      await _terminal!.disconnectReader();
    } catch (_) {}
    _connectedReader = null;
    _connectionKind = null;
    _status = ConnectionStatus.notConnected;
    connectionRevision.value++;
  }

  /// Collect the server-priced event sale using its persistent payment intent.
  Future<String> takeEventPayment({
    required String saleId,
    required String businessLocationId,
    bool simulateDecline = false,
  }) async {
    await ensureInitialized();
    if (!isBoundToBusinessLocation(businessLocationId)) {
      throw StateError(
        'Connect the card terminal for this business location first.',
      );
    }
    final result = await _http.post(
      '/events/sales/$saleId/intent',
      body: {'businessLocationId': businessLocationId},
    );
    if (result is! Map || result['id'] == null)
      throw StateError('Payment reference missing.');
    if (simulatorEnabled && result['livemode'] != false)
      throw StateError('Simulator checkout requires Stripe test mode.');
    if (result['status'] == 'succeeded') return '${result['id']}';
    if ([
      'processing',
      'requires_capture',
      'canceled',
    ].contains(result['status'])) {
      throw StateError(
        'Payment is ${result['status']}. Review this payment before trying again.',
      );
    }
    if (!await verifyConnected())
      throw StateError('Reconnect the reader, then resume this checkout.');
    if (simulatorEnabled) {
      await _terminal!.setSimulatorConfiguration(
        SimulatorConfiguration(
          update: SimulateReaderUpdate.none,
          // 4.4.0 takes the card type positionally.
          simulatedCard: SimulatedCard.fromType(simulateDecline
              ? SimulatedCardType.chargeDeclinedInsufficientFunds
              : SimulatedCardType.visa),
        ),
      );
    }
    final intent = await _terminal!.retrievePaymentIntent(
      '${result['client_secret']}',
    );
    // 4.4.0 splits processPaymentIntent into collect then confirm.
    final collected = await _terminal!.collectPaymentMethod(intent);
    return (await _terminal!.confirmPaymentIntent(collected)).id;
  }

  Future<String> takePayment({
    required num amount,
    required num tip,
    required String attemptId,
    String? existingIntentId,
    required Future<void> Function(String) onIntentCreated,
    required String currency,
    required String businessLocationId,
    String? orderId,
    String? email,
    String? description,
  }) async {
    await ensureInitialized();
    if (!isBoundToBusinessLocation(businessLocationId)) {
      throw StateError(
        'The card terminal belongs to a different business location. Connect it from this location’s settings.',
      );
    }
    if (_terminal == null) throw Exception('Stripe Terminal not initialized.');
    final response = existingIntentId != null
        ? await _http.post(
            '/storefront/stripe/terminal/payment-status',
            body: {
              'paymentIntentId': existingIntentId,
              'orderId': orderId,
              'amount': amount,
              'tip': tip,
              'currency': currency,
              'businessLocationId': businessLocationId,
            },
          )
        : await _http.post(
            '/storefront/stripe/terminal/intent',
            body: {
              'amount': amount,
              'tip': tip,
              'attemptId': attemptId,
              'businessLocationId': businessLocationId,
              'currency': currency.toLowerCase(),
              if (orderId != null) 'orderId': orderId,
              if (email != null && email.isNotEmpty) 'email': email,
              if (description != null) 'description': description,
            },
          );
    if (response is! Map) {
      throw Exception('Terminal intent: unexpected response');
    }
    final intentId = response['id']?.toString();
    if (intentId == null || intentId.isEmpty)
      throw StateError('Payment reference missing.');
    await onIntentCreated(intentId);
    if (response['status'] == 'succeeded') return intentId;
    if (response['status'] == 'processing' ||
        response['status'] == 'requires_capture') {
      throw StateError(
        'This payment is still pending at Stripe. Do not charge again.',
      );
    }
    if (response['status'] == 'canceled') {
      throw StateError(
        'This payment was canceled. Review it before starting another payment.',
      );
    }
    if (!await verifyConnected()) {
      throw StateError('Reconnect the card reader, then resume this payment.');
    }
    final clientSecret = (response['client_secret'] ?? response['clientSecret'])
        ?.toString();
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
    stripeTerminalService.updateProgress.value = const ReaderUpdate(
      progress: 0,
      phase: 'installing',
    );
  }

  @override
  void onStartInstallingUpdate(
    ReaderSoftwareUpdate update,
    Cancellable cancelUpdate,
  ) {
    if (kDebugMode) debugPrint('StripeTerminal: installing reader update');
    stripeTerminalService.updateProgress.value = const ReaderUpdate(
      progress: 0,
      phase: 'installing',
    );
  }

  @override
  void onReportReaderSoftwareUpdateProgress(double progress) {
    if (kDebugMode) {
      debugPrint(
        'StripeTerminal: reader update progress ${(progress * 100).toStringAsFixed(0)}%',
      );
    }
    stripeTerminalService.updateProgress.value = ReaderUpdate(
      progress: progress,
      phase: 'installing',
    );
  }

  @override
  void onFinishInstallingUpdate(
    ReaderSoftwareUpdate? update,
    TerminalException? exception,
  ) {
    if (kDebugMode) {
      debugPrint(
        'StripeTerminal: reader update finished — ${exception?.message ?? 'ok'}',
      );
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
    if (kDebugMode)
      debugPrint('StripeTerminal: reader requests input — $options');
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
  void onStartInstallingUpdate(
    ReaderSoftwareUpdate update,
    Cancellable cancelUpdate,
  ) {
    if (kDebugMode) debugPrint('TapToPay: installing reader update');
  }

  @override
  void onReportReaderSoftwareUpdateProgress(double progress) {
    if (kDebugMode) {
      debugPrint(
        'TapToPay: update progress ${(progress * 100).toStringAsFixed(0)}%',
      );
    }
  }

  @override
  void onFinishInstallingUpdate(
    ReaderSoftwareUpdate? update,
    TerminalException? exception,
  ) {
    if (kDebugMode) {
      debugPrint('TapToPay: update finished — ${exception?.message ?? 'ok'}');
    }
  }
}

final stripeTerminalService = StripeTerminalService();
