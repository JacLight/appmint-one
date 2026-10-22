import 'package:flutter/foundation.dart';
import 'http_client.dart';

/// Payment gateway record as returned by GET /storefront/payment-gateways.
/// Each org configures one or more gateways (Stripe, PayPal, Helcim, etc.)
/// via their backend integration provider. The mobile reads the gateway's
/// public key to talk directly to the gateway SDK.
class PaymentGateway {
  final String sk;
  /// 'StripeProvider' | 'PayPalProvider' | 'HelcimProvider' | etc.
  final String provider;
  final String? name;
  /// Stripe / Helcim — used by the client SDK to tokenize a card.
  /// PayPal — uses 'clientId'.
  final String? publishableKey;
  final String? mode;
  final bool active;
  final Map<String, dynamic> raw;

  const PaymentGateway({
    required this.sk,
    required this.provider,
    this.name,
    this.publishableKey,
    this.mode,
    this.active = true,
    required this.raw,
  });

  factory PaymentGateway.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] is Map ? json['data'] : json) as Map;
    return PaymentGateway(
      sk: (json['sk'] ?? data['sk'] ?? '').toString(),
      provider: (data['provider'] ?? '').toString(),
      name: data['name']?.toString(),
      publishableKey: data['publishableKey']?.toString(),
      mode: data['mode']?.toString(),
      active: data['active'] != false && data['status'] != 'inactive',
      raw: Map<String, dynamic>.from(data),
    );
  }
}

/// Stripe PaymentIntent response shape (backend wraps Stripe SDK's response).
class StripeIntent {
  final String? clientSecret;
  final String? id;
  final num? amount;
  final String? currency;
  const StripeIntent({this.clientSecret, this.id, this.amount, this.currency});

  factory StripeIntent.fromJson(Map<String, dynamic> json) => StripeIntent(
        clientSecret: json['client_secret']?.toString() ??
            json['clientSecret']?.toString(),
        id: json['id']?.toString(),
        amount: json['amount'] is num ? json['amount'] as num : null,
        currency: json['currency']?.toString(),
      );

  bool get isValid => clientSecret != null && clientSecret!.isNotEmpty;
}

class PaymentService {
  final AppengineHttpClient _http = appengineHttpClient;

  /// List configured payment gateways for the current org. Optional amount/
  /// currency lets the backend filter to gateways that support the charge.
  /// Mirrors the React POS pattern at business-made/.../POS.tsx:836.
  Future<List<PaymentGateway>> listPaymentGateways({
    num? amount,
    String? currency,
    String? email,
  }) async {
    try {
      final params = <String, String>{};
      if (amount != null) params['amount'] = amount.toString();
      if (currency != null && currency.isNotEmpty) params['currency'] = currency;
      if (email != null && email.isNotEmpty) params['email'] = email;
      final response = await _http.get(
        '/storefront/payment-gateways',
        queryParams: params.isEmpty ? null : params,
      );
      List rawList;
      if (response is List) {
        rawList = response;
      } else if (response is Map && response['data'] is List) {
        rawList = response['data'] as List;
      } else {
        rawList = const [];
      }
      return rawList
          .whereType<Map>()
          .map((e) => PaymentGateway.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (e) {
      if (kDebugMode) debugPrint('PaymentService.listPaymentGateways failed: $e');
      return const [];
    }
  }

  /// Find a gateway by provider name. Convenience for the common
  /// "give me the Stripe gateway for this charge" lookup.
  Future<PaymentGateway?> findGateway({
    required String provider,
    num? amount,
    String? currency,
  }) async {
    final all = await listPaymentGateways(amount: amount, currency: currency);
    for (final g in all) {
      if (g.provider == provider && g.active) return g;
    }
    return null;
  }

  /// Create a Stripe PaymentIntent on the backend. Returns the client_secret
  /// the Stripe SDK uses to confirm a card payment. Body matches the React
  /// pattern: { amount, currency (lowercase), email? }.
  Future<StripeIntent?> createStripeIntent({
    required num amount,
    required String currency,
    String? email,
    String? orderId,
  }) async {
    try {
      final response = await _http.post(
        '/storefront/stripe/intent',
        body: {
          'amount': amount,
          'currency': currency.toLowerCase(),
          if (email != null && email.isNotEmpty) 'email': email,
          if (orderId != null && orderId.isNotEmpty) 'orderId': orderId,
        },
      );
      if (response is Map<String, dynamic>) return StripeIntent.fromJson(response);
      if (response is Map) return StripeIntent.fromJson(Map<String, dynamic>.from(response));
      return null;
    } catch (e) {
      if (kDebugMode) debugPrint('PaymentService.createStripeIntent failed: $e');
      rethrow;
    }
  }
}

final paymentService = PaymentService();
