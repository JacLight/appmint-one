import 'package:flutter_test/flutter_test.dart';
import 'package:appmint_one/services/banking_api.dart';
import 'package:appmint_one/services/banking_payee.dart';
import 'package:appmint_one/services/banking_dispute_reasons.dart';

void main() {
  test('money entry preserves exact cents and valid currency formatting', () {
    const valid = <String, int>{
      '0': 0,
      '10': 1000,
      '10.': 1000,
      '.5': 50,
      '0.01': 1,
      '12.34': 1234,
      '1,234.56': 123456,
      ' \$1,234.56 ': 123456,
      '£ 25.50': 2550,
      '€1,000': 100000,
      '¥10': 1000,
      '90,071,992,547,409.91': 9007199254740991,
    };
    for (final entry in valid.entries) {
      expect(Money.parse(entry.key), entry.value, reason: entry.key);
    }
  });

  test(
    'money entry rejects altered signs, text, rounding and bad grouping',
    () {
      for (final value in [
        '',
        ' ',
        '.',
        '-10',
        '(10)',
        '+10',
        'abc10',
        '10abc',
        '1.234',
        '1.2.3',
        '1,23',
        '12,34.56',
        '1234,567',
        '1,,000',
        '1 000',
        'NaN',
        'Infinity',
        '1e3',
        '\$\$10',
        '90,071,992,547,409.92',
        '999999999999999999999999999',
      ]) {
        expect(Money.parse(value), isNull, reason: value);
      }
    },
  );

  test('every dispute option matches the backend reason contract', () {
    const accepted = {
      'unauthorized',
      'not_received',
      'duplicate',
      'wrong_amount',
      'cancelled_recurring',
      'not_as_described',
      'atm_cash_not_received',
      'other',
    };
    expect(bankingDisputeReasons.keys.toSet(), accepted);
    expect(bankingDisputeReasons['unauthorized'], isNotEmpty);
    expect(bankingDisputeReasons.containsKey('not_recognised'), isFalse);
    expect(bankingDisputeReasons.containsKey('cancelled'), isFalse);
  });
  test(
    'payee verification reads nested server state and respects disabled records',
    () {
      expect(
        payeeIsVerified({
          'status': 'active',
          'verification': {'status': 'verified'},
        }),
        isTrue,
      );
      expect(
        payeeVerificationStatus({
          'status': 'active',
          'verification': {'status': 'pending'},
        }),
        'pending',
      );
      expect(
        payeeIsVerified({
          'status': 'active',
          'verification': {'status': 'unverified'},
          'verified': true,
        }),
        isFalse,
      );
      expect(
        payeeIsVerified({
          'status': 'disabled',
          'verification': {'status': 'verified'},
        }),
        isFalse,
      );
      expect(payeeIsVerified({'verified': true}), isTrue);
      expect(payeeIsVerified({'status': 'verified'}), isTrue);
      expect(payeeIsVerified({}), isFalse);
    },
  );

  test(
    'payee account labels display only validated public last four digits',
    () {
      expect(payeeAccountLabel({'accountLast4': '1234'}), '•••• 1234');
      expect(payeeAccountLabel({'accountNumber': '1234567890'}), isEmpty);
      expect(payeeAccountLabel({'accountLast4': '1234567890'}), isEmpty);
    },
  );
}
