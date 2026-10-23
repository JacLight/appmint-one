import 'dart:convert';
import 'storage_service.dart';
import 'dart:math';
import 'package:flutter/foundation.dart';

import 'http_client.dart';

/// Retail banking — `@Controller('client/banking')`.
///
/// Every path here is a real route on that controller. Two rules come from the
/// server and are held to everywhere in this module:
///
///  * **Money is in cents.** Nothing in this app passes a decimal amount to
///    the server or reads one back as dollars. [Money] does the conversion at
///    the edges and nowhere else.
///  * **Moving money needs an idempotency key.** A tapped-twice Send must not
///    become two payments, so every transfer, payment and pull carries one
///    generated at the moment the person commits.
class BankingApi {
  static final BankingApi _instance = BankingApi._();
  factory BankingApi() => _instance;
  BankingApi._()
    : _http = appengineHttpClient,
      _verificationStorage = StorageService();
  @visibleForTesting
  BankingApi.forTesting(this._http, {StorageService? storage})
    : _verificationStorage = storage ?? StorageService();

  final AppengineHttpClient _http;
  final StorageService _verificationStorage;
  static const _base = '/client/banking';

  Map<String, dynamic> _map(dynamic r) =>
      r is Map ? Map<String, dynamic>.from(r) : <String, dynamic>{};

  List<Map<String, dynamic>> _records(dynamic r) {
    dynamic list;
    if (r is List) {
      list = r;
    } else if (r is Map) {
      list = r['data'] ?? r['items'] ?? r['results'] ?? r['rows'] ?? [];
    }
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// A record as stored — `{sk, data: {...}}` — read flat, with the envelope's
  /// id kept.
  Map<String, dynamic> _flat(dynamic r) {
    if (r is! Map) return <String, dynamic>{};
    final row = Map<String, dynamic>.from(r);
    final data = row['data'];
    if (data is! Map) return row;
    final flat = <String, dynamic>{...row}..remove('data');
    flat.addAll(Map<String, dynamic>.from(data));
    for (final k in ['sk', 'pk', 'createdate', 'modifydate']) {
      if (row[k] != null) flat[k] = row[k];
    }
    return flat;
  }

  List<Map<String, dynamic>> _flatList(dynamic r) => [
    for (final row in _records(r)) _flat(row),
  ];

  /// One key per committed action. Random enough that two phones cannot
  /// collide, stable for the life of one submit.
  static String newKey() {
    final r = Random.secure();
    final bits = List<int>.generate(
      8,
      (_) => r.nextInt(256),
    ).map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${DateTime.now().millisecondsSinceEpoch.toRadixString(16)}-$bits';
  }

  String _verificationScope = 'unbound';
  int _verificationGeneration = 0;
  int get verificationGeneration => _verificationGeneration;
  Future<String?> Function(Map<String, dynamic> review)? confirmVerification;
  void bindVerificationScope(String scope) {
    if (_verificationScope != scope) {
      _verificationScope = scope;
      _verificationGeneration++;
    }
  }

  void _sameVerificationSession(int generation) {
    if (generation != _verificationGeneration)
      throw StateError('Your banking session changed. Start again.');
  }

  Future<Map<String, dynamic>> securityStatus() async =>
      _map(await _http.get('$_base/security/status'));
  Future<Map<String, dynamic>> setupAuthenticator() async => _map(
    await _http.post(
      '/profile/security/2fa/setup/authenticator',
      body: const {},
    ),
  );
  Future<void> confirmAuthenticatorSetup(String code) async {
    await _http.post(
      '/profile/security/2fa/verify-setup',
      body: {'code': code},
    );
  }

  Future<String> verifyBankReview(String challengeId, String code) async {
    final generation = _verificationGeneration;
    final response = _map(
      await _http.post(
        '$_base/security/reviews/$challengeId/verify',
        body: {'code': code},
      ),
    );
    _sameVerificationSession(generation);
    if (response['proof'] is! String)
      throw StateError('The bank did not confirm verification.');
    return response['proof'] as String;
  }

  Future<Map<String, dynamic>> receivingPreference() async =>
      _map(await _http.get('$_base/receiving'));
  Future<Map<String, dynamic>> updateReceiving(
    Map<String, dynamic> body,
  ) async => _map(await _http.put('$_base/receiving', body: body));
  Future<Map<String, dynamic>> receiveDetails(String accountId) async =>
      _map(await _http.get('$_base/accounts/$accountId/receive-details'));
  Future<Map<String, dynamic>> resolveMember(String username) async => _map(
    await _http.post('$_base/members/resolve', body: {'username': username}),
  );
  Future<Map<String, dynamic>> moneyRequests(
    String direction, {
    int page = 1,
  }) async => _map(
    await _http.get(
      '$_base/requests',
      queryParams: {'direction': direction, 'page': page.toString(), 'pageSize': '25'},
    ),
  );
  Future<Map<String, dynamic>> createMoneyRequest(
    Map<String, dynamic> body,
  ) async => _map(await _http.post('$_base/requests', body: body));
  Future<Map<String, dynamic>> moneyRequest(String id, {String? token}) async =>
      _map(
        await _http.get(
          '$_base/requests/$id',
          queryParams: {if (token != null) 'token': token},
        ),
      );
  Future<Map<String, dynamic>> closeMoneyRequest(
    String id,
    String action,
  ) async {
    if (!['cancel', 'decline'].contains(action))
      throw ArgumentError('Unsupported request change.');
    return _map(
      await _http.post('$_base/requests/$id/$action', body: const {}),
    );
  }

  Future<Map<String, dynamic>> shareMoneyRequest(String id) async =>
      _map(await _http.post('$_base/requests/$id/share', body: const {}));
  Future<Map<String, dynamic>> previewMemberPayment(
    Map<String, dynamic> request,
  ) async => _map(
    await _http.post(
      '$_base/portal/transfers/preview',
      body: {...request, 'kind': 'internal'},
    ),
  );
  Future<Map<String, dynamic>> previewRequestPayment(
    Map<String, dynamic> request,
  ) async => _map(
    await _http.post(
      '$_base/portal/transfers/preview',
      body: {...request, 'kind': 'request'},
    ),
  );
  Future<Map<String, dynamic>> confirmPortalPayment(String previewId) =>
      _moneyPost(
        'portal',
        '$_base/portal/transfers',
        body: {'previewId': previewId},
        portal: true,
      );
  Future<Map<String, dynamic>> loanAutopay(String id) async =>
      _map(await _http.get('$_base/loans/$id/autopay'));
  Future<Map<String, dynamic>> requestLoanAutopay(
    String id, {
    required String account,
    required String startsOn,
    required int maximum,
    String? previousInstructionId,
  }) => _moneyPost(
    'autopay_agreement',
    '$_base/loans/$id/autopay/agreement',
    body: {
      'id': id,
      'account': account,
      'startsOn': startsOn,
      'maximum': maximum,
      'previousInstructionId': previousInstructionId,
    },
  );
  Future<Map<String, dynamic>> confirmLoanAutopay(
    String id,
    String instructionId,
  ) => _moneyPost(
    'autopay_confirm',
    '$_base/loans/$id/autopay/confirm',
    body: {'id': id, 'instructionId': instructionId},
  );
  Future<Map<String, dynamic>> revokeLoanAutopay(
    String id,
    String instructionId,
  ) => _moneyPost(
    'autopay_revoke',
    '$_base/loans/$id/autopay/revoke',
    body: {'id': id, 'instructionId': instructionId},
  );
  Future<Map<String, dynamic>> rotateBankAuthenticator(String factorId) =>
      _moneyPost(
        'rotate',
        '$_base/security/rotate',
        body: {'factorId': factorId},
      );

  Future<Map<String, dynamic>> _moneyPost(
    String operation,
    String path, {
    required Map<String, dynamic> body,
    bool portal = false,
  }) async {
    final generation = _verificationGeneration, scope = _verificationScope;
    final storage = _verificationStorage;
    String? ownIntent;
    if (body['idempotencyKey'] == null) {
      ownIntent = jsonEncode([
        scope,
        operation,
        body['id'] ?? body['factorId'],
      ]);
      body['idempotencyKey'] = await storage.getOrCreateBankingIntent(
        ownIntent,
        newKey,
      );
      _sameVerificationSession(generation);
    }
    final proofKey = jsonEncode([scope, operation, body['idempotencyKey']]);
    final existing = scope == 'unbound'
        ? null
        : await storage.bankingProof(proofKey);
    _sameVerificationSession(generation);
    final review = _map(
      await _http.post(
        portal
            ? '$_base/portal/transfers/security-review'
            : '$_base/security/reviews',
        body: portal
            ? {
                'previewId': body['previewId'],
                if (existing != null) 'bankingProof': existing,
              }
            : {
                'operation': operation,
                'request': {
                  ...body,
                  if (existing != null) 'bankingProof': existing,
                },
              },
      ),
    );
    _sameVerificationSession(generation);
    if (review['required'] == true) {
      if (scope == 'unbound')
        throw StateError('Sign in again before confirming money.');
      final proof = review['proof'] is String
          ? review['proof'] as String
          : await confirmVerification?.call(review);
      _sameVerificationSession(generation);
      if (proof == null || proof.isEmpty)
        throw StateError(
          'Confirmation cancelled. No new instruction was sent.',
        );
      await storage.saveBankingProof(
        proofKey,
        proof,
      ); // Must be durable before the money request.
      _sameVerificationSession(generation);
      body['bankingProof'] = proof;
    }
    final result = _map(await _http.post(path, body: body));
    _sameVerificationSession(generation);
    final transaction = result['transaction'] is Map
        ? result['transaction'] as Map
        : result;
    final data = transaction['data'] is Map
        ? transaction['data'] as Map
        : transaction;
    if ([
          'posted',
          'completed',
          'canceled',
          'cancelled',
          'withdrawn',
          'failed',
          'reversed',
          'returned',
        ].contains(data['status']) ||
        result['rotated'] == true) {
      await storage.removeBankingProof(proofKey);
      if (ownIntent != null) await storage.removeBankingIntent(ownIntent);
    }
    return result;
  }

  // ── Identity ────────────────────────────────────────────────────────────
  //
  // The check that gates everything: an account stays pending until the bank
  // has verified who its holder is. `missing` comes back as plain sentences —
  // the bank's own words for what it still needs — and they are shown as
  // written rather than re-phrased here.

  /// `{status, statusText, canEdit, details, missing[], requestedInfo,
  /// changeRequests[], accountsWaiting[]}`. Status is one of not_started,
  /// submitted, in_review, verified, needs_info, rejected.
  Future<Map<String, dynamic>> identity() async =>
      _map(await _http.get('$_base/identity'));

  /// Send or correct my details. Saved only when nothing is missing, then it
  /// goes to the bank. After verification this becomes a change request
  /// instead, and the verified details stand until the bank updates them.
  Future<Map<String, dynamic>> submitIdentity(
    Map<String, dynamic> body,
  ) async => _map(await _http.put('$_base/identity', body: body));

  /// Attach a file already uploaded through `client-data/files/upload`.
  /// `kind` is id_front, id_back, proof_of_address or selfie.
  Future<Map<String, dynamic>> attachIdentityDocument({
    required String kind,
    required String path,
    String? documentType,
    String? proofType,
    String? proofDate,
  }) async => _map(
    await _http.post(
      '$_base/identity/documents',
      body: {
        'kind': kind,
        'path': path,
        if (documentType != null) 'documentType': documentType,
        if (proofType != null) 'proofType': proofType,
        if (proofDate != null) 'proofDate': proofDate,
      },
    ),
  );

  // ── Accounts ────────────────────────────────────────────────────────────

  /// Products somebody may open an account on.
  Future<List<Map<String, dynamic>>> products() async =>
      _flatList(await _http.get('$_base/products'));

  Future<List<Map<String, dynamic>>> accounts() async =>
      _flatList(await _http.get('$_base/accounts'));

  /// One account. A pending one answers `{account, gaps}` — `gaps` being what
  /// is still needed to open it, which is the only honest thing to show
  /// somebody waiting.
  Future<Map<String, dynamic>> account(String id) async =>
      _map(await _http.get('$_base/accounts/$id'));

  Future<Map<String, dynamic>> openAccount({
    required String product,
    String? nickname,
    Map<String, dynamic>? business,
  }) async => _map(
    await _http.post(
      '$_base/accounts',
      body: {
        'product': product,
        if (nickname != null && nickname.isNotEmpty) 'nickname': nickname,
        if (business != null) 'business': business,
      },
    ),
  );

  Future<Map<String, dynamic>> rename(String id, String nickname) async => _map(
    await _http.put(
      '$_base/accounts/$id/nickname',
      body: {'nickname': nickname},
    ),
  );

  Future<Map<String, dynamic>> setOverdraft(String id, bool optedIn) async =>
      _map(
        await _http.put(
          '$_base/accounts/$id/overdraft',
          body: {'optedIn': optedIn},
        ),
      );

  Future<Map<String, dynamic>> transactions(
    String accountId, {
    int page = 1,
    int pageSize = 50,
  }) async => _map(
    await _http.get(
      '$_base/accounts/$accountId/transactions',
      queryParams: {'page': '$page', 'pageSize': '$pageSize'},
    ),
  );

  Future<List<Map<String, dynamic>>> statements(String accountId) async =>
      _archive('$_base/accounts/$accountId/statements');

  Future<Map<String, dynamic>> transaction(String id) async =>
      _map(await _http.get('$_base/transactions/$id'));

  Future<List<Map<String, dynamic>>> _archive(String path) async {
    final all = <Map<String, dynamic>>[];
    for (var page = 1; ; page++) {
      final response = await _http.get(
        path,
        queryParams: {'page': '$page', 'pageSize': '50'},
      );
      final rows = _flatList(response);
      if (response is List) return rows; // compatibility with older servers
      final total = response is Map ? response['total'] : null;
      if (rows.isEmpty) {
        if (total is num && all.length < total)
          throw StateError(
            'The archive could not be completely loaded. Try again.',
          );
        return all;
      }
      all.addAll(rows);
      if (total is num ? all.length >= total : rows.length < 50) return all;
    }
  }

  Future<Uint8List> statementPdf(String accountId, String statementId) =>
      _http.getBytes('$_base/accounts/$accountId/statements/$statementId/pdf');
  Future<Uint8List> payoffPdf(String loanId) =>
      _http.getBytes('$_loansBase/$loanId/payoff/pdf');
  Future<Uint8List> adverseActionPdf(String applicationId) => _http.getBytes(
    '$_loansBase/applications/$applicationId/adverse-action/pdf',
  );

  // ── Moving money ────────────────────────────────────────────────────────

  /// To another account at this bank, by account number.
  Future<Map<String, dynamic>> transfer({
    required String from,
    required String toAccountNumber,
    required int amountCents,
    String? memo,
    String? idempotencyKey,
  }) async => _map(
    await _moneyPost(
      'transfer',
      '$_base/transfers',
      body: {
        'from': from,
        'to': toAccountNumber,
        'amount': amountCents,
        if (memo != null && memo.isNotEmpty) 'memo': memo,
        'idempotencyKey': idempotencyKey ?? newKey(),
      },
    ),
  );

  /// To a payee at another bank. `rail` is ach, wire, rtp or fednow.
  Future<Map<String, dynamic>> pay({
    required String account,
    required String counterparty,
    required String rail,
    required int amountCents,
    bool sameDay = false,
    String? memo,
    String? idempotencyKey,
  }) async => _map(
    await _moneyPost(
      'payment',
      '$_base/payments',
      body: {
        'account': account,
        'counterparty': counterparty,
        'rail': rail,
        'amount': amountCents,
        'sameDay': sameDay,
        if (memo != null && memo.isNotEmpty) 'memo': memo,
        'idempotencyKey': idempotencyKey ?? newKey(),
      },
    ),
  );

  /// Bring money in from my own verified account elsewhere.
  Future<Map<String, dynamic>> pull({
    required String account,
    required String counterparty,
    required int amountCents,
    String? idempotencyKey,
  }) async => _map(
    await _moneyPost(
      'pull',
      '$_base/pulls',
      body: {
        'account': account,
        'counterparty': counterparty,
        'amount': amountCents,
        'idempotencyKey': idempotencyKey ?? newKey(),
      },
    ),
  );

  /// Stop a payment that has not gone yet.
  Future<Map<String, dynamic>> cancel(String transactionId) async => _map(
    await _moneyPost(
      'cancel',
      '$_base/transactions/$transactionId/cancel',
      body: {'id': transactionId},
    ),
  );

  // ── Payees ──────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> payees() async =>
      _flatList(await _http.get('$_base/payees'));

  Future<Map<String, dynamic>> addPayee(Map<String, dynamic> payee) async =>
      _map(await _http.post('$_base/payees', body: payee));

  Future<void> removePayee(String id) async {
    await _http.delete('$_base/payees/$id');
  }

  /// Start verification: the bank sends two deposits under a dollar.
  Future<Map<String, dynamic>> startMicroDeposits(String payeeId) async => _map(
    await _http.post('$_base/payees/$payeeId/micro-deposits', body: const {}),
  );

  /// Confirm them, in cents.
  Future<Map<String, dynamic>> confirmMicroDeposits(
    String payeeId,
    List<int> amountsCents,
  ) async => _map(
    await _http.post(
      '$_base/payees/$payeeId/confirm',
      body: {'amounts': amountsCents},
    ),
  );

  // ── Cards ───────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> cards(String accountId) async =>
      _flatList(await _http.get('$_base/accounts/$accountId/cards'));

  Future<Map<String, dynamic>> orderCard(
    String accountId, {
    required String form, // physical | virtual
    String? nameOnCard,
    Map<String, dynamic>? shipping,
  }) async => _map(
    await _http.post(
      '$_base/accounts/$accountId/cards',
      body: {
        'form': form,
        if (nameOnCard != null && nameOnCard.isNotEmpty)
          'nameOnCard': nameOnCard,
        if (shipping != null) 'shipping': shipping,
      },
    ),
  );

  Future<Map<String, dynamic>> activateCard(
    String cardId,
    String last4,
  ) async => _map(
    await _http.post('$_base/cards/$cardId/activate', body: {'last4': last4}),
  );

  Future<Map<String, dynamic>> lockCard(String cardId) async =>
      _map(await _http.post('$_base/cards/$cardId/lock', body: const {}));

  Future<Map<String, dynamic>> unlockCard(String cardId) async =>
      _map(await _http.post('$_base/cards/$cardId/unlock', body: const {}));

  /// perTransaction, dailySpend, dailyAtm are cents; the rest are switches.
  Future<Map<String, dynamic>> setControls(
    String cardId,
    Map<String, dynamic> controls,
  ) async =>
      _map(await _http.put('$_base/cards/$cardId/controls', body: controls));

  Future<Map<String, dynamic>> replaceCard(
    String cardId, {
    required String why,
    Map<String, dynamic>? shipping,
  }) async => _map(
    await _http.post(
      '$_base/cards/$cardId/replace',
      body: {'why': why, if (shipping != null) 'shipping': shipping},
    ),
  );

  // ── Disputes ────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> disputes() async =>
      _archive('$_base/disputes');

  Future<Map<String, dynamic>> fileDispute({
    required String transaction,
    required String reason,
    required String description,
    int? amountCents,
  }) async => _map(
    await _http.post(
      '$_base/disputes',
      body: {
        'transaction': transaction,
        'reason': reason,
        'description': description,
        if (amountCents != null) 'amount': amountCents,
      },
    ),
  );

  Future<Map<String, dynamic>> withdrawDispute(String id) async => _map(
    await _moneyPost(
      'dispute_withdraw',
      '$_base/disputes/$id/withdraw',
      body: {'id': id},
    ),
  );

  // -- Loans ---------------------------------------------------------------
  //
  // `@Controller('client/banking/loans')`. These routes differ from the rest
  // of this API in one way that matters: the server composes a borrower's view
  // and returns it already flat, having left out what is the bank's alone --
  // the officer, the ratios, credit data beyond the notice, reason codes,
  // Reg O, approvals, accrual and collection internals. So they read with
  // [_map] and [_records] and never [_flat]: there is no envelope to unwrap,
  // and unwrapping one would drop every field.
  //
  // Rates arrive in basis points. [Rate] is the only thing that turns them
  // into a percentage.
  static const _loansBase = '$_base/loans';

  /// Loans somebody may apply for. `amountCents` and `termMonths` set the
  /// worked APR example the server returns alongside each product's terms.
  Future<List<Map<String, dynamic>>> loanProducts({
    int? amountCents,
    int? termMonths,
  }) async => _records(
    await _http.get(
      '$_loansBase/products',
      queryParams: {
        if (amountCents != null) 'amount': '$amountCents',
        if (termMonths != null) 'termMonths': '$termMonths',
      },
    ),
  );

  /// `{total, data[]}` — my applications, newest first.
  Future<Map<String, dynamic>> loanApplications({
    int page = 1,
    int pageSize = 25,
    String? status,
  }) async => _map(
    await _http.get(
      '$_loansBase/applications',
      queryParams: {
        'page': '$page',
        'pageSize': '$pageSize',
        if (status != null && status.isNotEmpty) 'status': status,
      },
    ),
  );

  /// One application: where it stands, the decision, the approved terms and
  /// Truth in Lending figures, the adverse-action notice if it was declined,
  /// conditions still to meet, and an `actions` map saying what I may do to
  /// it. Another customer's application answers 404, never a hint it exists.
  Future<Map<String, dynamic>> loanApplication(String id) async =>
      _map(await _http.get('$_loansBase/applications/$id'));

  /// Apply for myself. One applicant only — the server takes a co-borrower
  /// only at a branch or by phone. `linkedAccount` is one of my own open
  /// deposit accounts, and the loan pays into it.
  Future<Map<String, dynamic>> applyForLoan({
    required String product,
    required int amountCents,
    required int termMonths,
    required String purpose,
    required int grossMonthlyCents,
    required String linkedAccount,
    String? incomeSource,
    Map<String, dynamic>? employment,
    int? housingPaymentCents,
  }) async => _map(
    await _http.post(
      '$_loansBase/applications',
      body: {
        'product': product,
        'amount': amountCents,
        'termMonths': termMonths,
        'purpose': purpose,
        'income': {
          'grossMonthly': grossMonthlyCents,
          if (incomeSource != null && incomeSource.isNotEmpty)
            'source': incomeSource,
        },
        if (employment != null) 'employment': employment,
        if (housingPaymentCents != null) 'housingPayment': housingPaymentCents,
        'linkedAccount': linkedAccount,
        // Sent only from the screen that actually asked for it, and the server
        // refuses the application without it.
        'consentToCreditCheck': true,
      },
    ),
  );

  Future<Map<String, dynamic>> withdrawLoanApplication(
    String id, {
    String? reason,
  }) async => _map(
    await _http.post(
      '$_loansBase/applications/$id/withdraw',
      body: {if (reason != null && reason.isNotEmpty) 'reason': reason},
    ),
  );

  Future<Map<String, dynamic>> updateLoanApplication(
    String id,
    Map<String, dynamic> changes,
  ) async =>
      _map(await _http.put('$_loansBase/applications/$id', body: changes));
  Future<Map<String, dynamic>> attachLoanDocument(
    String id,
    String path, {
    String? kind,
    String? note,
  }) async => _map(
    await _http.post(
      '$_loansBase/applications/$id/documents',
      body: {
        'path': path,
        if (kind != null) 'kind': kind,
        if (note != null) 'note': note,
      },
    ),
  );
  Future<Map<String, dynamic>> respondToLoanCondition(
    String id,
    int index, {
    String? text,
    List<Map<String, dynamic>>? documents,
  }) async => _map(
    await _http.post(
      '$_loansBase/applications/$id/conditions/$index/respond',
      body: {
        if (text != null) 'text': text,
        if (documents != null) 'documents': documents,
      },
    ),
  );

  /// Answer the bank's different offer.
  Future<Map<String, dynamic>> answerCounteroffer(
    String id, {
    required bool accept,
  }) async => _map(
    await _http.post(
      '$_loansBase/applications/$id/counteroffer',
      body: {'accept': accept},
    ),
  );

  /// `{total, data[]}` — my loans: what I owe, the rate, the next payment.
  Future<Map<String, dynamic>> myLoans({
    int page = 1,
    int pageSize = 25,
    String? status,
  }) async => _map(
    await _http.get(
      _loansBase,
      queryParams: {
        'page': '$page',
        'pageSize': '$pageSize',
        if (status != null && status.isNotEmpty) 'status': status,
      },
    ),
  );

  /// One loan: balances, next due, rate, payoff today, the schedule, every
  /// payment with how it was split, and late fees.
  Future<Map<String, dynamic>> loan(String id) async =>
      _map(await _http.get('$_loansBase/$id'));

  /// What it takes to close the loan on a date — today when `date` is left
  /// out. `date` is YYYY-MM-DD and the server rejects any other shape, so it
  /// is never built by hand from a locale-formatted string.
  Future<Map<String, dynamic>> payoffQuote(String id, {String? date}) async =>
      _map(
        await _http.get(
          '$_loansBase/$id/payoff',
          queryParams: {if (date != null && date.isNotEmpty) 'date': date},
        ),
      );

  /// Pay a loan from one of my own open deposit accounts. Carries an
  /// idempotency key for the same reason every other money movement does.
  Future<Map<String, dynamic>> payLoan(
    String id, {
    required int amountCents,
    required String fromAccount,
    String? idempotencyKey,
  }) async => _map(
    await _moneyPost(
      'loan_payment',
      '$_loansBase/$id/payments',
      body: {
        'id': id,
        'amount': amountCents,
        'from': fromAccount,
        'idempotencyKey': idempotencyKey ?? newKey(),
      },
    ),
  );
}

final bankingApi = BankingApi();

/// Cents in, text out — and back again.
///
/// The server speaks cents and only cents. Every place money is shown or
/// typed goes through here, so a rounding error cannot be introduced by a
/// screen doing its own arithmetic.
abstract final class Money {
  static String format(dynamic cents, {String currency = 'USD'}) {
    final n = cents is num ? cents : num.tryParse('$cents');
    if (n == null) return '—';
    final negative = n < 0;
    final abs = n.abs() / 100;
    final text = abs.toStringAsFixed(2);
    final parts = text.split('.');
    final whole = parts[0].replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );
    return '${negative ? '-' : ''}${symbol(currency)}$whole.${parts[1]}';
  }

  /// Whole units only, for a headline: "$1,240".
  static String short(dynamic cents, {String currency = 'USD'}) {
    final n = cents is num ? cents : num.tryParse('$cents');
    if (n == null) return '—';
    final whole = (n.abs() / 100).round().toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );
    return '${n < 0 ? '-' : ''}${symbol(currency)}$whole';
  }

  /// What somebody typed, as cents. Null when it is not an amount.
  static int? parse(String input) {
    final cleaned = input.trim().replaceFirst(RegExp(r'^[\$£€¥]\s*'), '');
    // Grouped thousands must be complete. Never turn a sign, letters or extra
    // precision into a different amount from the one the customer entered.
    if (!RegExp(
      r'^(?:(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{0,2})?|\.[0-9]{1,2})$',
    ).hasMatch(cleaned))
      return null;
    final parts = cleaned.replaceAll(',', '').split('.');
    final whole = int.tryParse(parts[0].isEmpty ? '0' : parts[0]);
    // The backend uses JavaScript integer cents; stay exact on both sides.
    const maxCents = 9007199254740991;
    if (whole == null || whole > maxCents ~/ 100) return null;
    final fraction = parts.length == 1 ? '' : parts[1];
    final cents = whole * 100 + int.parse(fraction.padRight(2, '0'));
    return cents <= maxCents ? cents : null;
  }

  static String symbol(String currency) => switch (currency.toUpperCase()) {
    'USD' => '\$',
    'GBP' => '£',
    'EUR' => '€',
    _ => '$currency ',
  };
}

/// Basis points in, a percentage out.
///
/// Every rate on the lending routes is in basis points: 1299 is 12.99%. One
/// place does the conversion, because a screen that divides by 100 twice turns
/// a loan into a joke and nothing in the response says which it did.
abstract final class Rate {
  static String format(dynamic bps) {
    final n = bps is num ? bps : num.tryParse('$bps');
    if (n == null) return '\u2014';
    final pct = n / 100;
    final text = pct == pct.roundToDouble()
        ? pct.toStringAsFixed(0)
        : pct.toStringAsFixed(2);
    return '$text%';
  }

  /// A product whose rate depends on who is asking advertises a band, and
  /// showing only one end of it would read as an offer.
  static String range(dynamic minBps, dynamic maxBps) {
    final lo = minBps is num ? minBps : num.tryParse('$minBps');
    final hi = maxBps is num ? maxBps : num.tryParse('$maxBps');
    if (lo == null && hi == null) return '\u2014';
    if (lo == null) return 'up to ${format(hi)}';
    if (hi == null || lo == hi) return format(lo);
    return '${format(lo)} \u2013 ${format(hi)}';
  }
}
