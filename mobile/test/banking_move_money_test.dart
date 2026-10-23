import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:appmint_one/providers/banking_provider.dart';
import 'package:appmint_one/screens/modules/money/banking/move_money_screen.dart';

class _Bank extends BankingProvider {
  bool posted = true;
  @override
  String? get lastMoneyStatus => posted ? 'posted' : 'pending';
  @override
  List<Map<String, dynamic>> get accounts => [
    {
      'sk': 'checking',
      'nickname': 'Checking',
      'balances': {'available': 10000, 'spendable': 10000},
    },
  ];
  @override
  Future<String?> transfer({
    required String from,
    required String toAccountNumber,
    required int amountCents,
    String? memo,
    void Function(String)? onReceipt,
  }) async {
    onReceipt?.call(posted ? 'posted' : 'pending');
    return null;
  }
}

void main() {
  for (final embedded in [true, false]) {
    testWidgets(
      'Done ${embedded ? 'resets the embedded Move tab' : 'returns from a pushed transfer screen'}',
      (tester) async {
        final bank = _Bank();
        await tester.pumpWidget(
          ChangeNotifierProvider<BankingProvider>.value(
            value: bank,
            child: MaterialApp(
              home: embedded
                  ? const MoveMoneyScreen(
                      mode: MoveMode.transfer,
                      embedded: true,
                    )
                  : Builder(
                      builder: (context) => Scaffold(
                        body: TextButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const MoveMoneyScreen(
                                mode: MoveMode.transfer,
                              ),
                            ),
                          ),
                          child: const Text('Open transfer'),
                        ),
                      ),
                    ),
            ),
          ),
        );
        if (!embedded) {
          await tester.tap(find.text('Open transfer'));
          await tester.pumpAndSettle();
        }
        await tester.enterText(find.byType(TextField).at(0), '5.00');
        await tester.enterText(find.byType(TextField).at(1), '12345678');
        await tester.pump();
        await tester.tap(find.widgetWithText(FilledButton, 'Transfer'));
        await tester.pumpAndSettle();
        expect(find.text('Done'), findsOneWidget);
        await tester.tap(find.text('Done'));
        await tester.pumpAndSettle();
        expect(find.text('Done'), findsNothing);
        if (embedded) {
          expect(find.widgetWithText(FilledButton, 'Transfer'), findsOneWidget);
          expect(
            tester
                .widget<TextField>(find.byType(TextField).first)
                .controller!
                .text,
            isEmpty,
          );
        } else {
          expect(find.text('Open transfer'), findsOneWidget);
        }
        await tester.pumpWidget(const SizedBox());
        bank.dispose();
      },
    );
  }
  testWidgets('pending transfer receipt does not claim that money moved', (
    tester,
  ) async {
    final bank = _Bank()..posted = false;
    await tester.pumpWidget(
      ChangeNotifierProvider<BankingProvider>.value(
        value: bank,
        child: const MaterialApp(
          home: MoveMoneyScreen(mode: MoveMode.transfer, embedded: true),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField).at(0), '5');
    await tester.enterText(find.byType(TextField).at(1), '12345678');
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Transfer'));
    await tester.pumpAndSettle();
    expect(find.textContaining('awaiting bank processing'), findsOneWidget);
    expect(find.textContaining('Transferred.'), findsNothing);
    expect(find.byIcon(Icons.check_rounded), findsNothing);
    await tester.pumpWidget(const SizedBox());
    bank.dispose();
  });
}
