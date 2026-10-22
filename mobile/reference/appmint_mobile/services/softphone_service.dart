import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show MethodChannel;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:twilio_voice/twilio_voice.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'client_info_service.dart';
import 'http_client.dart';
import 'storage_service.dart';

/// Softphone / Twilio device registration lifecycle.
/// See /Users/imzee/projects/appengine/src/phone/SOFTPHONE_UI_INTEGRATION.md
///
/// Flow:
///   1. On login → [registerDevice] generates a stable deviceId (persisted in
///      storage), POSTs to /phone/voice/register-device with capabilities
///      ['voice', 'sms'], stores the returned Twilio access token + assigned
///      phone numbers, and starts a 60s heartbeat timer.
///   2. While alive → heartbeat keeps the 90s backend TTL alive.
///   3. On logout / dispose → [unregisterDevice] beacons the backend and
///      stops the heartbeat. Other devices the user has registered stay live.
///   4. `tokenWillExpire` handling: re-call [registerDevice] with the same
///      deviceId to refresh the token — backend TTL resets at the same time.
class SoftphoneService {
  static final SoftphoneService _instance = SoftphoneService._internal();
  factory SoftphoneService() => _instance;
  SoftphoneService._internal();

  final AppengineHttpClient _http = appengineHttpClient;
  final StorageService _storage = StorageService();
  static const _deviceIdKey = 'phone_device_id';
  // Persisted "Go offline" choice — stays off across restarts until Go online.
  static const _offlineKey = 'softphone_user_offline';

  String? _deviceId;
  String? _identity;
  String? _token;
  int? expiresIn;
  List<String> _capabilities = const [];
  List<Map<String, dynamic>> _assignedPhones = const [];
  Timer? _heartbeatTimer;
  bool _registered = false;

  /// The org the NATIVE Twilio Voice Device is currently bound to. Voice
  /// identities are org-scoped on the server (`user:<orgId>:<email>`), so a
  /// Device bound to org A will not receive org B's calls. We track the bound
  /// org here and force a clean re-bind (unregister → setTokens) whenever it
  /// changes — including the first bind after launch, which clears any stale
  /// registration left by a prior session that used the old bare `user:<email>`.
  String? _nativeBoundOrg;

  // Callbacks — UI hooks
  void Function(String token, List<Map<String, dynamic>> assignedPhones)? onRegistered;
  void Function(String newToken)? onTokenRefreshed;
  void Function(String error)? onError;

  String? get deviceId => _deviceId;
  String? get identity => _identity;
  String? get token => _token;
  List<String> get capabilities => _capabilities;
  List<Map<String, dynamic>> get assignedPhones => _assignedPhones;
  bool get isRegistered => _registered;

  /// Get or create a stable deviceId. Persisted in storage so it survives
  /// app restarts — matches Twilio's "one Device per identity per install"
  /// constraint.
  Future<String> getOrCreateDeviceId() async {
    if (_deviceId != null && _deviceId!.isNotEmpty) return _deviceId!;
    final stored = await _storage.getSetting(_deviceIdKey);
    if (stored is String && stored.isNotEmpty) {
      _deviceId = stored;
      return stored;
    }
    // Generate a reasonably-unique id without adding a uuid dependency
    final rand = Random.secure();
    final bytes = List<int>.generate(16, (_) => rand.nextInt(256));
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    final ts = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    final id = '$ts-$hex';
    await _storage.saveSetting(_deviceIdKey, id);
    _deviceId = id;
    return id;
  }

  /// Register this device with the backend and receive a Twilio access token.
  /// Safe to call repeatedly — re-registering with the same deviceId refreshes
  /// the token AND the backend presence TTL.
  ///
  /// `platform` defaults to the runtime OS so the backend can attach the
  /// matching Push Credential SID (FCM for Android, APN for iOS) to the
  /// VoiceGrant. Pass an explicit value only for tests.
  Future<Map<String, dynamic>?> registerDevice({
    String? platform,
    String? label,
    List<String> capabilities = const ['voice', 'sms'],
    bool force = false,
  }) async {
    try {
      // "Go offline" (closed for business) must STICK: the app auto-registers on
      // login, token refresh, opening the dialer, etc. Unless this is an explicit
      // go-online (force), honor the persisted offline choice and stay off.
      if (!force && await isUserOffline()) {
        if (kDebugMode) debugPrint('📴 Softphone: user is offline — skipping registration');
        return null;
      }
      final id = await getOrCreateDeviceId();
      final resolvedPlatform = platform ?? _detectPlatform();
      if (kDebugMode) debugPrint('📞 Softphone: POST /phone/voice/register-device deviceId=$id platform=$resolvedPlatform caps=$capabilities');
      final response = await _http.post('/phone/voice/register-device', body: {
        'deviceId': id,
        'platform': resolvedPlatform,
        // iOS: the APNs environment this build is code-signed for, read from the
        // provisioning profile (App Store → production, dev → sandbox). Lets the
        // backend attach the matching Twilio Push Credential automatically — no
        // manual sandbox/prod flag flipping.
        if (resolvedPlatform == 'ios')
          'apnsEnvironment': await _apnsEnvironment(),
        if (label != null) 'label': label,
        'capabilities': capabilities,
        // Attach device/app telemetry — server mirrors web RequestInfo
        'clientInfo': await clientInfoService.withNetwork(),
      }).timeout(
        const Duration(seconds: 12),
        onTimeout: () {
          if (kDebugMode) {
            debugPrint('❌ Softphone: register-device timed out (backend '
                'unreachable?). Voice/SMS unavailable until next attempt; '
                'app startup not blocked.');
          }
          return null;
        },
      );

      if (response is! Map) {
        if (kDebugMode) debugPrint('❌ Softphone: unexpected register response: $response');
        return null;
      }

      final data = Map<String, dynamic>.from(response);
      _identity = data['identity']?.toString();
      _token = data['token']?.toString();
      expiresIn = (data['expiresIn'] is num) ? (data['expiresIn'] as num).toInt() : null;
      _capabilities = (data['capabilities'] is List)
          ? (data['capabilities'] as List).map((e) => e.toString()).toList()
          : capabilities;
      _assignedPhones = (data['assignedPhones'] is List)
          ? (data['assignedPhones'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : const [];
      _registered = true;

      if (kDebugMode) {
        debugPrint('✅ Softphone: registered as $_identity');
        debugPrint('   token=${_token?.substring(0, _token!.length > 20 ? 20 : _token!.length)}...');
        debugPrint('   assignedPhones=${_assignedPhones.length}');
        for (final p in _assignedPhones) {
          debugPrint('     - ${p['phoneNumber']} (${p['friendlyName'] ?? ''}) [${p['assignment'] ?? ''}]');
        }
        debugPrint('   capabilities=$_capabilities');
      }

      // Bind the NATIVE Twilio Voice Device to the CURRENT org's voice identity.
      //
      // The server scopes every voice identity as `user:<orgId>:<email>`
      // (src/phone/voice-identity.ts). Inbound calls fork-ring
      // `<Dial><Client>user:<orgId>:<email></Client></Dial>`, so this device
      // only rings when it is registered under the SAME org's identity. A Device
      // still bound to a different org — or to the pre-change bare `user:<email>`
      // — silently stops receiving. So bind to the org on the HTTP client and
      // force a clean re-bind whenever that org changes.
      //
      // The backend provisions a Twilio Push Credential on this org's (sub)account
      // (Appmint's central FCM/APNs material) and attaches its SID to the
      // VoiceGrant inside _token; this side just supplies the device push token so
      // Twilio's Registrar knows where to route invites for THIS install.
      //
      // CallKit + VoIP-PushKit are iPhone-only — they do NOT exist on iPad and the
      // native call there hard-crashes (EXC_BAD_ACCESS). Skip native voice on iPad;
      // backend registration above still succeeds so SMS and the rest work.
      final String? currentOrg = _http.orgId;
      final bool nativeVoiceUnsupported = await _isApplePadNoCallKit();
      if (nativeVoiceUnsupported) {
        if (kDebugMode) {
          debugPrint('ℹ️ Softphone: iPad detected — skipping native Twilio '
              'Voice/CallKit (CallKit & VoIP PushKit are iPhone-only). '
              'Backend registration done; CallKit UI is unavailable on iPad.');
        }
      } else if (_assignedPhones.isEmpty) {
        // No number assigned to this user → nothing can ring here. Don't bind
        // the voice Device (product rule: no number assigned → no softphone
        // binding), and drop any stale binding from a previous org/session.
        if (_nativeBoundOrg != null) await _unbindNativeVoice();
        if (kDebugMode) {
          debugPrint('ℹ️ Softphone: no assigned number for $_identity — '
              'skipping native voice binding (nothing to receive).');
        }
      } else if (_token != null && _token!.isNotEmpty) {
        try {
          // Org changed since the last native bind (or first bind this launch):
          // unregister the stale/old-schema identity BEFORE binding the new
          // token, so Twilio's Registrar stops routing this device under the
          // previous org's identity. Skipped on a same-org token refresh so an
          // active call isn't disturbed — setTokens updates the token in place.
          if (_nativeBoundOrg != currentOrg) {
            if (kDebugMode) {
              debugPrint('🔁 Softphone: voice org changed ($_nativeBoundOrg → $currentOrg) — '
                  'unbinding stale native Device before re-bind.');
            }
            try {
              await TwilioVoicePlatform.instance
                  .unregister()
                  .timeout(const Duration(seconds: 5), onTimeout: () => null);
            } catch (e) {
              if (kDebugMode) debugPrint('⚠️ Softphone: native unregister before re-bind failed (continuing): $e');
            }
          }

          final deviceToken = await _fetchDevicePushToken(platform: resolvedPlatform);
          // The twilio_voice 0.3.x iOS handler has a known issue where setTokens
          // never calls result() back to Dart if PushKit hasn't issued a VoIP
          // token yet. Wrap in a timeout so registration doesn't hang; the
          // accessToken is cached natively and the plugin's didUpdate callback
          // registers once PushKit issues a token.
          await TwilioVoicePlatform.instance
              .setTokens(
                accessToken: _token!,
                deviceToken: deviceToken,
              )
              .timeout(const Duration(seconds: 5), onTimeout: () {
                if (kDebugMode) {
                  debugPrint('⚠️ Softphone: TwilioVoice.setTokens did not return within 5s — '
                      'on iOS this usually means PushKit has not issued a VoIP token yet '
                      '(Xcode → Runner → Signing & Capabilities → Push Notifications must be added).');
                }
                return null;
              });
          _nativeBoundOrg = currentOrg;
          if (kDebugMode) {
            if (resolvedPlatform == 'ios') {
              // NOT a problem: the twilio_voice plugin IGNORES the Dart-passed
              // deviceToken on iOS and registers using its own PushKit VoIP
              // token (self.deviceToken). The real result is in the native log:
              // "Successfully registered…" / "Device token is nil…" /
              // "An error occurred while registering…".
              debugPrint('ℹ️ Softphone(iOS): accessToken set for org $currentOrg. '
                  'Inbound push registration is done by the plugin via PushKit — '
                  'check the native log for the register result.');
            } else if (deviceToken.isEmpty) {
              debugPrint('⚠️ Softphone($resolvedPlatform): bound with empty deviceToken — '
                  'backgrounded inbound will NOT ring (no FCM token).');
            } else {
              debugPrint('✅ Softphone($resolvedPlatform): Device bound org=$currentOrg '
                  'identity=$_identity (outbound + inbound push ready).');
            }
          }
        } catch (e) {
          if (kDebugMode) debugPrint('❌ Softphone: TwilioVoice.setTokens failed — $e');
        }
      }

      _startHeartbeat(platform: resolvedPlatform, label: label, capabilities: capabilities);
      // Send an immediate heartbeat right after registration so the server
      // sees this device as live straight away — don't wait the full 60s.
      unawaited(_heartbeat(platform: resolvedPlatform, label: label, capabilities: capabilities));

      if (_token != null) onRegistered?.call(_token!, _assignedPhones);
      return data;
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Softphone: register failed — $e');
      onError?.call(e.toString());
      return null;
    }
  }

  void _startHeartbeat({required String platform, String? label, required List<String> capabilities}) {
    _heartbeatTimer?.cancel();
    // Heartbeat every 30s — backend TTL is 90s, 30s gives us 3 attempts
    // before TTL expires. Also matches the cadence recommended in
    // CHAT_PRESENCE_GUIDE.md for agent presence.
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) => _heartbeat(platform: platform, label: label, capabilities: capabilities));
    if (kDebugMode) debugPrint('💓 Softphone: heartbeat timer started (30s interval)');
  }

  Future<void> _heartbeat({required String platform, String? label, required List<String> capabilities}) async {
    if (_deviceId == null) return;
    try {
      if (kDebugMode) debugPrint('💓 Softphone: POST /phone/voice/heartbeat deviceId=$_deviceId');
      await _http.post('/phone/voice/heartbeat', body: {
        'deviceId': _deviceId,
        'platform': platform,
        if (label != null) 'label': label,
        'capabilities': capabilities,
        // Live client info on every heartbeat so server sees current
        // network type, battery, locale, etc. alongside presence TTL refresh
        'clientInfo': await clientInfoService.withNetwork(),
      });
      if (kDebugMode) debugPrint('💓 Softphone: heartbeat ok');
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Softphone: heartbeat failed — $e');
    }
  }

  /// Refresh the Twilio token. The Twilio SDK should call this when it fires
  /// `tokenWillExpire` (~3 minutes before expiry).
  Future<String?> refreshToken({String platform = 'android'}) async {
    final data = await registerDevice(platform: platform, capabilities: _capabilities.isEmpty ? const ['voice', 'sms'] : _capabilities);
    if (data != null && _token != null) {
      onTokenRefreshed?.call(_token!);
      return _token;
    }
    return null;
  }

  /// Unregister this device. Called on logout / app shutdown.
  ///
  /// Tears down BOTH the backend presence entry AND the native Twilio Voice
  /// registration. Dropping the native binding is essential for multi-tenant
  /// safety: without it the Device keeps ringing under the just-logged-out
  /// user/org's identity even after someone else signs in on the same install.
  Future<void> unregisterDevice() async {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;

    // Always drop the native binding first, regardless of backend state.
    await _unbindNativeVoice();

    if (_deviceId == null || !_registered) {
      _registered = false;
      return;
    }
    try {
      await _http.post('/phone/voice/unregister-device', body: {'deviceId': _deviceId});
    } catch (e) {
      if (kDebugMode) debugPrint('Softphone: unregister failed — $e');
    } finally {
      _registered = false;
      _token = null;
      _identity = null;
      _assignedPhones = const [];
    }
  }

  /// Whether the user chose "Go offline" (persisted). While true, the softphone
  /// stays unregistered and does not receive calls — even across app restarts.
  Future<bool> isUserOffline() async {
    try {
      final v = await _storage.getSetting(_offlineKey);
      return v == true;
    } catch (_) {
      return false;
    }
  }

  /// Go offline — stop receiving calls on this device ("closed for business").
  /// Unregisters from Twilio + the backend and remembers the choice so nothing
  /// silently brings it back online.
  Future<void> goOffline() async {
    try {
      await _storage.saveSetting(_offlineKey, true);
    } catch (_) {}
    await unregisterDevice();
  }

  /// Go back online — clear the offline choice and register to receive calls.
  Future<Map<String, dynamic>?> goOnline({String? label}) async {
    try {
      await _storage.saveSetting(_offlineKey, false);
    } catch (_) {}
    return registerDevice(label: label ?? 'Appmint Mobile', force: true);
  }

  /// Tear down the native Twilio Voice registration so this install stops
  /// ringing under whatever org/identity it was last bound to. Best-effort and
  /// idempotent — safe to call when nothing is bound.
  Future<void> _unbindNativeVoice() async {
    if (_nativeBoundOrg == null) return;
    final was = _nativeBoundOrg;
    try {
      await TwilioVoicePlatform.instance
          .unregister()
          .timeout(const Duration(seconds: 5), onTimeout: () => null);
      if (kDebugMode) debugPrint('🔌 Softphone: native Twilio Device unregistered (was org $was).');
    } catch (e) {
      if (kDebugMode) debugPrint('⚠️ Softphone: native unregister failed: $e');
    } finally {
      _nativeBoundOrg = null;
    }
  }

  /// True on iPad: CallKit and VoIP-PushKit are iPhone-only, so the native
  /// twilio_voice registration must be skipped there (it EXC_BAD_ACCESS-es).
  bool? _isPadCache;
  Future<bool> _isApplePadNoCallKit() async {
    if (_isPadCache != null) return _isPadCache!;
    if (kIsWeb || !Platform.isIOS) return _isPadCache = false;
    try {
      final ios = await DeviceInfoPlugin().iosInfo;
      final machine = ios.utsname.machine.toLowerCase();
      _isPadCache = ios.model.toLowerCase().contains('ipad') ||
          machine.contains('ipad');
    } catch (_) {
      _isPadCache = false;
    }
    return _isPadCache!;
  }

  /// Detect the runtime platform string the backend expects.
  /// Returns 'android' | 'ios' | 'web' (the only values phone.service accepts).
  String _detectPlatform() {
    if (kIsWeb) return 'web';
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    // Desktop falls back to 'web' since Twilio mobile push doesn't apply
    // and softphone is browser-style on desktop builds.
    return 'web';
  }

  static const MethodChannel _nativeChannel = MethodChannel('appmint/apns');
  String? _apnsEnvCache;

  /// The APNs environment this iOS build is code-signed for — 'sandbox' for a
  /// dev-signed build, 'production' for TestFlight / App Store — read natively
  /// from the provisioning profile (App Store strips the profile → production).
  /// Sent to the backend so it attaches the matching Twilio Push Credential.
  Future<String> _apnsEnvironment() async {
    if (_apnsEnvCache != null) return _apnsEnvCache!;
    var env = 'production';
    if (Platform.isIOS) {
      try {
        final v = await _nativeChannel.invokeMethod<String>('environment');
        if (v == 'sandbox' || v == 'production') env = v!;
      } catch (_) {
        // Native channel missing / read failed — production is the safe default
        // (a shipped App Store build is production).
      }
    }
    return _apnsEnvCache = env;
  }

  /// Fetch the platform-specific push token used by Twilio to dispatch
  /// backgrounded inbound call invites:
  ///   - Android → FCM token via FirebaseMessaging
  ///   - iOS     → PushKit VoIP token, fetched via a method channel that
  ///                AppDelegate.swift populates from PKPushRegistry (deferred
  ///                until task #9 lands)
  ///   - Web     → empty string; browsers stay live without push
  ///
  /// Returns '' on any failure rather than throwing — the caller logs the
  /// degraded state and continues. Outbound still works without a device
  /// token; only backgrounded inbound is impacted.
  Future<String> _fetchDevicePushToken({required String platform}) async {
    if (platform == 'android') {
      try {
        // Permission must be granted explicitly on Android 13+ (POST_NOTIFICATIONS)
        // OR notifications won't arrive even if the FCM token is valid.
        final settings = await FirebaseMessaging.instance.requestPermission();
        if (kDebugMode) debugPrint('🔔 FCM permission: ${settings.authorizationStatus}');

        final fcmToken = await FirebaseMessaging.instance.getToken();
        if (fcmToken == null || fcmToken.isEmpty) {
          if (kDebugMode) debugPrint('⚠️ FCM getToken returned null/empty — Firebase not ready or Google Play Services missing');
          return '';
        }
        if (kDebugMode) {
          final preview = fcmToken.length > 20 ? '${fcmToken.substring(0, 20)}…' : fcmToken;
          debugPrint('✅ FCM token: $preview (len=${fcmToken.length})');
        }
        return fcmToken;
      } catch (e) {
        if (kDebugMode) debugPrint('❌ FCM token fetch failed: $e');
        return '';
      }
    }
    if (platform == 'ios') {
      // iOS VoIP token handling lives entirely inside the twilio_voice
      // plugin — its native PKPushRegistry fetches the token, caches it,
      // and calls TwilioVoiceSDK.register() the moment it has both the
      // token AND an access token from setTokens(). The deviceToken value
      // we pass via Dart on iOS is IGNORED by the plugin's native handler
      // (it always uses its own PushKit-cached token). So we just return
      // an empty string here — outbound + inbound both work as long as:
      //   1. App has VoIP push capability enabled in Apple Dev portal
      //   2. Info.plist UIBackgroundModes includes `voip` (already done)
      //   3. Xcode Runner has Push Notifications capability added
      //   4. Backend attached pushCredentialSid to the VoiceGrant (done)
      return '';
    }
    return '';
  }

  /// Decode the current Twilio access token's VoiceGrant for on-device
  /// diagnostics — reveals the identity, the push credential the token carries
  /// (the one Twilio needs on the SAME account the token is signed on), and the
  /// outgoing app. Use this to confirm what the phone is actually registering
  /// with, without needing the Xcode console.
  Map<String, dynamic> tokenDiagnostics() {
    final out = <String, dynamic>{
      'identity': _identity,
      'nativeBoundOrg': _nativeBoundOrg,
      'registered': _registered,
      'assignedPhones':
          _assignedPhones.map((p) => p['phoneNumber']?.toString()).toList(),
    };
    final t = _token;
    if (t == null || t.split('.').length < 2) {
      out['error'] = 'no token';
      return out;
    }
    try {
      final payload =
          utf8.decode(base64Url.decode(base64Url.normalize(t.split('.')[1])));
      final map = jsonDecode(payload) as Map<String, dynamic>;
      final grants = map['grants'] as Map<String, dynamic>?;
      final voice = grants?['voice'] as Map<String, dynamic>?;
      out['tokenIdentity'] = grants?['identity'];
      out['pushCredentialSid'] =
          voice?['push_credential_sid'] ?? '*** MISSING — no push route ***';
      out['incomingAllow'] = (voice?['incoming'] as Map?)?['allow'];
      out['outgoingAppSid'] =
          (voice?['outgoing'] as Map?)?['application_sid'];
    } catch (e) {
      out['error'] = 'decode failed: $e';
    }
    return out;
  }

  /// List every live device for the current user (across platforms).
  /// Useful for "You're signed in on N devices" UI.
  Future<List<Map<String, dynamic>>> listDevices() async {
    try {
      final response = await _http.get('/phone/voice/devices');
      if (response is Map && response['devices'] is List) {
        return (response['devices'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Softphone: listDevices failed — $e');
    }
    return const [];
  }
}

final softphoneService = SoftphoneService();
