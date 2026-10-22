import 'package:flutter/foundation.dart';

/// Web stub — the flutter_stripe native SDK isn't available on web.
class StripeService {
  static bool get isAvailable => false;

  static Future<void> initialize() async {
    if (kDebugMode) print('Stripe: web not supported');
  }

  static Future<void> setPublishableKey(String key) async {}

  static Future<bool> presentPaymentSheet({
    required String clientSecret,
    String merchantDisplayName = 'Stowbo',
    String? customerId,
    String? ephemeralKeySecret,
  }) async {
    throw UnsupportedError('Stripe payments not available on web');
  }
}
