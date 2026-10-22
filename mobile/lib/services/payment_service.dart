import 'http_client.dart';

/// Server-side Stripe glue — same endpoints event_app (the consumer app) uses.
/// The custody charge is created as a PaymentIntent server-side; the guest
/// confirms it with the Stripe payment sheet on-device.
class PaymentService {
  final AppengineHttpClient _http = appengineHttpClient;

  /// GET /client/events/stripe/config → { publishableKey }
  Future<Map<String, dynamic>> getStripeConfig() async {
    final res = await _http.get('/client/events/stripe/config');
    return res is Map ? Map<String, dynamic>.from(res) : {};
  }

  /// POST /client/events/stripe/intent { amount, currency, referenceId }
  /// → { clientSecret } (a thin Stripe PaymentIntent wrapper).
  Future<Map<String, dynamic>> createPaymentIntent({
    required double amount,
    String currency = 'usd',
    String? referenceId,
    String? email,
  }) async {
    final res = await _http.post('/client/events/stripe/intent', body: {
      'amount': amount,
      'currency': currency,
      // No method restriction — the sheet offers whatever the Stripe account has
      // enabled and the customer chooses.
      if (referenceId != null) 'referenceId': referenceId,
      if (email != null) 'email': email,
    });
    return res is Map ? Map<String, dynamic>.from(res) : {};
  }
}

final paymentService = PaymentService();
