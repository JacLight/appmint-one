import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:appmint_one/providers/banking_provider.dart';
import 'package:appmint_one/services/banking_api.dart';
import 'package:appmint_one/services/http_client.dart';

class _Api extends Fake implements BankingApi {
  @override
  void bindVerificationScope(String scope) {}
  bool failTransactions = false;
  bool failPayees = false;
  String? withdrawn;
  Map<String, dynamic>? business;
  Completer<Map<String, dynamic>>? slowMore;
  final loanPages = <int>[];
  final applicationPages = <int>[];
  @override
  Future<Map<String, dynamic>> account(String id) async => {'sk': id};
  @override
  Future<List<Map<String, dynamic>>> accounts() async => [
    {'sk': 'a'},
  ];
  @override
  Future<Map<String, dynamic>> identity() async => {'status': 'verified'};
  @override
  Future<List<Map<String, dynamic>>> payees() async {
    if (failPayees) throw Exception('Payee service unavailable');
    return [];
  }

  @override
  Future<List<Map<String, dynamic>>> products() async => [];
  @override
  Future<List<Map<String, dynamic>>> disputes() async => [
    {'sk': 'claim', 'status': withdrawn == null ? 'submitted' : 'withdrawn'},
  ];
  @override
  Future<List<Map<String, dynamic>>> cards(String id) async => [];
  @override
  Future<List<Map<String, dynamic>>> statements(String id) async => [];
  @override
  Future<Map<String, dynamic>> transactions(
    String id, {
    int page = 1,
    int pageSize = 50,
  }) async {
    if (failTransactions) throw Exception('Activity unavailable');
    if (page > 1 && slowMore != null) return slowMore!.future;
    return {
      'total': 2,
      'data': [
        {'sk': '$id-$page'},
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> myLoans({
    int page = 1,
    int pageSize = 25,
    String? status,
  }) async {
    loanPages.add(page);
    return {
      'total': 2,
      'data': [
        {'sk': 'loan-$page', 'owed': page * 100},
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> loanApplications({
    int page = 1,
    int pageSize = 25,
    String? status,
  }) async {
    applicationPages.add(page);
    return {
      'total': 2,
      'data': [
        {'sk': 'application-$page'},
      ],
    };
  }

  @override
  Future<List<Map<String, dynamic>>> loanProducts({
    int? amountCents,
    int? termMonths,
  }) async => [];
  @override
  Future<Map<String, dynamic>> withdrawDispute(String id) async {
    withdrawn = id;
    return {};
  }

  @override
  Future<Map<String, dynamic>> openAccount({
    required String product,
    String? nickname,
    Map<String, dynamic>? business,
  }) async {
    this.business = business;
    return {};
  }
}

void main() {
  test(
    'transaction load more uses the next server page and retains previous activity',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api);
      await bank.openAccountView('a');
      expect(bank.hasMoreTransactions, true);
      await bank.loadMoreTransactions();
      expect(bank.transactions.map((r) => r['sk']), ['a-1', 'a-2']);
      expect(bank.hasMoreTransactions, false);
      bank.dispose();
    },
  );
  test('a late activity page cannot leak into a different account', () async {
    final api = _Api();
    final bank = BankingProvider(api: api);
    await bank.openAccountView('a');
    api.slowMore = Completer();
    final more = bank.loadMoreTransactions();
    await bank.openAccountView('b');
    api.slowMore!.complete({
      'total': 2,
      'data': [
        {'sk': 'a-2'},
      ],
    });
    await more;
    expect(bank.transactions.single['sk'], 'b-1');
    expect(bank.transactionsLoading, false);
    bank.dispose();
  });
  test(
    'loan and application archives read every server page before calculating totals',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api);
      await bank.loadLoans();
      expect(api.loanPages, [1, 2]);
      expect(api.applicationPages, [1, 2]);
      expect(bank.totalOwed, 300);
      expect(bank.applications.length, 2);
      bank.dispose();
    },
  );
  test(
    'failed secondary reads expose retry errors rather than reporting empty history',
    () async {
      final api = _Api()
        ..failPayees = true
        ..failTransactions = true;
      final bank = BankingProvider(api: api);
      await bank.load();
      await bank.openAccountView('a');
      expect(bank.sectionError('payees'), contains('unavailable'));
      expect(bank.sectionError('transactions'), contains('unavailable'));
      api.failTransactions = false;
      await bank.refreshOpen();
      expect(bank.sectionError('transactions'), isNull);
      bank.dispose();
    },
  );
  test(
    'withdrawal uses the existing dispute action and refreshes the customer claim list',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api);
      await bank.loadDisputes();
      expect(await bank.withdrawDispute('claim'), isNull);
      expect(api.withdrawn, 'claim');
      expect(bank.disputes.single['status'], 'withdrawn');
      bank.dispose();
    },
  );
  test(
    'business opening forwards business details to the existing account API',
    () async {
      final api = _Api();
      final bank = BankingProvider(api: api);
      final business = {
        'legalName': 'Example LLC',
        'ein': '123456789',
        'entityType': 'LLC',
      };
      expect(await bank.openNewAccount('product', business: business), isNull);
      expect(api.business, business);
      bank.dispose();
    },
  );
  test(
    'binary downloads keep existing dual auth and recover one expired customer session',
    () async {
      final seen = <String?>[];
      var refreshes = 0;
      final client = AppengineHttpClient.forTesting(
        MockClient((request) async {
          if (request.url.path == '/profile/app/key')
            return http.Response('{"token":"app"}', 200);
          expect(request.headers['authorization'], 'Bearer app');
          seen.add(request.headers['x-client-authorization']);
          return request.headers['x-client-authorization'] == 'Bearer fresh'
              ? http.Response.bytes(
                  utf8.encode('%PDF-final'),
                  200,
                  headers: {'content-type': 'application/pdf'},
                )
              : http.Response('{"message":"Expired"}', 401);
        }),
      );
      client.setUserToken('old');
      client.refreshUserToken = () async {
        refreshes++;
        client.setUserToken('fresh');
        return 'fresh';
      };
      expect(
        utf8.decode(
          await client.getBytes('/client/banking/accounts/a/statements/s/pdf'),
        ),
        '%PDF-final',
      );
      expect(seen, ['Bearer old', 'Bearer fresh']);
      expect(refreshes, 1);
    },
  );
  test('binary download errors remain readable server errors', () async {
    final client = AppengineHttpClient.forTesting(
      MockClient(
        (request) async => request.url.path == '/profile/app/key'
            ? http.Response('{"token":"app"}', 200)
            : http.Response('{"message":"Statement not found"}', 404),
      ),
    );
    await expectLater(
      client.getBytes('/client/banking/accounts/a/statements/s/pdf'),
      throwsA(
        predicate((error) => error.toString().contains('Statement not found')),
      ),
    );
  });
  test(
    'statement and dispute archive APIs follow the backend page contract without truncation',
    () async {
      final pages = <String>[];
      final client = AppengineHttpClient.forTesting(
        MockClient((request) async {
          if (request.url.path == '/profile/app/key')
            return http.Response('{"token":"app"}', 200);
          final page = request.url.queryParameters['page'];
          pages.add('${request.url.path}:$page');
          return http.Response(
            jsonEncode({
              'total': 2,
              'data': [
                {
                  'sk': 'record-$page',
                  'data': {'status': 'ready'},
                },
              ],
            }),
            200,
          );
        }),
      );
      final api = BankingApi.forTesting(client);
      expect((await api.statements('a')).map((row) => row['sk']), [
        'record-1',
        'record-2',
      ]);
      expect((await api.disputes()).length, 2);
      expect(pages.length, 4);
    },
  );
  test(
    'loan corrections and condition evidence adapt existing customer routes without approving conditions',
    () async {
      final calls = <Map<String, dynamic>>[];
      final client = AppengineHttpClient.forTesting(
        MockClient((request) async {
          if (request.url.path == '/profile/app/key')
            return http.Response('{"token":"app"}', 200);
          calls.add({
            'method': request.method,
            'path': request.url.path,
            'body': jsonDecode(request.body),
          });
          return http.Response('{}', 200);
        }),
      );
      final api = BankingApi.forTesting(client);
      await api.updateLoanApplication('application', {
        'income': {'grossMonthly': 10000},
      });
      await api.attachLoanDocument(
        'application',
        'banking/photo.jpg',
        kind: 'income',
      );
      await api.respondToLoanCondition(
        'application',
        2,
        text: 'Evidence provided',
        documents: [
          {'path': 'banking/photo.jpg'},
        ],
      );
      expect(calls[0], {
        'method': 'PUT',
        'path': '/client/banking/loans/applications/application',
        'body': {
          'income': {'grossMonthly': 10000},
        },
      });
      expect(
        calls[1]['path'],
        '/client/banking/loans/applications/application/documents',
      );
      expect(calls[2]['body'], {
        'text': 'Evidence provided',
        'documents': [
          {'path': 'banking/photo.jpg'},
        ],
      });
      expect(
        calls[2]['path'],
        '/client/banking/loans/applications/application/conditions/2/respond',
      );
      expect(calls[2]['body'].containsKey('status'), isFalse);
    },
  );
}
