import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:appmint_one/providers/banking_provider.dart';
import 'package:appmint_one/screens/modules/money/banking/cards_screen.dart';

class _Bank extends BankingProvider {
  _Bank({this.withCard = false});
  final bool withCard;
  Map<String, dynamic>? controls;
  @override
  List<Map<String, dynamic>> get cards => withCard
      ? [
          {
            'sk': 'card',
            'account': 'account',
            'form': 'virtual',
            'status': 'active',
            'last4': '1234',
            'nameOnCard': 'Example',
            'network': 'visa',
            'controls': {'dailySpend': 50000},
            'bankLimits': {
              'dailySpend': 100000,
              'perTransaction': null,
              'dailyAtm': null,
            },
          },
        ]
      : [];
  @override
  Future<String?> setCardControls(
    String id,
    Map<String, dynamic> controls,
  ) async {
    this.controls = controls;
    return null;
  }

  Map<String, dynamic>? shipping;
  String? form;
  int orders = 0;
  @override
  Future<String?> orderCard(
    String accountId, {
    required String form,
    Map<String, dynamic>? shipping,
  }) async {
    orders++;
    this.form = form;
    this.shipping = shipping;
    return null;
  }
}

void main() {
  testWidgets(
    'physical card ordering collects shipping before calling the existing API',
    (tester) async {
      final bank = _Bank();
      await tester.pumpWidget(
        ChangeNotifierProvider<BankingProvider>.value(
          value: bank,
          child: const MaterialApp(home: CardsScreen(accountId: 'account')),
        ),
      );
      await tester.tap(find.text('Order a card'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Physical'));
      await tester.pumpAndSettle();
      expect(bank.orders, 0);
      expect(find.text('Shipping address'), findsOneWidget);
      await tester.tap(find.text('Use this address'));
      await tester.pumpAndSettle();
      expect(bank.orders, 0);
      expect(find.text('Complete the shipping address.'), findsOneWidget);
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), '100 Example St');
      await tester.enterText(fields.at(1), 'Austin');
      await tester.enterText(fields.at(2), 'TX');
      await tester.enterText(fields.at(3), '78701');
      await tester.tap(find.text('Use this address'));
      await tester.pumpAndSettle();
      expect(bank.orders, 1);
      expect(bank.form, 'physical');
      expect(bank.shipping, {
        'address': {
          'street1': '100 Example St',
          'city': 'Austin',
          'state': 'TX',
          'zip': '78701',
          'country': 'US',
        },
      });
      bank.dispose();
    },
  );
  testWidgets(
    'personal limits may rise to the bank ceiling and reset to bank policy',
    (tester) async {
      final bank = _Bank(withCard: true);
      await tester.pumpWidget(
        ChangeNotifierProvider<BankingProvider>.value(
          value: bank,
          child: const MaterialApp(home: CardsScreen(accountId: 'account')),
        ),
      );
      await tester.ensureVisible(find.text('Daily spending'));
      await tester.tap(find.text('Daily spending'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '1000.01');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(bank.controls, isNull);
      expect(
        find.text('Enter a nonnegative amount within the bank’s limit.'),
        findsOneWidget,
      );
      await tester.enterText(find.byType(TextField), '800.00');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(bank.controls, {'dailySpend': 80000});
      await tester.tap(find.text('Daily spending'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Use bank limit'));
      await tester.pumpAndSettle();
      expect(bank.controls, {'dailySpend': null});
      bank.dispose();
    },
  );
}
