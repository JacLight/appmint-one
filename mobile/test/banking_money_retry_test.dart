import 'dart:async';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:appmint_one/providers/banking_provider.dart';
import 'package:appmint_one/services/banking_api.dart';
import 'package:appmint_one/services/storage_service.dart';

/// Models a server that committed the write but lost the first response.
class _LedgerApi extends Fake implements BankingApi {
  @override
  void bindVerificationScope(String scope) {}
  bool loseNextResponse = true;
  String responseStatus = 'posted';
  Completer<void>? gate;
  Completer<void>? started;
  final calls = <Map<String, dynamic>>[];
  final committed = <String, String>{};

  Future<Map<String, dynamic>> write(
    String kind,
    String? key,
    List<Object?> payload,
  ) async {
    expect(key, isNotNull);
    expect(key, isNotEmpty);
    calls.add({'kind': kind, 'key': key, 'payload': payload});
    if (started != null && !started!.isCompleted) started!.complete();
    if (gate != null) await gate!.future;
    final fingerprint = jsonEncode([kind, ...payload]);
    if (committed.containsKey(key)) {
      expect(
        committed[key],
        fingerprint,
        reason: 'a key may never be reused for changed details',
      );
    } else {
      committed[key!] = fingerprint;
    }
    if (loseNextResponse) {
      loseNextResponse = false;
      throw TimeoutException('Response was lost after commit');
    }
    return {
      'sk': key,
      'data': {'status': responseStatus},
    };
  }

  @override
  Future<Map<String, dynamic>> transfer({
    required String from,
    required String toAccountNumber,
    required int amountCents,
    String? memo,
    String? idempotencyKey,
  }) => write('transfer', idempotencyKey, [
    from,
    toAccountNumber,
    amountCents,
    memo ?? '',
  ]);
  @override
  Future<Map<String, dynamic>> pay({
    required String account,
    required String counterparty,
    required String rail,
    required int amountCents,
    bool sameDay = false,
    String? memo,
    String? idempotencyKey,
  }) => write('pay', idempotencyKey, [
    account,
    counterparty,
    rail,
    amountCents,
    sameDay,
    memo ?? '',
  ]);
  @override
  Future<Map<String, dynamic>> pull({
    required String account,
    required String counterparty,
    required int amountCents,
    String? idempotencyKey,
  }) => write('pull', idempotencyKey, [account, counterparty, amountCents]);
  @override
  Future<Map<String, dynamic>> payLoan(
    String id, {
    required int amountCents,
    required String fromAccount,
    String? idempotencyKey,
  }) => write('loan', idempotencyKey, [id, fromAccount, amountCents]);
}

class _Bank extends BankingProvider {
  _Bank({required BankingApi api, StorageService? storage})
    : super(api: api, storage: storage);
  bool failRefresh = false;
  @override
  Future<void> load() async {
    if (failRefresh) throw StateError('Balance unavailable');
  }

  @override
  Future<void> refreshOpen() async {}
  @override
  Future<void> refreshLoan() async {}
  @override
  Future<void> loadLoans() async {}
}

Future<String?> _send(BankingProvider bank, String kind, {int amount = 100}) =>
    switch (kind) {
      'transfer' => bank.transfer(
        from: 'checking',
        toAccountNumber: '12345678',
        amountCents: amount,
        memo: 'Test',
      ),
      'pay' => bank.pay(
        account: 'checking',
        counterparty: 'payee',
        rail: 'ach',
        amountCents: amount,
        memo: 'Test',
      ),
      'pull' => bank.pull(
        account: 'checking',
        counterparty: 'payee',
        amountCents: amount,
      ),
      _ => bank.payLoan(
        loanId: 'loan',
        fromAccount: 'checking',
        amountCents: amount,
      ),
    };

class _UnavailableStorage extends Fake implements StorageService {
  @override
  Future<String> getOrCreateBankingIntent(
    String intent,
    String Function() makeKey,
  ) async => throw StateError('Secure store unavailable');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final kind in ['transfer', 'pay', 'pull', 'loan']) {
    test(
      '$kind retries a committed/lost-response intent with its original key; confirmed new intent gets a new key',
      () async {
        final api = _LedgerApi();
        final bank = _Bank(api: api);
        expect(await _send(bank, kind), contains('unchanged details'));
        expect(api.committed.length, 1);
        expect(await _send(bank, kind), isNull);
        expect(api.calls[0]['key'], api.calls[1]['key']);
        expect(
          api.committed.length,
          1,
          reason: 'retry must not move money twice',
        );
        expect(await _send(bank, kind), isNull);
        expect(api.calls[2]['key'], isNot(api.calls[0]['key']));
        expect(
          api.committed.length,
          2,
          reason: 'a later confirmed new intent is allowed',
        );
        bank.dispose();
      },
    );
  }

  test(
    'changing intent details preserves the unresolved original key when returning to it',
    () async {
      final api = _LedgerApi();
      final bank = _Bank(api: api);
      await _send(bank, 'transfer', amount: 100);
      await _send(bank, 'transfer', amount: 200);
      await _send(bank, 'transfer', amount: 100);
      expect(api.calls[0]['key'], api.calls[2]['key']);
      expect(api.calls[1]['key'], isNot(api.calls[0]['key']));
      expect(api.committed.length, 2);
      bank.dispose();
    },
  );

  test(
    'concurrent identical taps share one in-flight server request',
    () async {
      final api = _LedgerApi()..loseNextResponse = false;
      api.gate = Completer<void>();
      api.started = Completer<void>();
      final bank = _Bank(api: api);
      final first = _send(bank, 'pay');
      final second = _send(bank, 'pay');
      expect(identical(first, second), isTrue);
      await api.started!.future;
      expect(api.calls.length, 1);
      expect(bank.busy, isTrue);
      api.gate!.complete();
      expect(await first, isNull);
      expect(await second, isNull);
      expect(bank.busy, isFalse);
      expect(api.committed.length, 1);
      bank.dispose();
    },
  );

  test(
    'a balance refresh failure cannot report a confirmed payment as failed',
    () async {
      final api = _LedgerApi()..loseNextResponse = false;
      final bank = _Bank(api: api)..failRefresh = true;
      expect(await _send(bank, 'loan'), isNull);
      expect(bank.busy, isFalse);
      expect(await _send(bank, 'loan'), isNull);
      expect(api.calls[0]['key'], isNot(api.calls[1]['key']));
      expect(api.committed.length, 2);
      bank.dispose();
    },
  );
  test(
    'pending receipts keep the intent key until posted confirmation',
    () async {
      final api = _LedgerApi()
        ..loseNextResponse = false
        ..responseStatus = 'pending';
      final bank = _Bank(api: api);
      expect(await _send(bank, 'transfer'), isNull);
      expect(bank.lastMoneyStatus, 'pending');
      expect(await _send(bank, 'transfer'), isNull);
      api.responseStatus = 'posted';
      expect(await _send(bank, 'transfer'), isNull);
      expect(bank.lastMoneyStatus, 'posted');
      expect(api.calls.take(3).map((c) => c['key']).toSet().length, 1);
      await _send(bank, 'transfer');
      expect(api.calls[3]['key'], isNot(api.calls[0]['key']));
      bank.dispose();
    },
  );

  test(
    'terminal failed receipt is not payment success; explicit new attempt uses a fresh key',
    () async {
      final api = _LedgerApi()
        ..loseNextResponse = false
        ..responseStatus = 'failed';
      final bank = _Bank(api: api);
      expect(await _send(bank, 'pay'), contains('failed'));
      expect(bank.lastMoneyStatus, isNull);
      api.responseStatus = 'posted';
      expect(await _send(bank, 'pay'), isNull);
      expect(api.calls[0]['key'], isNot(api.calls[1]['key']));
      bank.dispose();
    },
  );

  test(
    'an unknown receipt status retains the key and never confirms movement',
    () async {
      final api = _LedgerApi()
        ..loseNextResponse = false
        ..responseStatus = 'unknown';
      final bank = _Bank(api: api);
      expect(await _send(bank, 'pull'), contains('No payment confirmation'));
      expect(bank.lastMoneyStatus, isNull);
      api.responseStatus = 'posted';
      expect(await _send(bank, 'pull'), isNull);
      expect(api.calls[0]['key'], api.calls[1]['key']);
      bank.dispose();
    },
  );

  test(
    'changing rail or same-day instruction never reuses an unresolved key for another payload',
    () async {
      final api = _LedgerApi();
      final bank = _Bank(api: api);
      await bank.pay(
        account: 'a',
        counterparty: 'p',
        rail: 'ach',
        amountCents: 100,
      );
      await bank.pay(
        account: 'a',
        counterparty: 'p',
        rail: 'ach',
        amountCents: 100,
        sameDay: true,
      );
      await bank.pay(
        account: 'a',
        counterparty: 'p',
        rail: 'wire',
        amountCents: 100,
      );
      await bank.pay(
        account: 'a',
        counterparty: 'p',
        rail: 'ach',
        amountCents: 100,
      );
      expect(api.calls.take(3).map((c) => c['key']).toSet().length, 3);
      expect(api.calls[3]['key'], api.calls[0]['key']);
      bank.dispose();
    },
  );
  test(
    'auth customer/org changes do not carry unresolved keys across joint-account actors',
    () async {
      final api = _LedgerApi();
      final bank = _Bank(api: api)..bindMoneyScope('demo', 'alice');
      await _send(bank, 'transfer');
      bank.bindMoneyScope('demo', 'bob');
      await _send(bank, 'transfer');
      bank.bindMoneyScope('other-org', 'bob');
      await _send(bank, 'transfer');
      expect(api.calls.map((c) => c['key']).toSet().length, 3);
      bank.dispose();
    },
  );

  test(
    'an old actor in-flight write cannot publish its receipt into a new session',
    () async {
      final api = _LedgerApi()..loseNextResponse = false;
      api.gate = Completer<void>();
      api.started = Completer<void>();
      final bank = _Bank(api: api)..bindMoneyScope('demo', 'alice');
      String? oldReceipt;
      String? newReceipt;
      final old = bank.transfer(
        from: 'joint',
        toAccountNumber: '1234',
        amountCents: 100,
        onReceipt: (s) => oldReceipt = s,
      );
      await api.started!.future;
      api.started = Completer<void>();
      bank.bindMoneyScope('demo', 'bob');
      final current = bank.transfer(
        from: 'joint',
        toAccountNumber: '1234',
        amountCents: 100,
        onReceipt: (s) => newReceipt = s,
      );
      await api.started!.future;
      expect(api.calls.length, 2);
      expect(api.calls[0]['key'], isNot(api.calls[1]['key']));
      api.gate!.complete();
      expect(await old, contains('Sign-in changed'));
      expect(await current, isNull);
      expect(oldReceipt, isNull);
      expect(newReceipt, 'posted');
      expect(bank.busy, isFalse);
      bank.dispose();
    },
  );
  test(
    'an unresolved write recovers the same key after provider recreation',
    () async {
      final api = _LedgerApi();
      final first = _Bank(api: api)..bindMoneyScope('demo', 'alice');
      await _send(first, 'transfer');
      first.dispose();
      final second = _Bank(api: api)..bindMoneyScope('demo', 'alice');
      expect(await _send(second, 'transfer'), isNull);
      expect(api.calls[0]['key'], api.calls[1]['key']);
      second.dispose();
      final third = _Bank(api: api)..bindMoneyScope('demo', 'alice');
      expect(await _send(third, 'transfer'), isNull);
      expect(api.calls[2]['key'], isNot(api.calls[1]['key']));
      third.dispose();
    },
  );

  test(
    'pending recovery survives signout and still remains scoped to the same actor',
    () async {
      final api = _LedgerApi()
        ..loseNextResponse = false
        ..responseStatus = 'pending';
      final bank = _Bank(api: api)..bindMoneyScope('demo', 'alice');
      await _send(bank, 'loan');
      final original = api.calls.last['key'];
      bank.bindMoneyScope('demo', null);
      bank.bindMoneyScope('demo', 'bob');
      await _send(bank, 'loan');
      expect(api.calls.last['key'], isNot(original));
      bank.bindMoneyScope('demo', 'alice');
      await _send(bank, 'loan');
      expect(api.calls.last['key'], original);
      bank.dispose();
    },
  );

  test(
    'secure persistence must succeed before any money request is sent',
    () async {
      final api = _LedgerApi();
      final bank = _Bank(api: api, storage: _UnavailableStorage());
      expect(await _send(bank, 'pay'), contains('Payment not sent'));
      expect(api.calls, isEmpty);
      expect(bank.busy, isFalse);
      bank.dispose();
    },
  );

  test(
    'concurrent secure intent saves do not lose another request recovery key',
    () async {
      final store = StorageService();
      final keys = await Future.wait([
        store.getOrCreateBankingIntent('org-alice-first', () => 'first-key'),
        store.getOrCreateBankingIntent('org-alice-second', () => 'second-key'),
      ]);
      expect(keys, ['first-key', 'second-key']);
      expect(
        await store.getOrCreateBankingIntent('org-alice-first', () => 'wrong'),
        'first-key',
      );
      expect(
        await store.getOrCreateBankingIntent('org-alice-second', () => 'wrong'),
        'second-key',
      );
    },
  );
}
