import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:appmint_one/services/banking_api.dart';
import 'package:appmint_one/services/http_client.dart';
import 'package:appmint_one/services/storage_service.dart';
import 'package:appmint_one/screens/modules/money/banking/bank_verification.dart';

class _UnavailableProofStore extends Fake implements StorageService {
  @override
  Future<String?> bankingProof(String key) async => null;
  @override
  Future<void> saveBankingProof(String key, String proof) async =>
      throw StateError('Secure store unavailable');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  const scope = '["org","customer"]';
  BankingApi apiFor(
    Future<http.Response> Function(http.Request) handler, {
    StorageService? storage,
  }) {
    final client = AppengineHttpClient.forTesting(
      MockClient((request) async {
        if (request.url.path == '/profile/app/key')
          return http.Response('{"token":"app"}', 200);
        return handler(request);
      }),
    );
    client.setUserToken('customer-session');
    return BankingApi.forTesting(client, storage: storage)
      ..bindVerificationScope(scope);
  }

  Future<Map<String, dynamic>> transfer(BankingApi api) => api.transfer(
    from: 'source',
    toAccountNumber: 'target',
    amountCents: 100,
    idempotencyKey: 'stable-key',
  );
  test(
    'approved opaque proof is securely durable before the money request',
    () async {
      var confirmations = 0;
      final key = jsonEncode([scope, 'transfer', 'stable-key']);
      final api = apiFor((request) async {
        final body = jsonDecode(request.body) as Map;
        if (request.url.path.endsWith('/security/reviews'))
          return http.Response('{"required":true,"challengeId":"review"}', 200);
        expect(
          request.headers['x-client-authorization'],
          'Bearer customer-session',
        );
        expect(body['bankingProof'], 'opaque-proof');
        expect(await StorageService().bankingProof(key), 'opaque-proof');
        return http.Response('{"sk":"txn","data":{"status":"pending"}}', 200);
      });
      api.confirmVerification = (_) async {
        confirmations++;
        return 'opaque-proof';
      };
      await transfer(api);
      expect(confirmations, 1);
      expect(await StorageService().bankingProof(key), 'opaque-proof');
    },
  );
  test(
    'process recreation reuses unresolved proof/key after a lost response',
    () async {
      var attempts = 0, confirmations = 0;
      Future<http.Response> handler(http.Request request) async {
        final body = jsonDecode(request.body) as Map;
        if (request.url.path.endsWith('/security/reviews')) {
          final existing = (body['request'] as Map)['bankingProof'];
          return http.Response(
            jsonEncode(
              existing == null
                  ? {'required': true, 'challengeId': 'review'}
                  : {'required': true, 'proof': existing},
            ),
            200,
          );
        }
        attempts++;
        return attempts == 1
            ? http.Response('{"message":"Response lost"}', 503)
            : http.Response(
                '{"sk":"same-txn","data":{"status":"posted"}}',
                200,
              );
      }

      final first = apiFor(handler)
        ..confirmVerification = (_) async {
          confirmations++;
          return 'durable-proof';
        };
      await expectLater(transfer(first), throwsException);
      final recreated = apiFor(handler)
        ..confirmVerification = (_) async {
          fail('Existing proof should be recovered');
        };
      expect((await transfer(recreated))['sk'], 'same-txn');
      expect(confirmations, 1);
    },
  );
  test('secure proof persistence failure sends no money request', () async {
    var moneyCalls = 0;
    final api = apiFor(
      (request) async {
        if (request.url.path.endsWith('/security/reviews'))
          return http.Response('{"required":true,"challengeId":"review"}', 200);
        moneyCalls++;
        return http.Response('{}', 200);
      },
      storage: _UnavailableProofStore(),
    )..confirmVerification = (_) async => 'proof';
    await expectLater(transfer(api), throwsStateError);
    expect(moneyCalls, 0);
  });
  test('session change while confirming cannot send old actor money', () async {
    var moneyCalls = 0;
    final waiting = Completer<String?>(), started = Completer<void>();
    final api =
        apiFor((request) async {
            if (request.url.path.endsWith('/security/reviews'))
              return http.Response(
                '{"required":true,"challengeId":"review"}',
                200,
              );
            moneyCalls++;
            return http.Response('{}', 200);
          })
          ..confirmVerification = (_) {
            started.complete();
            return waiting.future;
          };
    final result = transfer(api);
    await started.future;
    api.bindVerificationScope('["org","other"]');
    waiting.complete('old-proof');
    await expectLater(result, throwsStateError);
    expect(moneyCalls, 0);
  });
  test('off policy does not invent a code challenge', () async {
    var moneyCalls = 0;
    final api =
        apiFor((request) async {
            if (request.url.path.endsWith('/security/reviews'))
              return http.Response('{"required":false}', 200);
            moneyCalls++;
            expect(jsonDecode(request.body), isNot(contains('bankingProof')));
            return http.Response('{"data":{"status":"pending"}}', 200);
          })
          ..confirmVerification = (_) async {
            fail('Off policy must not ask for code');
          };
    await transfer(api);
    expect(moneyCalls, 1);
  });
  test(
    'member and request payments reuse signed portal review with durable proof/key recovery',
    () async {
      var attempts = 0;
      final keys = <String>[];
      Future<http.Response> handler(http.Request request) async {
        final body = jsonDecode(request.body) as Map;
        if (request.url.path.endsWith('/members/resolve'))
          return http.Response(
            '{"found":true,"recipientToken":"opaque-recipient","name":"Member"}',
            200,
          );
        if (request.url.path.endsWith('/portal/transfers/preview')) {
          expect(body['kind'], 'request');
          return http.Response('{"previewId":"signed-review"}', 200);
        }
        if (request.url.path.endsWith('/portal/transfers/security-review'))
          return http.Response(
            jsonEncode(
              body['bankingProof'] == null
                  ? {'required': true, 'challengeId': 'challenge'}
                  : {'required': true, 'proof': body['bankingProof']},
            ),
            200,
          );
        expect(body['previewId'], 'signed-review');
        expect(body['bankingProof'], 'proof');
        keys.add(body['idempotencyKey'].toString());
        attempts++;
        return attempts == 1
            ? http.Response('{"message":"Lost response"}', 503)
            : http.Response('{"id":"same","status":"completed"}', 200);
      }

      final first = apiFor(handler)..confirmVerification = (_) async => 'proof';
      expect(
        (await first.resolveMember('exact-user'))['recipientToken'],
        'opaque-recipient',
      );
      await first.previewRequestPayment({
        'requestId': 'request',
        'fromAccountId': 'source',
      });
      await expectLater(
        first.confirmPortalPayment('signed-review'),
        throwsException,
      );
      final recovered = apiFor(handler)
        ..confirmVerification = (_) async {
          fail('Existing exact proof must recover');
        };
      expect(
        (await recovered.confirmPortalPayment('signed-review'))['status'],
        'completed',
      );
      expect(keys.toSet(), hasLength(1));
      expect(keys.first, isNotEmpty);
    },
  );
  test(
    'autopay uses actual agreement/status operations and never submits an enabled or consent flag',
    () async {
      final operations = <String>[];
      final api = apiFor((request) async {
        final body = jsonDecode(request.body) as Map;
        if (request.url.path.endsWith('/security/reviews')) {
          operations.add(body['operation'].toString());
          return http.Response('{"required":false}', 200);
        }
        expect(body.containsKey('enabled'), false);
        expect(body.containsKey('consent'), false);
        return http.Response(
          '{"status":"awaiting_agreement","instructionId":"instruction"}',
          200,
        );
      });
      await api.requestLoanAutopay(
        'loan',
        account: 'source',
        startsOn: '2026-11-01',
        maximum: 1000,
      );
      await api.confirmLoanAutopay('loan', 'instruction');
      await api.revokeLoanAutopay('loan', 'instruction');
      expect(operations, [
        'autopay_agreement',
        'autopay_confirm',
        'autopay_revoke',
      ]);
    },
  );
  testWidgets(
    'shared confirmation names the approved authenticator, has no resend, and cancellation resolves without a request',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: bankingNavigatorKey,
          home: const Scaffold(body: Text('Bank')),
        ),
      );
      final result = confirmBankingReview({
        'challengeId': 'review',
        'summary': {'amount': 1234},
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('approved by your bank'), findsOneWidget);
      expect(find.textContaining('Resend'), findsNothing);
      expect(find.textContaining('12.34'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(await result, isNull);
    },
  );
}
