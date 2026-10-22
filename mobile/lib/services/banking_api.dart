import 'dart:math';

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
  BankingApi._();

  final AppengineHttpClient _http = appengineHttpClient;
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

  List<Map<String, dynamic>> _flatList(dynamic r) =>
      [for (final row in _records(r)) _flat(row)];

  /// One key per committed action. Random enough that two phones cannot
  /// collide, stable for the life of one submit.
  static String newKey() {
    final r = Random.secure();
    final bits = List<int>.generate(8, (_) => r.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${DateTime.now().millisecondsSinceEpoch.toRadixString(16)}-$bits';
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
  Future<Map<String, dynamic>> submitIdentity(Map<String, dynamic> body) async =>
      _map(await _http.put('$_base/identity', body: body));

  /// Attach a file already uploaded through `client-data/files/upload`.
  /// `kind` is id_front, id_back, proof_of_address or selfie.
  Future<Map<String, dynamic>> attachIdentityDocument({
    required String kind,
    required String path,
    String? documentType,
    String? proofType,
    String? proofDate,
  }) async =>
      _map(await _http.post('$_base/identity/documents', body: {
        'kind': kind,
        'path': path,
        if (documentType != null) 'documentType': documentType,
        if (proofType != null) 'proofType': proofType,
        if (proofDate != null) 'proofDate': proofDate,
      }));

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
  }) async =>
      _map(await _http.post('$_base/accounts', body: {
        'product': product,
        if (nickname != null && nickname.isNotEmpty) 'nickname': nickname,
        if (business != null) 'business': business,
      }));

  Future<Map<String, dynamic>> rename(String id, String nickname) async =>
      _map(await _http.put('$_base/accounts/$id/nickname',
          body: {'nickname': nickname}));

  Future<Map<String, dynamic>> setOverdraft(String id, bool optedIn) async =>
      _map(await _http.put('$_base/accounts/$id/overdraft',
          body: {'optedIn': optedIn}));

  Future<Map<String, dynamic>> transactions(String accountId,
          {int page = 1, int pageSize = 50}) async =>
      _map(await _http.get('$_base/accounts/$accountId/transactions',
          queryParams: {'page': '$page', 'pageSize': '$pageSize'}));

  Future<List<Map<String, dynamic>>> statements(String accountId) async =>
      _flatList(await _http.get('$_base/accounts/$accountId/statements'));

  Future<Map<String, dynamic>> transaction(String id) async =>
      _map(await _http.get('$_base/transactions/$id'));

  // ── Moving money ────────────────────────────────────────────────────────

  /// To another account at this bank, by account number.
  Future<Map<String, dynamic>> transfer({
    required String from,
    required String toAccountNumber,
    required int amountCents,
    String? memo,
    String? idempotencyKey,
  }) async =>
      _map(await _http.post('$_base/transfers', body: {
        'from': from,
        'to': toAccountNumber,
        'amount': amountCents,
        if (memo != null && memo.isNotEmpty) 'memo': memo,
        'idempotencyKey': idempotencyKey ?? newKey(),
      }));

  /// To a payee at another bank. `rail` is ach, wire, rtp or fednow.
  Future<Map<String, dynamic>> pay({
    required String account,
    required String counterparty,
    required String rail,
    required int amountCents,
    bool sameDay = false,
    String? memo,
    String? idempotencyKey,
  }) async =>
      _map(await _http.post('$_base/payments', body: {
        'account': account,
        'counterparty': counterparty,
        'rail': rail,
        'amount': amountCents,
        'sameDay': sameDay,
        if (memo != null && memo.isNotEmpty) 'memo': memo,
        'idempotencyKey': idempotencyKey ?? newKey(),
      }));

  /// Bring money in from my own verified account elsewhere.
  Future<Map<String, dynamic>> pull({
    required String account,
    required String counterparty,
    required int amountCents,
    String? idempotencyKey,
  }) async =>
      _map(await _http.post('$_base/pulls', body: {
        'account': account,
        'counterparty': counterparty,
        'amount': amountCents,
        'idempotencyKey': idempotencyKey ?? newKey(),
      }));

  /// Stop a payment that has not gone yet.
  Future<Map<String, dynamic>> cancel(String transactionId) async =>
      _map(await _http.post('$_base/transactions/$transactionId/cancel',
          body: const {}));

  // ── Payees ──────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> payees() async =>
      _flatList(await _http.get('$_base/payees'));

  Future<Map<String, dynamic>> addPayee(Map<String, dynamic> payee) async =>
      _map(await _http.post('$_base/payees', body: payee));

  Future<void> removePayee(String id) async {
    await _http.delete('$_base/payees/$id');
  }

  /// Start verification: the bank sends two deposits under a dollar.
  Future<Map<String, dynamic>> startMicroDeposits(String payeeId) async =>
      _map(await _http.post('$_base/payees/$payeeId/micro-deposits',
          body: const {}));

  /// Confirm them, in cents.
  Future<Map<String, dynamic>> confirmMicroDeposits(
          String payeeId, List<int> amountsCents) async =>
      _map(await _http.post('$_base/payees/$payeeId/confirm',
          body: {'amounts': amountsCents}));

  // ── Cards ───────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> cards(String accountId) async =>
      _flatList(await _http.get('$_base/accounts/$accountId/cards'));

  Future<Map<String, dynamic>> orderCard(
    String accountId, {
    required String form, // physical | virtual
    String? nameOnCard,
    Map<String, dynamic>? shipping,
  }) async =>
      _map(await _http.post('$_base/accounts/$accountId/cards', body: {
        'form': form,
        if (nameOnCard != null && nameOnCard.isNotEmpty)
          'nameOnCard': nameOnCard,
        if (shipping != null) 'shipping': shipping,
      }));

  Future<Map<String, dynamic>> activateCard(
          String cardId, String last4) async =>
      _map(await _http.post('$_base/cards/$cardId/activate',
          body: {'last4': last4}));

  Future<Map<String, dynamic>> lockCard(String cardId) async =>
      _map(await _http.post('$_base/cards/$cardId/lock', body: const {}));

  Future<Map<String, dynamic>> unlockCard(String cardId) async =>
      _map(await _http.post('$_base/cards/$cardId/unlock', body: const {}));

  /// perTransaction, dailySpend, dailyAtm are cents; the rest are switches.
  Future<Map<String, dynamic>> setControls(
          String cardId, Map<String, dynamic> controls) async =>
      _map(await _http.put('$_base/cards/$cardId/controls', body: controls));

  Future<Map<String, dynamic>> replaceCard(String cardId,
          {required String why, Map<String, dynamic>? shipping}) async =>
      _map(await _http.post('$_base/cards/$cardId/replace', body: {
        'why': why,
        if (shipping != null) 'shipping': shipping,
      }));

  // ── Disputes ────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> disputes() async =>
      _flatList(await _http.get('$_base/disputes'));

  Future<Map<String, dynamic>> fileDispute({
    required String transaction,
    required String reason,
    required String description,
    int? amountCents,
  }) async =>
      _map(await _http.post('$_base/disputes', body: {
        'transaction': transaction,
        'reason': reason,
        'description': description,
        if (amountCents != null) 'amount': amountCents,
      }));

  Future<Map<String, dynamic>> withdrawDispute(String id) async =>
      _map(await _http.post('$_base/disputes/$id/withdraw', body: const {}));
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
        RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
    return '${negative ? '-' : ''}${symbol(currency)}$whole.${parts[1]}';
  }

  /// Whole units only, for a headline: "$1,240".
  static String short(dynamic cents, {String currency = 'USD'}) {
    final n = cents is num ? cents : num.tryParse('$cents');
    if (n == null) return '—';
    final whole = (n.abs() / 100).round().toString().replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
    return '${n < 0 ? '-' : ''}${symbol(currency)}$whole';
  }

  /// What somebody typed, as cents. Null when it is not an amount.
  static int? parse(String input) {
    final cleaned = input.replaceAll(RegExp(r'[^0-9.]'), '');
    if (cleaned.isEmpty) return null;
    final value = double.tryParse(cleaned);
    if (value == null) return null;
    return (value * 100).round();
  }

  static String symbol(String currency) => switch (currency.toUpperCase()) {
        'USD' => '\$',
        'GBP' => '£',
        'EUR' => '€',
        _ => '$currency ',
      };
}
