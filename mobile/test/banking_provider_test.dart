import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:appmint_one/providers/banking_provider.dart';
import 'package:appmint_one/services/banking_api.dart';

class _Api extends Fake implements BankingApi {
  final firstAccount = Completer<Map<String, dynamic>>();
  final firstTransactions = Completer<Map<String, dynamic>>();
  final transactionsStarted = Completer<void>();
  final firstLoan = Completer<Map<String, dynamic>>();
  bool delayAccount = true;

  @override
  Future<Map<String, dynamic>> account(String id) async =>
      id == 'first' && delayAccount
      ? firstAccount.future
      : {
          'account': {
            'sk': id,
            'data': {'nickname': id},
          },
          'gaps': [],
        };

  @override
  Future<Map<String, dynamic>> transactions(
    String id, {
    int page = 1,
    int pageSize = 50,
  }) async {
    if (id == 'first') {
      transactionsStarted.complete();
      return firstTransactions.future;
    }
    return {
      'data': [
        {'sk': 'txn-$id'},
      ],
    };
  }

  @override
  Future<List<Map<String, dynamic>>> cards(String id) async => [
    {'sk': 'card-$id'},
  ];
  @override
  Future<List<Map<String, dynamic>>> statements(String id) async => [
    {'sk': 'statement-$id'},
  ];
  @override
  Future<Map<String, dynamic>> loan(String id) async =>
      id == 'first' ? firstLoan.future : {'sk': id, 'owed': 100};
  @override
  Future<Map<String, dynamic>> payoffQuote(String id, {String? date}) async => {
    'loan': id,
    'amount': 100,
  };
}

void main() {
  test(
    'a slow previous account response cannot replace the selected account',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api);
      final first = bank.openAccountView('first');
      await bank.openAccountView('second');
      api.firstAccount.complete({
        'account': {'sk': 'first'},
      });
      await first;
      expect(bank.open['sk'], 'second');
      expect(bank.transactions.single['sk'], 'txn-second');
      expect(bank.cards.single['sk'], 'card-second');
      expect(bank.openLoading, isFalse);
      bank.dispose();
    },
  );

  test(
    'late transactions from an earlier account cannot replace the newer feed',
    () async {
      final api = _Api()..delayAccount = false;
      final bank = BankingProvider(api: api);
      final first = bank.openAccountView('first');
      await api.transactionsStarted.future;
      await bank.openAccountView('second');
      api.firstTransactions.complete({
        'data': [
          {'sk': 'txn-first'},
        ],
      });
      await first;
      expect(bank.open['sk'], 'second');
      expect(bank.transactions.single['sk'], 'txn-second');
      expect(bank.statements.single['sk'], 'statement-second');
      bank.dispose();
    },
  );

  test(
    'a previous loan cannot replace the selected loan or its payoff quote',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api);
      final first = bank.openLoanView('first');
      await bank.openLoanView('second');
      api.firstLoan.complete({'sk': 'first', 'owed': 999});
      await first;
      expect(bank.loan['sk'], 'second');
      expect(bank.payoff['loan'], 'second');
      expect(bank.loanLoading, isFalse);
      bank.dispose();
    },
  );
}
