import 'package:flutter_test/flutter_test.dart';
import 'package:appmint_one/services/payment_ledger.dart';

void main() {
  test('cancelled and failed requests never count as collected money', () {
    final rows = <Map<String, dynamic>>[
      {'amount': 53.60, 'status': 'paid'},
      {'amount': 1, 'status': 'cancelled', 'pending': false},
      {'amount': 2, 'status': 'failed', 'pending': false},
      {'amount': 3, 'status': 'pending', 'pending': true},
    ];
    expect(collectedPaymentTotal(rows), 53.60);
    expect(rows.skip(1).any(isCollectedPayment), isFalse);
  });
  test('refund rows subtract once from the original completed payment', () {
    expect(collectedPaymentTotal([
      {'amount': 10, 'status': 'refunded', 'kind': 'charge'},
      {'amount': 10, 'status': 'paid', 'kind': 'refund'},
      {'amount': 5, 'status': 'paid', 'kind': 'charge', 'refunded': 2},
      {'amount': 2, 'status': 'paid', 'kind': 'refund'},
    ]), 3);
  });
}
