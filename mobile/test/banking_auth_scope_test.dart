import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:appmint_one/providers/banking_provider.dart';
import 'package:appmint_one/services/banking_api.dart';

class _Api extends Fake implements BankingApi {
  @override
  void bindVerificationScope(String scope) {}
  String actor = 'alice';
  String? delay;
  final old = Completer<void>();
  final started = Completer<void>();
  Future<T> read<T>(String name, T data) async {
    if (actor == 'alice' && delay == name) {
      if (!started.isCompleted) started.complete();
      await old.future;
    }
    return data;
  }

  @override
  Future<List<Map<String, dynamic>>> accounts() => read('accounts', [
    {'sk': '$actor-account'},
  ]);
  @override
  Future<Map<String, dynamic>> identity() => read('identity', {
    'status': 'verified',
    'details': {'name': actor},
  });
  @override
  Future<List<Map<String, dynamic>>> payees() => read('payees', [
    {'sk': '$actor-payee'},
  ]);
  @override
  Future<List<Map<String, dynamic>>> products() async => [
    {'sk': 'product'},
  ];
  @override
  Future<List<Map<String, dynamic>>> disputes() async => [
    {'sk': '$actor-dispute'},
  ];
  @override
  Future<Map<String, dynamic>> myLoans({
    int page = 1,
    int pageSize = 25,
    String? status,
  }) => read('loans', {
    'data': [
      {'sk': '$actor-loan'},
    ],
  });
  @override
  Future<Map<String, dynamic>> loanApplications({
    int page = 1,
    int pageSize = 25,
    String? status,
  }) async => {
    'data': [
      {'sk': '$actor-application'},
    ],
  };
  @override
  Future<List<Map<String, dynamic>>> loanProducts({
    int? amountCents,
    int? termMonths,
  }) async => [
    {'sk': 'loan-product'},
  ];
}

void main() {
  test(
    'binding a different actor clears customer state without notifying during proxy update',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api)..bindMoneyScope('demo', 'alice');
      await bank.load();
      await bank.loadLoans();
      expect(bank.accounts, isNotEmpty);
      expect(bank.identity, isNotEmpty);
      expect(bank.loans, isNotEmpty);
      var notifications = 0;
      bank.addListener(() => notifications++);
      bank.bindMoneyScope('demo', 'bob');
      expect(bank.accounts, isEmpty);
      expect(bank.payees, isEmpty);
      expect(bank.disputes, isEmpty);
      expect(bank.identity, isEmpty);
      expect(bank.loans, isEmpty);
      expect(bank.applications, isEmpty);
      expect(bank.open, isEmpty);
      expect(bank.loan, isEmpty);
      expect(bank.loading, isFalse);
      expect(bank.busy, isFalse);
      expect(notifications, 0);
      bank.dispose();
    },
  );

  for (final delayed in ['accounts', 'identity', 'loans']) {
    test(
      'old actor slow $delayed read cannot publish into a new authenticated scope',
      () async {
        final api = _Api()..delay = delayed;
        final bank = BankingProvider(api: api)..bindMoneyScope('demo', 'alice');
        final first = delayed == 'loans'
            ? bank.loadLoans()
            : delayed == 'identity'
            ? bank.loadIdentity()
            : bank.load();
        await api.started.future;
        bank.bindMoneyScope('demo', 'bob');
        api.actor = 'bob';
        if (delayed == 'loans') {
          await bank.loadLoans();
        } else if (delayed == 'identity') {
          await bank.loadIdentity();
        } else {
          await bank.load();
        }
        api.old.complete();
        await first;
        if (delayed == 'loans')
          expect(bank.loans.single['sk'], 'bob-loan');
        else if (delayed == 'identity')
          expect(bank.identityDetails['name'], 'bob');
        else
          expect(bank.accounts.single['sk'], 'bob-account');
        expect(bank.error, isNull);
        expect(bank.identityError, isNull);
        expect(bank.loansError, isNull);
        bank.dispose();
      },
    );
  }

  test(
    'old actor secondary identity response cannot overwrite new account-page identity',
    () async {
      final api = _Api()..delay = 'identity';
      final bank = BankingProvider(api: api)..bindMoneyScope('demo', 'alice');
      final first = bank.load();
      await api.started.future;
      bank.bindMoneyScope('demo', 'bob');
      api.actor = 'bob';
      await bank.load();
      api.old.complete();
      await first;
      expect(bank.accounts.single['sk'], 'bob-account');
      expect(bank.identityDetails['name'], 'bob');
      expect(bank.payees.single['sk'], 'bob-payee');
      bank.dispose();
    },
  );
}
