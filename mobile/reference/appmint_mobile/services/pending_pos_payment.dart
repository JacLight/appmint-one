import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'http_client.dart';

/// Persists payment recovery before contacting Stripe. Contains references and
/// amounts only; never card details or a PaymentIntent client secret.
class PendingPosPayment {
  static String _key(String orderId, String? orgId) =>
      'pos_payment_pending:${orgId ?? appengineHttpClient.orgId}:$orderId';

  static Future<Map<String, dynamic>?> load(
    String orderId, {
    String? orgId,
  }) async {
    final value = (await SharedPreferences.getInstance()).getString(
      _key(orderId, orgId),
    );
    return value == null ? null : Map<String, dynamic>.from(jsonDecode(value));
  }

  static Future<void> save(
    String orderId,
    Map<String, dynamic> value, {
    String? orgId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (!await prefs.setString(_key(orderId, orgId), jsonEncode(value))) {
      throw StateError(
        'Cannot save payment recovery. No new payment was started.',
      );
    }
  }

  static Future<void> clear(String orderId, {String? orgId}) async {
    await (await SharedPreferences.getInstance()).remove(_key(orderId, orgId));
  }
}
