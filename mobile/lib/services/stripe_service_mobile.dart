import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'payment_service.dart';

/// Mobile Stripe — mirrors dfw_errand's proven consumer flow. The guest pays the
/// custody charge on their own phone (card-not-present). The publishable key +
/// PaymentIntent come from the server.
class StripeService {
  static bool _initialized = false;
  static String? _publishableKey;
  // True while a sheet is being initialised/presented. Re-taps on the Pay
  // button re-run initPaymentSheet, which tears down the sheet the previous tap
  // was about to show — so ignore calls until the current one settles.
  static bool _busy = false;

  /// Deep-link scheme Stripe redirects back to after 3-D Secure / redirect
  /// methods. Must match the CFBundleURLSchemes entry in ios/Runner/Info.plist
  /// and the intent-filter scheme in AndroidManifest.
  static const String urlScheme = 'stowbo';
  static const String returnUrl = '$urlScheme://stripe-redirect';

  static bool get isAvailable => true;

  /// Commit the key + URL scheme to the native SDK. The official flutter_stripe
  /// example does exactly this in main() — WITHOUT `applySettings()` the native
  /// iOS SDK never picks up the config and the sheet inits fine but silently
  /// never presents.
  static Future<void> _applyKey(String key) async {
    _publishableKey = key;
    Stripe.publishableKey = key;
    Stripe.urlScheme = urlScheme;
    await Stripe.instance.applySettings();
    _initialized = true;
  }

  static Future<void> initialize() async {
    if (_initialized && _publishableKey != null) return;
    try {
      final config = await paymentService.getStripeConfig();
      final key = (config['publishableKey'] ?? '').toString();
      if (key.isNotEmpty) {
        await _applyKey(key);
        if (kDebugMode) print('✅ Stripe: initialized from server key');
      } else if (kDebugMode) {
        print('⚠️ Stripe: no publishable key from server');
      }
    } catch (e) {
      if (kDebugMode) print('❌ Stripe: config fetch failed — $e');
    }
  }

  /// Set the key directly (e.g. returned alongside a PaymentIntent).
  static Future<void> setPublishableKey(String key) async {
    if (key.isEmpty || (_initialized && _publishableKey != null)) return;
    await _applyKey(key);
  }

  /// Present the sheet. When [customerId] + [ephemeralKeySecret] are supplied the
  /// sheet lists the customer's saved cards and offers a "Save this card"
  /// checkbox; otherwise it is a plain one-off card entry. If the saved-card
  /// setup fails (most often an ephemeral-key API-version mismatch) it degrades
  /// to a plain sheet so the payment still goes through.
  static Future<bool> presentPaymentSheet({
    required String clientSecret,
    String merchantDisplayName = 'Stowbo',
    String? customerId,
    String? ephemeralKeySecret,
  }) async {
    if (_busy) {
      if (kDebugMode) print('💳 Stripe: already presenting — ignoring re-tap');
      return false;
    }
    _busy = true;
    if (kDebugMode) {
      print('💳 Stripe: presentPaymentSheet called');
      print('💳 Stripe: clientSecret = '
          '${clientSecret.length > 20 ? '${clientSecret.substring(0, 20)}…' : clientSecret}');
    }
    if (!_initialized) await initialize();
    if (!_initialized || _publishableKey == null || _publishableKey!.isEmpty) {
      throw Exception('Stripe not initialized — no publishable key');
    }

    final hasCustomer = (customerId?.isNotEmpty ?? false) &&
        (ephemeralKeySecret?.isNotEmpty ?? false);

    Future<void> init({required bool withCustomer}) =>
        Stripe.instance.initPaymentSheet(
          paymentSheetParameters: SetupPaymentSheetParameters(
            paymentIntentClientSecret: clientSecret,
            merchantDisplayName: merchantDisplayName,
            style: ThemeMode.system,
            returnURL: returnUrl,
            customerId: withCustomer ? customerId : null,
            customerEphemeralKeySecret:
                withCustomer ? ephemeralKeySecret : null,
          ),
        );

    try {
      if (kDebugMode) {
        print('💳 Stripe: initPaymentSheet… (savedCards=$hasCustomer)');
      }
      if (hasCustomer) {
        try {
          await init(withCustomer: true);
        } on StripeException catch (e) {
          // Almost always an ephemeral-key API-version mismatch. Fall back to a
          // plain card sheet so the customer can still pay; the message names
          // the version the SDK expects — set it as `stripeVersion` on the
          // intent to enable saved cards.
          if (kDebugMode) {
            print('⚠️ Stripe: saved-card init failed '
                '(${e.error.code} — ${e.error.message}); '
                'falling back to plain card entry');
          }
          await init(withCustomer: false);
        }
      } else {
        await init(withCustomer: false);
      }

      if (kDebugMode) print('💳 Stripe: presenting…');
      await Stripe.instance.presentPaymentSheet();
      if (kDebugMode) print('✅ Stripe: payment sheet completed');
      return true;
    } on StripeException catch (e) {
      if (kDebugMode) {
        print('❌ Stripe Exception: ${e.error.code} — ${e.error.message}');
        print('❌ Stripe localized: ${e.error.localizedMessage}');
      }
      rethrow;
    } catch (e) {
      if (kDebugMode) print('❌ Stripe: unexpected error — $e');
      rethrow;
    } finally {
      _busy = false;
    }
  }
}
